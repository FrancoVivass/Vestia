import { Injectable, computed, inject, signal } from '@angular/core';
import {
  AuthChangeEvent,
  Session,
  Subscription,
  User as SupabaseUser,
} from '@supabase/supabase-js';
import { AuthFeedback } from '../models/auth.model';
import { SupabaseService } from './supabase.service';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly supabase = inject(SupabaseService).client;

  readonly session = signal<Session | null>(null);
  readonly user = computed(() => this.session()?.user ?? null);
  readonly initialized = signal(false);

  async initialize(): Promise<void> {
    if (this.initialized()) {
      return;
    }

    try {
      const {
        data: { session },
      } = await this.supabase.auth.getSession();

      this.session.set(session);
    } finally {
      this.initialized.set(true);
    }
  }

  async login(email: string, password: string): Promise<{ success: true } | { success: false; feedback: AuthFeedback }> {
    try {
      const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });

      if (error) {
        return { success: false, feedback: this.mapLoginError(error.message) };
      }

      const validation = this.validateSessionState(data.session);
      if (validation) {
        await this.logout();
        return { success: false, feedback: validation };
      }

      this.session.set(data.session);
      void this.supabase.rpc('log_auth_event', { p_action: 'LOGIN' });
      return { success: true };
    } catch {
      return {
        success: false,
        feedback: {
          code: 'network_error',
          title: 'Error de conexión',
          message: 'No pudimos conectarnos con el servicio de autenticación. Intentá nuevamente.',
        },
      };
    }
  }

  async loginWithGithub(): Promise<{ success: true } | { success: false; feedback: AuthFeedback }> {
    try {
      const { error } = await this.supabase.auth.signInWithOAuth({
        provider: 'github',
        options: { redirectTo: `${window.location.origin}/platform/comercios` },
      });
      if (error) throw error;
      return { success: true };
    } catch {
      return {
        success: false,
        feedback: {
          code: 'unknown_error',
          title: 'No se pudo iniciar con GitHub',
          message: 'Verificá la configuración del proveedor GitHub en Supabase e intentá nuevamente.',
        },
      };
    }
  }

  async logout(): Promise<void> {
    if (this.session()) await this.supabase.rpc('log_auth_event', { p_action: 'LOGOUT' });
    await this.supabase.auth.signOut();
    this.session.set(null);
  }

  async getCurrentUser(): Promise<SupabaseUser | null> {
    const {
      data: { user },
    } = await this.supabase.auth.getUser();

    return user;
  }

  async getSession(): Promise<Session | null> {
    const {
      data: { session },
    } = await this.supabase.auth.getSession();

    this.session.set(session);
    return session;
  }

  async isPlatformOwner(): Promise<boolean> {
    const session = await this.getSession();
    if (!session) return false;
    if (session.user.app_metadata['platform_owner'] === true) return true;
    const { data, error } = await this.supabase.rpc('is_platform_owner');
    return !error && data === true;
  }

  async resetPassword(email: string): Promise<{ success: true } | { success: false; feedback: AuthFeedback }> {
    try {
      const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/nueva-clave',
      });

      if (error) {
        return {
          success: false,
          feedback: {
            code: 'unknown_error',
            title: 'No se pudo enviar el enlace',
            message: 'Revisá el correo ingresado e intentá nuevamente.',
          },
        };
      }

      return { success: true };
    } catch {
      return {
        success: false,
        feedback: {
          code: 'network_error',
          title: 'Error de conexión',
          message: 'No pudimos enviar el correo de recuperación en este momento.',
        },
      };
    }
  }

  onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void): Subscription {
    const {
      data: { subscription },
    } = this.supabase.auth.onAuthStateChange((event, session) => {
      this.session.set(session);
      callback(event, session);
    });

    return subscription;
  }

  resolveRedirectUrl(session: Session | null): string {
    if(session?.user.app_metadata['platform_owner']===true){return '/platform/comercios';}
    const role = String(session?.user.user_metadata['role'] ?? '').toLowerCase();

    return role === 'cashier' ? '/app/pos' : '/app';
  }

  getSessionExpiredFeedback(): AuthFeedback {
    return {
      code: 'session_expired',
      title: 'Sesión expirada',
      message: 'Tu sesión expiró. Iniciá sesión nuevamente para continuar.',
    };
  }

  private validateSessionState(session: Session | null): AuthFeedback | null {
    const userStatus = String(session?.user.user_metadata['userStatus'] ?? 'active').toLowerCase();
    const businessStatus = String(session?.user.user_metadata['businessStatus'] ?? 'active').toLowerCase();

    if (userStatus === 'inactive' || userStatus === 'disabled') {
      return {
        code: 'user_disabled',
        title: 'Usuario desactivado',
        message: 'Tu usuario está desactivado. Contactá al administrador para continuar.',
      };
    }

    if (businessStatus === 'inactive' || businessStatus === 'disabled') {
      return {
        code: 'business_disabled',
        title: 'Comercio desactivado',
        message: 'El comercio asociado a tu cuenta está desactivado.',
      };
    }

    return null;
  }

  private mapLoginError(message: string): AuthFeedback {
    const normalized = message.toLowerCase();

    if (
      normalized.includes('invalid login credentials') ||
      normalized.includes('email not confirmed') ||
      normalized.includes('invalid credentials')
    ) {
      return {
        code: 'invalid_credentials',
        title: 'Credenciales incorrectas',
        message: 'Verificá tu email y contraseña e intentá nuevamente.',
      };
    }

    return {
      code: 'unknown_error',
      title: 'No pudimos iniciar sesión',
      message: 'Ocurrió un problema inesperado. Intentá nuevamente en unos instantes.',
    };
  }
}

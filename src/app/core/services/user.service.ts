import { Injectable, computed, inject, signal } from '@angular/core';
import { AppUser, AppUserFormValue } from '../models/app-user.model';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly client = inject(SupabaseService).client;
  private readonly state = signal<AppUser[]>([]);
  readonly users = computed(() => this.state());

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    const { data, error } = await this.client
      .from('profiles')
      .select('*,profile_permissions(permission_code,enabled)')
      .order('created_at', { ascending: false });
    if (error) throw new Error(await this.functionError(error));
    this.state.set((data ?? []).map((item: any) => ({
      id: item.id,
      fullName: `${item.first_name} ${item.last_name}`.trim(),
      email: item.email,
      role: item.role,
      businessId: item.business_id,
      ownerId: item.owner_id ?? null,
      status: item.active ? 'active' : 'inactive',
      permissions: (item.profile_permissions ?? [])
        .filter((permission: any) => permission.enabled)
        .map((permission: any) => permission.permission_code),
      createdAt: item.created_at,
    })));
  }

  async create(value: AppUserFormValue): Promise<void> {
    await this.invoke('create', value);
    await this.load();
  }

  async update(id: string, value: AppUserFormValue): Promise<void> {
    await this.invoke('update', value, id);
    await this.load();
  }

  async toggleStatus(id: string): Promise<void> {
    const user = this.state().find((item) => item.id === id);
    if (!user) throw new Error('Usuario inexistente');
    const { error } = await this.client.functions.invoke('create-user', {
      body: { action: 'toggle', profileId: id, active: user.status !== 'active' },
    });
    if (error) throw new Error(await this.functionError(error));
    await this.load();
  }

  private async invoke(action: 'create' | 'update', value: AppUserFormValue, profileId?: string): Promise<void> {
    const names = value.fullName.trim().split(/\s+/);
    const { error } = await this.client.functions.invoke('create-user', {
      body: {
        action,
        profileId,
        email: value.email,
        password: value.password,
        firstName: names.shift() ?? '',
        lastName: names.join(' '),
        role: value.role,
        ownerId: value.role === 'OWNER' ? value.ownerId ?? null : null,
        active: value.status === 'active',
        permissions: value.permissions,
      },
    });
    if (error) throw new Error(await this.functionError(error));
  }

  private async functionError(error: any): Promise<string> {
    try { const body = await error.context?.json(); return body?.error || error.message; }
    catch { return error instanceof Error ? error.message : 'Error inesperado'; }
  }
}

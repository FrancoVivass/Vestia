import { Component, computed, ElementRef, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthFeedback } from '../../../../core/models/auth.model';
import { AuthService } from '../../../../core/services/auth.service';
import { ToastService } from '../../../../core/services/toast.service';

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login-page.html',
  styleUrl: './login-page.css',
})
export class LoginPageComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly el = inject(ElementRef);
  private anim: any;

  readonly loading = signal(false);
  readonly resetLoading = signal(false);
  readonly feedback = signal<AuthFeedback | null>(null);
  readonly resetMode = signal(false);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  readonly emailControl = computed(() => this.form.controls.email);
  readonly passwordControl = computed(() => this.form.controls.password);

  async ngOnInit(): Promise<void> {
    const lottie = await import('lottie-web');
    this.anim = lottie.default.loadAnimation({
      container: this.el.nativeElement.querySelector('#login-lottie'),
      renderer: 'svg',
      loop: true,
      autoplay: true,
      path: 'assets/Login.json',
    });
  }

  ngOnDestroy(): void {
    this.anim?.destroy();
  }

  constructor() {
    const reason = this.route.snapshot.queryParamMap.get('reason');

    if (reason === 'session_expired') {
      this.feedback.set(this.authService.getSessionExpiredFeedback());
    }

    if (reason === 'signed_out') {
      this.toast.show({
        title: 'Sesión cerrada',
        description: 'Cerraste sesión correctamente.',
        variant: 'success',
      });
    }

    if (reason === 'unauthorized') {
      this.feedback.set({
        code: 'session_expired',
        title: 'Necesitás iniciar sesión',
        message: 'Accedé con tu cuenta para continuar.',
      });
    }
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.feedback.set(null);

    const { email, password } = this.form.getRawValue();
    const result = await this.authService.login(email, password);

    this.loading.set(false);

    if (!result.success) {
      this.feedback.set(result.feedback);
      return;
    }

    const session = await this.authService.getSession();
    const redirectTo = this.route.snapshot.queryParamMap.get('redirectTo');
    const target = redirectTo || this.authService.resolveRedirectUrl(session);

    this.toast.show({
      title: 'Bienvenido a VESTIA',
      description: 'Tu sesión fue iniciada correctamente.',
      variant: 'success',
    });

    void this.router.navigateByUrl(target);
  }

  async onGithubLogin(): Promise<void> {
    this.loading.set(true);
    this.feedback.set(null);
    const result = await this.authService.loginWithGithub();
    if (!result.success) {
      this.loading.set(false);
      this.feedback.set(result.feedback);
    }
  }

  async onResetPassword(): Promise<void> {
    this.emailControl().markAsTouched();

    if (this.emailControl().invalid) {
      return;
    }

    this.resetLoading.set(true);
    this.feedback.set(null);

    const result = await this.authService.resetPassword(this.emailControl().getRawValue());
    this.resetLoading.set(false);

    if (!result.success) {
      this.feedback.set(result.feedback);
      return;
    }

    this.toast.show({
      title: 'Correo enviado',
      description: 'Te enviamos un enlace para restablecer tu contraseña.',
      variant: 'success',
    });
  }

  toggleResetMode(): void {
    this.resetMode.update((value) => !value);
    this.feedback.set(null);
  }
}

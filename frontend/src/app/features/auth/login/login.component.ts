import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, FormsModule],
  template: `
    <div class="auth-layout">
      <div class="auth-card">
        <div class="auth-brand">
          <div class="brand-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
            </svg>
          </div>
          <h1>SecretarIA</h1>
          <p>Gestión de salud inteligente</p>
        </div>

        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="auth-form">
          <div class="field-group">
            <label for="email">Email</label>
            <input
              id="email"
              type="email"
              formControlName="email"
              placeholder="tu@email.com"
              autocomplete="email"
            />
          </div>

          <div class="field-group">
            <label for="password">Contraseña</label>
            <div class="password-wrap">
              <input
                id="password"
                [type]="showPassword ? 'text' : 'password'"
                formControlName="password"
                placeholder="••••••••"
                autocomplete="current-password"
              />
              <button type="button" class="btn-eye" (click)="showPassword = !showPassword" tabindex="-1">
                @if (showPassword) {
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                } @else {
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                }
              </button>
            </div>
          </div>

          @if (error) {
            <div class="error-banner">{{ error }}</div>
          }

          <div class="forgot-link-row">
            <button type="button" class="btn-link" (click)="toggleForgot()">¿Olvidaste tu contraseña?</button>
          </div>

          @if (showForgot) {
            <div class="forgot-box">
              <p>Ingresá tu email y te enviamos un link para restablecer tu contraseña.</p>
              <div class="forgot-row">
                <input type="email" [(ngModel)]="forgotEmail" placeholder="tu@email.com" [ngModelOptions]="{standalone: true}" />
                <button type="button" class="btn-forgot-send" (click)="sendReset()" [disabled]="!forgotEmail || resetLoading">
                  {{ resetLoading ? '...' : 'Enviar' }}
                </button>
              </div>
              @if (resetSent) {
                <div class="success-small">¡Email enviado! Revisá tu bandeja de entrada.</div>
              }
              @if (resetError) {
                <div class="error-small">{{ resetError }}</div>
              }
            </div>
          }

          <button type="submit" class="btn-primary" [disabled]="loading || form.invalid">
            @if (loading) {
              <span class="spinner"></span>
            } @else {
              Ingresar
            }
          </button>
        </form>

        <p class="auth-footer">
          ¿No tenés cuenta?
          <a routerLink="/register">Registrarse</a>
        </p>
      </div>
    </div>
  `,
  styles: [`
    .auth-layout {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #f0f4ff 0%, #e8f5f0 100%);
      padding: 16px;
    }

    .auth-card {
      background: white;
      border-radius: 20px;
      padding: 40px;
      width: 100%;
      max-width: 400px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
    }

    .auth-brand {
      text-align: center;
      margin-bottom: 32px;
    }

    .brand-icon {
      width: 56px;
      height: 56px;
      background: #4f46e5;
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
      color: white;
    }

    .auth-brand h1 {
      font-size: 24px;
      font-weight: 700;
      color: #111827;
      margin: 0 0 4px;
    }

    .auth-brand p {
      color: #6b7280;
      font-size: 14px;
      margin: 0;
    }

    .auth-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .field-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    label {
      font-size: 14px;
      font-weight: 500;
      color: #374151;
    }

    input {
      padding: 12px 14px;
      border: 1.5px solid #e5e7eb;
      border-radius: 10px;
      font-size: 15px;
      outline: none;
      transition: border-color 0.2s;
      width: 100%;
      box-sizing: border-box;
    }

    input:focus {
      border-color: #4f46e5;
    }

    .password-wrap {
      position: relative;
      display: flex;
      align-items: center;
    }

    .password-wrap input { padding-right: 44px; }

    .btn-eye {
      position: absolute; right: 12px;
      background: none; border: none; cursor: pointer;
      color: #9ca3af; display: flex; padding: 0;
    }

    .btn-eye:hover { color: #4f46e5; }

    .error-banner {
      background: #fef2f2;
      color: #dc2626;
      border: 1px solid #fecaca;
      border-radius: 8px;
      padding: 10px 14px;
      font-size: 14px;
    }

    .btn-primary {
      padding: 13px;
      background: #4f46e5;
      color: white;
      border: none;
      border-radius: 10px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 46px;
    }

    .btn-primary:hover:not(:disabled) { background: #4338ca; }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

    .spinner {
      width: 18px;
      height: 18px;
      border: 2px solid rgba(255,255,255,0.4);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    .auth-footer {
      text-align: center;
      margin-top: 20px;
      color: #6b7280;
      font-size: 14px;
    }

    .auth-footer a {
      color: #4f46e5;
      font-weight: 600;
      text-decoration: none;
    }

    .forgot-link-row { text-align: right; margin-top: -6px; }
    .btn-link { background: none; border: none; color: #4f46e5; font-size: 13px; cursor: pointer; padding: 0; text-decoration: underline; }

    .forgot-box { background: #f0f4ff; border-radius: 10px; padding: 14px; font-size: 13px; color: #374151; }
    .forgot-box p { margin: 0 0 10px; }
    .forgot-row { display: flex; gap: 8px; }
    .forgot-row input { flex: 1; padding: 9px 12px; border: 1.5px solid #e5e7eb; border-radius: 8px; font-size: 14px; outline: none; }
    .forgot-row input:focus { border-color: #4f46e5; }
    .btn-forgot-send { padding: 9px 16px; background: #4f46e5; color: white; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap; }
    .btn-forgot-send:disabled { opacity: 0.5; cursor: not-allowed; }
    .success-small { margin-top: 8px; color: #166534; font-size: 13px; }
    .error-small { margin-top: 8px; color: #dc2626; font-size: 13px; }
  `]
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  loading = false;
  error = '';
  showPassword = false;
  showForgot = false;
  forgotEmail = '';
  resetLoading = false;
  resetSent = false;
  resetError = '';

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  onSubmit() {
    if (this.form.invalid) return;
    this.loading = true;
    this.error = '';

    const { email, password } = this.form.value;
    this.authService.login(email!, password!).subscribe({
      next: async () => {
        await this.authService.refreshUser();
        const user = this.authService.currentUser;
        this.router.navigate([user?.role === 'patient' ? '/patient/dashboard' : '/professional/dashboard']);
      },
      error: (err) => {
        this.error = this.mapFirebaseError(err.code);
        this.loading = false;
      }
    });
  }

  toggleForgot() {
    this.showForgot = !this.showForgot;
    this.resetSent = false;
    this.resetError = '';
    this.forgotEmail = '';
  }

  sendReset() {
    if (!this.forgotEmail) return;
    this.resetLoading = true;
    this.resetError = '';
    this.authService.resetPassword(this.forgotEmail).subscribe({
      next: () => { this.resetLoading = false; this.resetSent = true; },
      error: (err) => {
        this.resetLoading = false;
        const code = err?.code || '';
        if (code === 'auth/user-not-found' || code === 'auth/invalid-email') {
          this.resetError = 'No existe una cuenta con ese email';
        } else {
          this.resetError = 'Error al enviar el email. Intentá de nuevo.';
        }
      }
    });
  }

  private mapFirebaseError(code: string): string {
    const messages: Record<string, string> = {
      'auth/invalid-credential': 'Email o contraseña incorrectos',
      'auth/user-not-found': 'No existe una cuenta con ese email',
      'auth/wrong-password': 'Contraseña incorrecta',
      'auth/too-many-requests': 'Demasiados intentos. Intentá más tarde',
    };
    return messages[code] || 'Error al iniciar sesión. Intentá de nuevo';
  }
}

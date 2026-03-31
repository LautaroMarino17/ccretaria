import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
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
            <input
              id="password"
              type="password"
              formControlName="password"
              placeholder="••••••••"
              autocomplete="current-password"
            />
          </div>

          @if (error) {
            <div class="error-banner">{{ error }}</div>
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
    }

    input:focus {
      border-color: #4f46e5;
    }

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
  `]
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  loading = false;
  error = '';

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

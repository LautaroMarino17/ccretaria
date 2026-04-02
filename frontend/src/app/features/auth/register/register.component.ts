import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../core/services/auth.service';
import { environment } from '../../../../environments/environment';
import { UserRole } from '../../../core/models/user.model';

@Component({
  selector: 'app-register',
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
          <h1>Crear cuenta</h1>
          <p>Completá tus datos para comenzar</p>
        </div>

        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="auth-form">
          <div class="field-group">
            <label for="displayName">Nombre completo</label>
            <input id="displayName" type="text" formControlName="displayName" placeholder="Dr. Juan García" />
          </div>

          <div class="field-group">
            <label for="email">Email</label>
            <input id="email" type="email" formControlName="email" placeholder="tu@email.com" />
          </div>

          <div class="field-group">
            <label for="password">Contraseña</label>
            <div class="password-wrap">
              <input id="password" [type]="showPassword ? 'text' : 'password'" formControlName="password" placeholder="Mínimo 6 caracteres" />
              <button type="button" class="btn-eye" (click)="showPassword = !showPassword" tabindex="-1">
                @if (showPassword) {
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                } @else {
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                }
              </button>
            </div>
          </div>

          @if (form.value.role === 'patient') {
            <div class="field-group">
              <label for="dni">DNI <span class="required">*</span></label>
              <input id="dni" type="text" formControlName="dni" placeholder="Ej: 44884488" inputmode="numeric" maxlength="8" />
              <span class="field-hint">7 u 8 dígitos, sin puntos ni espacios</span>
              @if (form.get('dni')?.dirty && form.get('dni')?.invalid) {
                <span class="field-error">DNI inválido — ingresá 7 u 8 números</span>
              }
            </div>
          }

          <div class="field-group">
            <label>Tipo de cuenta</label>
            <div class="role-selector">
              <button
                type="button"
                class="role-btn"
                [class.active]="form.value.role === 'professional'"
                (click)="form.patchValue({ role: 'professional' })">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                Profesional
              </button>
              <button
                type="button"
                class="role-btn"
                [class.active]="form.value.role === 'patient'"
                (click)="form.patchValue({ role: 'patient' })">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
                Paciente
              </button>
            </div>
          </div>

          @if (error) {
            <div class="error-banner">{{ error }}</div>
          }

          <button type="submit" class="btn-primary" [disabled]="loading || form.invalid || !form.value.role || (form.value.role === 'patient' && !form.value.dni)">
            @if (loading) {
              <span class="spinner"></span>
            } @else {
              Registrarme
            }
          </button>
        </form>

        <p class="auth-footer">
          ¿Ya tenés cuenta? <a routerLink="/login">Iniciar sesión</a>
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
      max-width: 420px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
    }
    .auth-brand { text-align: center; margin-bottom: 32px; }
    .brand-icon {
      width: 56px; height: 56px; background: #4f46e5; border-radius: 16px;
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 16px; color: white;
    }
    .auth-brand h1 { font-size: 24px; font-weight: 700; color: #111827; margin: 0 0 4px; }
    .auth-brand p { color: #6b7280; font-size: 14px; margin: 0; }
    .auth-form { display: flex; flex-direction: column; gap: 16px; }
    .field-group { display: flex; flex-direction: column; gap: 6px; }
    label { font-size: 14px; font-weight: 500; color: #374151; }
    input {
      padding: 12px 14px; border: 1.5px solid #e5e7eb;
      border-radius: 10px; font-size: 15px; outline: none; transition: border-color 0.2s;
      width: 100%; box-sizing: border-box;
    }
    input:focus { border-color: #4f46e5; }
    .password-wrap { position: relative; display: flex; align-items: center; }
    .password-wrap input { padding-right: 44px; }
    .btn-eye { position: absolute; right: 12px; background: none; border: none; cursor: pointer; color: #9ca3af; display: flex; padding: 0; }
    .btn-eye:hover { color: #4f46e5; }
    .role-selector { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .role-btn {
      display: flex; align-items: center; justify-content: center; gap: 8px;
      padding: 12px; border: 1.5px solid #e5e7eb; border-radius: 10px;
      background: white; cursor: pointer; font-size: 14px; font-weight: 500;
      color: #6b7280; transition: all 0.2s;
    }
    .role-btn.active { border-color: #4f46e5; background: #eef2ff; color: #4f46e5; }
    .error-banner {
      background: #fef2f2; color: #dc2626; border: 1px solid #fecaca;
      border-radius: 8px; padding: 10px 14px; font-size: 14px;
    }
    .btn-primary {
      padding: 13px; background: #4f46e5; color: white; border: none;
      border-radius: 10px; font-size: 15px; font-weight: 600; cursor: pointer;
      transition: background 0.2s; display: flex; align-items: center;
      justify-content: center; min-height: 46px;
    }
    .btn-primary:hover:not(:disabled) { background: #4338ca; }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .spinner {
      width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.4);
      border-top-color: white; border-radius: 50%; animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .auth-footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
    .auth-footer a { color: #4f46e5; font-weight: 600; text-decoration: none; }
    .required { color: #dc2626; }
    .field-hint { font-size: 12px; color: #9ca3af; margin-top: 2px; }
    .field-error { font-size: 12px; color: #dc2626; margin-top: 2px; }
  `]
})
export class RegisterComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private http = inject(HttpClient);
  private router = inject(Router);

  loading = false;
  error = '';
  showPassword = false;

  form = this.fb.group({
    displayName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    role: ['' as UserRole | ''],
    dni: ['', [Validators.pattern(/^\d{7,8}$/)]]
  });

  onSubmit() {
    if (this.form.invalid || !this.form.value.role) return;
    this.loading = true;
    this.error = '';

    const { email, password, displayName, role, dni } = this.form.value;

    this.authService.register(email!, password!, displayName!).subscribe({
      next: async (cred) => {
        const rolePayload: any = { uid: cred.user.uid, role };
        if (role === 'patient' && dni) rolePayload.dni = dni.trim();
        // Asignar el rol en el backend
        this.http.post(`${environment.apiUrl}/auth/set-role`, rolePayload).subscribe({
          next: async () => {
            // Refrescar token y actualizar estado del servicio de auth
            await this.authService.refreshUser();
            this.router.navigate([role === 'patient' ? '/patient/dashboard' : '/professional/dashboard']);
          },
          error: () => {
            this.error = 'Error al asignar el rol. Contactá al administrador.';
            this.loading = false;
          }
        });
      },
      error: (err) => {
        this.error = err.code === 'auth/email-already-in-use'
          ? 'Ya existe una cuenta con ese email'
          : 'Error al registrarse. Intentá de nuevo';
        this.loading = false;
      }
    });
  }
}

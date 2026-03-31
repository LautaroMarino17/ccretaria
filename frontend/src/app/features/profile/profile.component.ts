import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page">
      <div class="page-header">
        <h1>Mi perfil</h1>
        <p class="subtitle">Configuración de tu cuenta</p>
      </div>

      <!-- Info de usuario -->
      <div class="section-card">
        <h2>Información de cuenta</h2>
        <div class="user-row">
          <div class="user-avatar">{{ initial() }}</div>
          <div>
            <p class="user-name">{{ user?.displayName || 'Sin nombre' }}</p>
            <p class="user-email">{{ user?.email }}</p>
            <span class="role-badge" [class]="user?.role">{{ roleLabel() }}</span>
          </div>
        </div>
      </div>

      <!-- Cambiar contraseña -->
      <div class="section-card">
        <h2>Cambiar contraseña</h2>
        <div class="form-fields">
          <div class="field">
            <label>Contraseña actual</label>
            <div class="password-wrap">
              <input [type]="showCurrent ? 'text' : 'password'" [(ngModel)]="currentPassword" placeholder="••••••••" />
              <button type="button" class="btn-eye" (click)="showCurrent = !showCurrent" tabindex="-1">
                @if (showCurrent) {
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                } @else {
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                }
              </button>
            </div>
          </div>
          <div class="field">
            <label>Nueva contraseña</label>
            <div class="password-wrap">
              <input [type]="showNew ? 'text' : 'password'" [(ngModel)]="newPassword" placeholder="Mínimo 6 caracteres" />
              <button type="button" class="btn-eye" (click)="showNew = !showNew" tabindex="-1">
                @if (showNew) {
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                } @else {
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                }
              </button>
            </div>
          </div>
          <div class="field">
            <label>Confirmar nueva contraseña</label>
            <div class="password-wrap">
              <input [type]="showConfirm ? 'text' : 'password'" [(ngModel)]="confirmPassword" placeholder="Repetí la nueva contraseña" />
              <button type="button" class="btn-eye" (click)="showConfirm = !showConfirm" tabindex="-1">
                @if (showConfirm) {
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                } @else {
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                }
              </button>
            </div>
          </div>
        </div>

        @if (error()) { <div class="error-banner">{{ error() }}</div> }
        @if (success()) { <div class="success-banner">Contraseña actualizada correctamente</div> }

        <div class="form-actions">
          <button class="btn-primary" (click)="changePassword()" [disabled]="saving() || !currentPassword || !newPassword || !confirmPassword">
            {{ saving() ? 'Guardando...' : 'Cambiar contraseña' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page { max-width: 600px; }
    .page-header { margin-bottom: 24px; }
    h1 { font-size: 22px; font-weight: 700; color: #111827; margin: 0 0 4px; }
    .subtitle { color: #6b7280; font-size: 14px; margin: 0; }

    .section-card { background: white; border-radius: 16px; padding: 24px; box-shadow: 0 1px 4px rgba(0,0,0,0.05); margin-bottom: 16px; }
    .section-card h2 { font-size: 16px; font-weight: 700; color: #111827; margin: 0 0 16px; }

    .user-row { display: flex; align-items: center; gap: 16px; }
    .user-avatar { width: 52px; height: 52px; background: #eef2ff; color: #4f46e5; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 20px; flex-shrink: 0; }
    .user-name { font-size: 16px; font-weight: 600; color: #111827; margin: 0 0 2px; }
    .user-email { font-size: 13px; color: #6b7280; margin: 0 0 6px; }
    .role-badge { padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .role-badge.professional { background: #eef2ff; color: #4f46e5; }
    .role-badge.patient { background: #f0fdf4; color: #16a34a; }

    .form-fields { display: flex; flex-direction: column; gap: 14px; }
    .field { display: flex; flex-direction: column; gap: 6px; }
    label { font-size: 13px; font-weight: 500; color: #374151; }
    input { padding: 10px 12px; border: 1.5px solid #e5e7eb; border-radius: 8px; font-size: 14px; outline: none; font-family: inherit; width: 100%; box-sizing: border-box; }
    input:focus { border-color: #4f46e5; }
    .password-wrap { position: relative; display: flex; align-items: center; }
    .password-wrap input { padding-right: 40px; }
    .btn-eye { position: absolute; right: 10px; background: none; border: none; cursor: pointer; color: #9ca3af; display: flex; padding: 0; }
    .btn-eye:hover { color: #4f46e5; }

    .form-actions { margin-top: 16px; display: flex; justify-content: flex-end; }
    .btn-primary { padding: 10px 20px; background: #4f46e5; color: white; border: none; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; }
    .btn-primary:hover:not(:disabled) { background: #4338ca; }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .error-banner { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 8px; padding: 10px 14px; font-size: 14px; margin-top: 12px; }
    .success-banner { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; border-radius: 8px; padding: 10px 14px; font-size: 14px; margin-top: 12px; }

    @media (max-width: 480px) {
      .section-card { padding: 18px; }
    }
  `]
})
export class ProfileComponent {
  private authService = inject(AuthService);

  user = this.authService.currentUser;
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';
  showCurrent = false;
  showNew = false;
  showConfirm = false;
  saving = signal(false);
  error = signal('');
  success = signal(false);

  initial(): string {
    return (this.user?.displayName || this.user?.email || '?')[0].toUpperCase();
  }

  roleLabel(): string {
    return this.user?.role === 'professional' ? 'Profesional' : 'Paciente';
  }

  changePassword() {
    this.error.set('');
    this.success.set(false);

    if (this.newPassword.length < 6) {
      this.error.set('La nueva contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.error.set('Las contraseñas nuevas no coinciden');
      return;
    }

    this.saving.set(true);
    this.authService.changePassword(this.currentPassword, this.newPassword).subscribe({
      next: () => {
        this.saving.set(false);
        this.success.set(true);
        this.currentPassword = '';
        this.newPassword = '';
        this.confirmPassword = '';
      },
      error: (err: any) => {
        this.saving.set(false);
        const code = err?.code || '';
        if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
          this.error.set('La contraseña actual es incorrecta');
        } else if (code === 'auth/weak-password') {
          this.error.set('La nueva contraseña es demasiado débil');
        } else {
          this.error.set('Error al cambiar la contraseña. Intentá de nuevo.');
        }
      }
    });
  }
}

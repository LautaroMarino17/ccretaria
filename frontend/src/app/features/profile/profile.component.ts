import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page">

      <!-- Hero card -->
      <div class="hero-card">
        <div class="hero-bg"></div>
        <div class="hero-body">
          <div class="avatar-ring">
            <div class="avatar">{{ initial() }}</div>
          </div>
          <div class="hero-info">
            <h1>{{ user?.displayName || (user?.email ?? '').split('@')[0] }}</h1>
            <p class="hero-email">{{ user?.email }}</p>
            <span class="role-badge" [class.pro]="user?.role === 'professional'">
              @if (user?.role === 'professional') {
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                Profesional
              } @else {
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                Paciente
              }
            </span>
          </div>
        </div>
      </div>

      <!-- Datos de contacto -->
      <div class="section-card">
        <div class="section-head">
          <div class="section-icon indigo">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.6 3.25 2 2 0 0 1 3.58 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.56a16 16 0 0 0 5.36 5.36l.92-.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
          </div>
          <div>
            <h2>Contacto</h2>
            <p class="section-sub">Tu información de contacto</p>
          </div>
          @if (!editingContact()) {
            <button class="btn-edit" (click)="startEditContact()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Editar
            </button>
          }
        </div>

        @if (!editingContact()) {
          <!-- Vista -->
          <div class="info-rows">
            <div class="info-row">
              <span class="info-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.6 3.25 2 2 0 0 1 3.58 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.56a16 16 0 0 0 5.36 5.36l.92-.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              </span>
              <div class="info-content">
                <span class="info-label">Teléfono</span>
                <span class="info-value">{{ telefono || '—' }}</span>
              </div>
            </div>

            @if (user?.role === 'professional') {
              <div class="info-row">
                <span class="info-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                </span>
                <div class="info-content">
                  <span class="info-label">Lugares de atención</span>
                  @if (lugares().length > 0) {
                    <div class="lugares-pills">
                      @for (l of lugares(); track l) {
                        <span class="lugar-pill">{{ l }}</span>
                      }
                    </div>
                  } @else {
                    <span class="info-value">—</span>
                  }
                </div>
              </div>
            }
          </div>
        } @else {
          <!-- Edición -->
          <div class="edit-fields">
            <div class="field">
              <label>Teléfono</label>
              <input [(ngModel)]="telefono" placeholder="Ej: +54 11 1234-5678" autofocus />
            </div>

            @if (user?.role === 'professional') {
              <div class="field">
                <label>Lugares de atención</label>
                <p class="field-hint">Uno por línea</p>
                <textarea [(ngModel)]="lugaresText" rows="3"
                  placeholder="Ej:&#10;Consultorio - Av. Corrientes 1234&#10;Clínica Norte - Maipú 567"></textarea>
              </div>
            }

            @if (contactError()) { <div class="alert error">{{ contactError() }}</div> }
            @if (contactSuccess()) { <div class="alert success">Datos actualizados</div> }

            <div class="edit-actions">
              <button class="btn-ghost" (click)="cancelEditContact()">Cancelar</button>
              <button class="btn-primary" (click)="saveContact()" [disabled]="savingContact()">
                @if (savingContact()) { <span class="spinner"></span> } Guardar
              </button>
            </div>
          </div>
        }
      </div>

      <!-- Seguridad -->
      <div class="section-card">
        <div class="section-head">
          <div class="section-icon slate">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </div>
          <div>
            <h2>Seguridad</h2>
            <p class="section-sub">Contraseña de acceso</p>
          </div>
          @if (!expandPassword()) {
            <button class="btn-edit" (click)="expandPassword.set(true)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Cambiar
            </button>
          }
        </div>

        @if (!expandPassword()) {
          <div class="info-rows">
            <div class="info-row">
              <span class="info-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              </span>
              <div class="info-content">
                <span class="info-label">Contraseña</span>
                <span class="info-value pw-dots">••••••••••</span>
              </div>
            </div>
          </div>
        } @else {
          <div class="edit-fields">
            <div class="field">
              <label>Contraseña actual</label>
              <div class="pw-wrap">
                <input [type]="showCurrent ? 'text' : 'password'" [(ngModel)]="currentPassword" placeholder="••••••••" />
                <button type="button" class="btn-eye" (click)="showCurrent = !showCurrent">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    @if (showCurrent) {
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>
                    } @else {
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                    }
                  </svg>
                </button>
              </div>
            </div>
            <div class="field">
              <label>Nueva contraseña</label>
              <div class="pw-wrap">
                <input [type]="showNew ? 'text' : 'password'" [(ngModel)]="newPassword" placeholder="Mínimo 6 caracteres" />
                <button type="button" class="btn-eye" (click)="showNew = !showNew">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    @if (showNew) {
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>
                    } @else {
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                    }
                  </svg>
                </button>
              </div>
            </div>
            <div class="field">
              <label>Confirmar nueva contraseña</label>
              <div class="pw-wrap">
                <input [type]="showConfirm ? 'text' : 'password'" [(ngModel)]="confirmPassword" placeholder="Repetí la contraseña" />
                <button type="button" class="btn-eye" (click)="showConfirm = !showConfirm">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    @if (showConfirm) {
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>
                    } @else {
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                    }
                  </svg>
                </button>
              </div>
            </div>

            @if (pwError()) { <div class="alert error">{{ pwError() }}</div> }
            @if (pwSuccess()) { <div class="alert success">Contraseña actualizada correctamente</div> }

            <div class="edit-actions">
              <button class="btn-ghost" (click)="cancelPw()">Cancelar</button>
              <button class="btn-primary" (click)="changePassword()" [disabled]="savingPw() || !currentPassword || !newPassword || !confirmPassword">
                @if (savingPw()) { <span class="spinner"></span> } Actualizar
              </button>
            </div>
          </div>
        }
      </div>

    </div>
  `,
  styles: [`
    .page { max-width: 560px; }

    /* ── Hero ── */
    .hero-card {
      border-radius: 20px;
      overflow: hidden;
      margin-bottom: 16px;
      box-shadow: 0 4px 20px rgba(22,163,74,0.18);
    }
    .hero-bg {
      height: 80px;
      background: linear-gradient(135deg, #16a34a 0%, #059669 100%);
    }
    .hero-body {
      background: white;
      padding: 0 24px 24px;
      display: flex;
      align-items: flex-end;
      gap: 16px;
    }
    .avatar-ring {
      width: 72px; height: 72px;
      border-radius: 50%;
      border: 4px solid white;
      box-shadow: 0 2px 12px rgba(22,163,74,0.25);
      flex-shrink: 0;
      margin-top: -36px;
      background: linear-gradient(135deg, #16a34a 0%, #059669 100%);
      display: flex; align-items: center; justify-content: center;
    }
    .avatar {
      color: white;
      font-size: 26px;
      font-weight: 800;
      line-height: 1;
    }
    .hero-info {
      padding-top: 10px;
      flex: 1;
      min-width: 0;
    }
    .hero-info h1 {
      font-size: 18px; font-weight: 700; color: #111827;
      margin: 0 0 2px;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .hero-email {
      font-size: 13px; color: #6b7280; margin: 0 0 8px;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .role-badge {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 3px 10px; border-radius: 20px;
      font-size: 11px; font-weight: 700; letter-spacing: 0.3px;
      background: #f0fdf4; color: #16a34a;
    }
    .role-badge.pro { background: #f0fdf4; color: #16a34a; }

    /* ── Section card ── */
    .section-card {
      background: white;
      border-radius: 16px;
      padding: 20px;
      box-shadow: 0 1px 6px rgba(0,0,0,0.06);
      margin-bottom: 14px;
    }
    .section-head {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }
    .section-icon {
      width: 34px; height: 34px; border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .section-icon.indigo { background: #f0fdf4; color: #16a34a; }
    .section-icon.slate  { background: #f1f5f9; color: #475569; }
    .section-head h2 { font-size: 14px; font-weight: 700; color: #111827; margin: 0; }
    .section-sub { font-size: 12px; color: #9ca3af; margin: 0; }
    .btn-edit {
      margin-left: auto;
      display: inline-flex; align-items: center; gap: 5px;
      padding: 6px 12px; border: 1.5px solid #e5e7eb;
      border-radius: 8px; background: white;
      font-size: 13px; font-weight: 600; color: #374151;
      cursor: pointer; transition: all 0.15s; white-space: nowrap;
    }
    .btn-edit:hover { border-color: #16a34a; color: #16a34a; background: #f0fdf4; }

    /* ── Info rows ── */
    .info-rows { display: flex; flex-direction: column; gap: 0; }
    .info-row {
      display: flex; align-items: flex-start; gap: 12px;
      padding: 10px 0;
      border-top: 1px solid #f3f4f6;
    }
    .info-rows .info-row:first-child { border-top: none; }
    .info-icon {
      width: 28px; height: 28px; border-radius: 8px;
      background: #f9fafb; color: #9ca3af;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; margin-top: 1px;
    }
    .info-content { display: flex; flex-direction: column; gap: 3px; flex: 1; min-width: 0; }
    .info-label { font-size: 11px; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; }
    .info-value { font-size: 14px; font-weight: 500; color: #111827; }
    .pw-dots { letter-spacing: 3px; color: #374151; }

    /* Lugares pills */
    .lugares-pills { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 2px; }
    .lugar-pill {
      background: #f0fdf4; color: #16a34a;
      padding: 3px 10px; border-radius: 20px;
      font-size: 12px; font-weight: 500;
    }

    /* ── Edit form ── */
    .edit-fields { display: flex; flex-direction: column; gap: 12px; }
    .field { display: flex; flex-direction: column; gap: 5px; }
    label { font-size: 12px; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.4px; }
    .field-hint { font-size: 11px; color: #9ca3af; margin: -2px 0 2px; }
    input, textarea {
      padding: 9px 12px;
      border: 1.5px solid #e5e7eb;
      border-radius: 8px;
      font-size: 14px; font-family: inherit;
      outline: none; width: 100%; box-sizing: border-box;
      transition: border-color 0.15s;
      resize: vertical;
    }
    input:focus, textarea:focus { border-color: #16a34a; }

    .pw-wrap { position: relative; display: flex; align-items: center; }
    .pw-wrap input { padding-right: 40px; }
    .btn-eye { position: absolute; right: 10px; background: none; border: none; cursor: pointer; color: #9ca3af; display: flex; padding: 0; }
    .btn-eye:hover { color: #16a34a; }

    /* ── Actions ── */
    .edit-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
    .btn-primary {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 9px 18px; background: #16a34a; color: white;
      border: none; border-radius: 9px; font-size: 14px; font-weight: 600;
      cursor: pointer; transition: background 0.15s;
    }
    .btn-primary:hover:not(:disabled) { background: #15803d; }
    .btn-primary:disabled { opacity: 0.55; cursor: not-allowed; }
    .btn-ghost {
      padding: 9px 16px; background: white; color: #6b7280;
      border: 1.5px solid #e5e7eb; border-radius: 9px;
      font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.15s;
    }
    .btn-ghost:hover { border-color: #9ca3af; color: #374151; }

    /* Spinner */
    .spinner {
      width: 13px; height: 13px; border-radius: 50%;
      border: 2px solid rgba(255,255,255,0.35);
      border-top-color: white;
      animation: spin 0.6s linear infinite;
      display: inline-block;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* ── Alerts ── */
    .alert { padding: 10px 14px; border-radius: 8px; font-size: 13px; }
    .alert.error { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
    .alert.success { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; }

    @media (max-width: 480px) {
      .section-card { padding: 16px; }
      .hero-body { padding: 0 16px 20px; gap: 12px; }
    }
  `]
})
export class ProfileComponent implements OnInit {
  private authService = inject(AuthService);
  private api = inject(ApiService);

  user = this.authService.currentUser;

  telefono = '';
  lugaresText = '';
  private _telefonoOrig = '';
  private _lugaresOrig = '';

  editingContact = signal(false);
  savingContact  = signal(false);
  contactSuccess = signal(false);
  contactError   = signal('');
  expandPassword = signal(false);

  currentPassword = '';
  newPassword     = '';
  confirmPassword = '';
  showCurrent = false;
  showNew     = false;
  showConfirm = false;
  savingPw = signal(false);
  pwError  = signal('');
  pwSuccess = signal(false);

  initial(): string {
    return (this.user?.displayName || this.user?.email || '?')[0].toUpperCase();
  }

  lugares(): string[] {
    return this.lugaresText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  }

  ngOnInit() {
    this.api.getProfessionalProfile().subscribe({
      next: (data) => {
        this.telefono = data.telefono || '';
        this.lugaresText = (data.lugares_atencion || []).join('\n');
        this._telefonoOrig = this.telefono;
        this._lugaresOrig = this.lugaresText;
      }
    });
  }

  startEditContact() {
    this._telefonoOrig = this.telefono;
    this._lugaresOrig  = this.lugaresText;
    this.contactError.set('');
    this.contactSuccess.set(false);
    this.editingContact.set(true);
  }

  cancelEditContact() {
    this.telefono    = this._telefonoOrig;
    this.lugaresText = this._lugaresOrig;
    this.editingContact.set(false);
    this.contactError.set('');
  }

  saveContact() {
    this.savingContact.set(true);
    this.contactError.set('');
    this.contactSuccess.set(false);

    if (this.user?.role === 'professional') {
      const lugares = this.lugares();
      this.api.updateProfessionalProfile({ telefono: this.telefono.trim(), lugares_atencion: lugares }).subscribe({
        next: () => {
          this.savingContact.set(false);
          this.contactSuccess.set(true);
          this._telefonoOrig = this.telefono;
          this._lugaresOrig  = this.lugaresText;
          setTimeout(() => { this.contactSuccess.set(false); this.editingContact.set(false); }, 1200);
        },
        error: (err: any) => { this.savingContact.set(false); this.contactError.set(err.error?.detail || 'Error al guardar'); }
      });
    } else {
      this.api.updateMyPhone(this.telefono.trim()).subscribe({
        next: () => {
          this.savingContact.set(false);
          this.contactSuccess.set(true);
          this._telefonoOrig = this.telefono;
          setTimeout(() => { this.contactSuccess.set(false); this.editingContact.set(false); }, 1200);
        },
        error: (err: any) => { this.savingContact.set(false); this.contactError.set(err.error?.detail || 'Error al guardar'); }
      });
    }
  }

  cancelPw() {
    this.currentPassword = '';
    this.newPassword     = '';
    this.confirmPassword = '';
    this.pwError.set('');
    this.pwSuccess.set(false);
    this.expandPassword.set(false);
  }

  changePassword() {
    this.pwError.set('');
    this.pwSuccess.set(false);
    if (this.newPassword.length < 6) { this.pwError.set('Mínimo 6 caracteres'); return; }
    if (this.newPassword !== this.confirmPassword) { this.pwError.set('Las contraseñas no coinciden'); return; }
    this.savingPw.set(true);
    this.authService.changePassword(this.currentPassword, this.newPassword).subscribe({
      next: () => {
        this.savingPw.set(false);
        this.pwSuccess.set(true);
        this.currentPassword = ''; this.newPassword = ''; this.confirmPassword = '';
        setTimeout(() => { this.pwSuccess.set(false); this.expandPassword.set(false); }, 2000);
      },
      error: (err: any) => {
        this.savingPw.set(false);
        const code = err?.code || '';
        if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
          this.pwError.set('La contraseña actual es incorrecta');
        } else if (code === 'auth/weak-password') {
          this.pwError.set('La nueva contraseña es muy débil');
        } else {
          this.pwError.set('Error al cambiar la contraseña');
        }
      }
    });
  }
}

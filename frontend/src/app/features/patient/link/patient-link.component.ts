import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-patient-link',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page">
      <div class="page-header">
        <h1>Vincular médico</h1>
        <p class="subtitle">Conectate con tu profesional para acceder a tus historias, rutinas y evaluaciones</p>
      </div>

      <!-- Estado de vinculación -->
      @if (loadingStatus()) {
        <div class="loading-text">Verificando vinculación...</div>
      } @else if (linkedProfessionals().length > 0) {
        <div class="section-card">
          <h2>Profesionales vinculados</h2>
          @for (prof of linkedProfessionals(); track prof.uid) {
            <div class="linked-card">
              <div class="linked-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              </div>
              <div>
                <p class="linked-name">{{ prof.name }}</p>
                @if (prof.code) { <p class="linked-code">Código: {{ prof.code }}</p> }
              </div>
            </div>
          }
        </div>
      }

      <!-- Solicitudes enviadas -->
      @if (pendingRequests().length > 0) {
        <div class="section-card">
          <h2>Solicitudes enviadas</h2>
          @for (req of pendingRequests(); track req.id) {
            <div class="req-row">
              <div class="req-info">
                <span class="req-status" [class]="req.status">{{ statusLabel(req.status) }}</span>
                <span class="req-code">Código: {{ req.link_code }}</span>
              </div>
              <span class="req-date">{{ formatDate(req.created_at) }}</span>
            </div>
          }
        </div>
      }

      <!-- Formulario de solicitud -->
      <div class="section-card">
        <h2>Enviar solicitud de vinculación</h2>
        <p class="section-desc">Tu profesional recibirá la solicitud y la aprobará o rechazará desde su panel.</p>

        <div class="field">
          <label>Código del profesional *</label>
          <input [(ngModel)]="linkCode" placeholder="Ej: DR-A3X9" style="text-transform:uppercase" />
          <span class="field-hint">El profesional ve su código en el panel de inicio</span>
        </div>
        <div class="fields-row">
          <div class="field">
            <label>Tu nombre *</label>
            <input [(ngModel)]="nombre" placeholder="Juan" />
          </div>
          <div class="field">
            <label>Tu apellido *</label>
            <input [(ngModel)]="apellido" placeholder="Pérez" />
          </div>
        </div>
        <div class="field">
          <label>Tu DNI *</label>
          <input [(ngModel)]="dni" placeholder="Ej: 30123456" inputmode="numeric" />
        </div>
        <div class="field">
          <label>Mensaje (opcional)</label>
          <input [(ngModel)]="mensaje" placeholder="Ej: Soy paciente desde 2023, me derivó el Dr. García" />
        </div>

        @if (error()) { <div class="error-banner">{{ error() }}</div> }
        @if (success()) { <div class="success-banner">¡Solicitud enviada! Tu profesional la revisará pronto.</div> }

        <div class="form-actions">
          <button class="btn-primary" (click)="send()" [disabled]="loading() || !linkCode || !nombre || !apellido || !dni">
            {{ loading() ? 'Enviando...' : 'Enviar solicitud' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page { max-width: 620px; }
    .page-header { margin-bottom: 24px; }
    h1 { font-size: 22px; font-weight: 700; color: #111827; margin: 0 0 4px; }
    .subtitle { color: #6b7280; font-size: 14px; margin: 0; }

    .linked-card {
      display: flex; align-items: center; gap: 16px;
      background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 14px;
      padding: 18px 20px; margin-bottom: 16px;
    }
    .linked-icon { color: #16a34a; flex-shrink: 0; }
    .linked-code { font-size: 12px; color: #166534; margin: 2px 0 0; font-family: monospace; }
    .linked-name { font-size: 15px; font-weight: 700; color: #14532d; margin: 0; }

    .section-card { background: white; border-radius: 16px; padding: 24px; box-shadow: 0 1px 4px rgba(0,0,0,0.05); margin-bottom: 16px; }
    .section-card h2 { font-size: 16px; font-weight: 700; color: #111827; margin: 0 0 6px; }
    .section-desc { font-size: 13px; color: #6b7280; margin: 0 0 20px; line-height: 1.5; }

    .req-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f3f4f6; }
    .req-row:last-child { border-bottom: none; }
    .req-info { display: flex; align-items: center; gap: 10px; }
    .req-status { padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .req-status.pending { background: #fffbeb; color: #92400e; }
    .req-status.accepted { background: #f0fdf4; color: #166534; }
    .req-status.rejected { background: #fef2f2; color: #991b1b; }
    .req-code { font-size: 13px; color: #6b7280; }
    .req-date { font-size: 12px; color: #9ca3af; }

    .fields-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
    label { font-size: 13px; font-weight: 500; color: #374151; }
    .field-hint { font-size: 12px; color: #9ca3af; }
    input { padding: 10px 12px; border: 1.5px solid #e5e7eb; border-radius: 8px; font-size: 14px; outline: none; font-family: inherit; width: 100%; box-sizing: border-box; }
    input:focus { border-color: #16a34a; }

    .form-actions { display: flex; justify-content: flex-end; margin-top: 4px; }
    .btn-primary { padding: 10px 20px; background: #16a34a; color: white; border: none; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; }
    .btn-primary:hover:not(:disabled) { background: #15803d; }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

    .error-banner { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 8px; padding: 10px 14px; font-size: 14px; margin-bottom: 14px; }
    .success-banner { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; border-radius: 8px; padding: 10px 14px; font-size: 14px; margin-bottom: 14px; }
    .loading-text { padding: 20px; text-align: center; color: #9ca3af; font-size: 14px; }

    @media (max-width: 480px) { .fields-row { grid-template-columns: 1fr; } }
  `]
})
export class PatientLinkComponent implements OnInit {
  private api = inject(ApiService);

  linkedProfessionals = signal<{ uid: string; name: string; code: string }[]>([]);
  pendingRequests = signal<any[]>([]);
  loadingStatus = signal(true);

  linkCode = '';
  nombre = '';
  apellido = '';
  dni = '';
  mensaje = '';
  loading = signal(false);
  error = signal('');
  success = signal(false);

  ngOnInit() {
    // Cargar estado de vinculación
    this.api.getMyLink().subscribe({
      next: (links) => {
        this.linkedProfessionals.set((links || []).map(l => ({
          uid: l.professional_uid,
          name: l.professional_name || 'Profesional',
          code: l.link_code || ''
        })));
        this.loadingStatus.set(false);
      },
      error: () => this.loadingStatus.set(false)
    });

    // Cargar solicitudes enviadas
    this.api.getMyLinkStatus().subscribe({
      next: (reqs) => this.pendingRequests.set(reqs || []),
      error: () => {}
    });
  }

  send() {
    this.loading.set(true);
    this.error.set('');
    this.success.set(false);
    this.api.requestLink({
      link_code: this.linkCode.trim().toUpperCase(),
      dni: this.dni.trim(),
      nombre: this.nombre.trim(),
      apellido: this.apellido.trim(),
      mensaje: this.mensaje.trim()
    }).subscribe({
      next: () => {
        this.loading.set(false);
        this.success.set(true);
        this.linkCode = ''; this.nombre = ''; this.apellido = ''; this.dni = ''; this.mensaje = '';
        // Recargar estado
        this.api.getMyLinkStatus().subscribe({
          next: (reqs) => this.pendingRequests.set(reqs || []),
          error: () => {}
        });
      },
      error: (err: any) => {
        this.loading.set(false);
        this.error.set(err.error?.detail || 'Error al enviar la solicitud');
      }
    });
  }

  statusLabel(s: string): string {
    return { pending: 'Pendiente', accepted: 'Aceptada', rejected: 'Rechazada' }[s] || s;
  }

  formatDate(dt: any): string {
    if (!dt) return '';
    try {
      const d = dt.seconds ? new Date(dt.seconds * 1000) : new Date(dt);
      return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch { return ''; }
  }
}

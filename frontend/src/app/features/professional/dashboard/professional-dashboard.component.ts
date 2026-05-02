import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-professional-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="page">
      <div class="welcome-banner">
        <div>
          <h1>Bienvenido, {{ firstName() }}</h1>
          <p>Panel de gestión de pacientes y consultas</p>
        </div>
        <div class="banner-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>

          </svg>
        </div>
      </div>

      <!-- Código de vinculación -->
      <div class="link-code-card">
        <div class="link-code-info">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
          <div>
            <span class="link-code-label">Tu código de vinculación</span>
            <span class="link-code-hint">Compartilo con tus pacientes para que puedan reservar turnos</span>
          </div>
        </div>
        <div class="link-code-value">
          @if (linkCode()) {
            <span class="code">{{ linkCode() }}</span>
            <button class="btn-copy" (click)="copyCode()" [class.copied]="copied()">
              @if (copied()) {
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Copiado
              } @else {
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                Copiar
              }
            </button>
          } @else {
            <span class="code-loading">Cargando...</span>
          }
        </div>
      </div>

      <div class="stats-row">
        <div class="stat-card">
          <span class="stat-value">{{ patientCount() }}</span>
          <span class="stat-label">Pacientes</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">{{ todayAppts() }}</span>
          <span class="stat-label">Turnos hoy</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">{{ upcomingAppts() }}</span>
          <span class="stat-label">Próximos turnos</span>
        </div>
      </div>

      <div class="quick-actions">
        <h2>Acciones rápidas</h2>
        <div class="actions-grid">
          <a routerLink="/professional/patients/new" class="action-btn">
            <div class="action-icon blue">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="8.5" cy="7" r="4"/>
                <line x1="20" y1="8" x2="20" y2="14"/>
                <line x1="23" y1="11" x2="17" y2="11"/>
              </svg>
            </div>
            Nuevo paciente
          </a>
          <a routerLink="/professional/patients" class="action-btn">
            <div class="action-icon purple">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
              </svg>
            </div>
            Ver pacientes
          </a>
          <a routerLink="/professional/appointments" class="action-btn">
            <div class="action-icon green">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="4" width="18" height="18" rx="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            Gestionar turnos
          </a>
        </div>
      </div>

      <!-- Solicitudes de vinculación pendientes -->
      @if (linkRequests().length > 0) {
        <div class="section-card requests-card">
          <h2>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" style="vertical-align:middle;margin-right:6px">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            Solicitudes de vinculación
            <span class="req-count">{{ linkRequests().length }}</span>
          </h2>
          <div class="req-list">
            @for (req of linkRequests(); track req.id) {
              <div class="req-item">
                <div class="req-avatar">{{ (req.patient_nombre || '?')[0].toUpperCase() }}</div>
                <div class="req-info">
                  <span class="req-name">{{ req.patient_nombre }} {{ req.patient_apellido }}</span>
                  <span class="req-meta">DNI {{ req.patient_dni }} · {{ req.patient_email }}</span>
                  @if (req.mensaje) {
                    <span class="req-msg">{{ req.mensaje }}</span>
                  }
                </div>
                <div class="req-actions">
                  <button class="btn-accept" (click)="acceptRequest(req.id)" [disabled]="processingReq() === req.id">
                    @if (processingReq() === req.id) { ... } @else { Aceptar }
                  </button>
                  <button class="btn-reject" (click)="rejectRequest(req.id)" [disabled]="processingReq() === req.id">
                    Rechazar
                  </button>
                </div>
              </div>
            }
          </div>
        </div>
      }

      <!-- Próximos turnos del día -->
      @if (todayAppointments().length > 0) {
        <div class="section-card">
          <h2>Turnos de hoy</h2>
          <div class="appt-list">
            @for (appt of todayAppointments(); track appt.id) {
              <div class="appt-item">
                <div class="appt-time">{{ formatTime(appt.appointment_datetime) }}</div>
                <div class="appt-info">
                  <span class="appt-name">{{ appt.patient_name }}</span>
                  @if (appt.notes) {
                    <span class="appt-notes">{{ appt.notes }}</span>
                  }
                </div>
                <span class="status-badge" [class]="appt.status">{{ statusLabel(appt.status) }}</span>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .page { max-width: 900px; }
    .welcome-banner {
      display: flex; align-items: center; justify-content: space-between;
      background: linear-gradient(135deg, #111111, #16a34a);
      color: white; border-radius: 20px; padding: 32px 28px; margin-bottom: 24px;
    }
    .welcome-banner h1 { font-size: 24px; font-weight: 700; margin: 0 0 6px; }
    .welcome-banner p { margin: 0; opacity: 0.8; font-size: 15px; }
    .banner-icon { opacity: 0.5; }
    .stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 24px; }
    .stat-card {
      background: white; border-radius: 14px; padding: 20px;
      display: flex; flex-direction: column; gap: 4px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.05);
    }
    .stat-value { font-size: 32px; font-weight: 700; color: #16a34a; }
    .stat-label { font-size: 13px; color: #6b7280; }
    .quick-actions { margin-bottom: 24px; }
    .quick-actions h2 { font-size: 16px; font-weight: 700; color: #111827; margin: 0 0 14px; }
    .actions-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .action-btn {
      display: flex; align-items: center; gap: 12px; padding: 16px;
      background: white; border-radius: 12px; text-decoration: none;
      font-size: 14px; font-weight: 500; color: #374151;
      box-shadow: 0 1px 4px rgba(0,0,0,0.05); border: 1.5px solid #e5e7eb;
      transition: all 0.15s;
    }
    .action-btn:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.1); transform: translateY(-1px); }
    .action-icon {
      width: 40px; height: 40px; border-radius: 10px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
    }
    .action-icon.blue { background: #eff6ff; color: #2563eb; }
    .action-icon.purple { background: #faf5ff; color: #059669; }
    .action-icon.green { background: #f0fdf4; color: #16a34a; }
    .section-card {
      background: white; border-radius: 16px; padding: 24px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.05);
    }
    .section-card h2 { font-size: 16px; font-weight: 700; color: #111827; margin: 0 0 16px; }
    .appt-list { display: flex; flex-direction: column; gap: 10px; }
    .appt-item {
      display: flex; align-items: center; gap: 14px;
      padding: 12px 14px; background: #f9fafb; border-radius: 10px;
    }
    .appt-time { font-size: 14px; font-weight: 600; color: #16a34a; min-width: 60px; }
    .appt-info { flex: 1; }
    .appt-name { font-size: 14px; font-weight: 500; color: #111827; display: block; }
    .appt-notes { font-size: 12px; color: #9ca3af; }
    .status-badge { padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
    .status-badge.scheduled { background: #fffbeb; color: #92400e; }
    .status-badge.confirmed { background: #f0fdf4; color: #166534; }
    /* Link code */
    .link-code-card {
      display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px;
      background: #f0fdf4; border: 1.5px solid #c7d2fe; border-radius: 14px;
      padding: 16px 20px; margin-bottom: 24px;
    }
    .link-code-info { display: flex; align-items: center; gap: 12px; }
    .link-code-label { display: block; font-size: 14px; font-weight: 600; color: #166534; }
    .link-code-hint { display: block; font-size: 12px; color: #6366f1; }
    .link-code-value { display: flex; align-items: center; gap: 10px; }
    .code { font-size: 22px; font-weight: 800; color: #16a34a; letter-spacing: 2px; font-family: monospace; }
    .code-loading { font-size: 14px; color: #9ca3af; }
    .btn-copy {
      display: flex; align-items: center; gap: 6px; padding: 8px 14px;
      background: white; border: 1.5px solid #c7d2fe; border-radius: 8px;
      cursor: pointer; font-size: 13px; font-weight: 600; color: #16a34a; transition: all 0.15s;
    }
    .btn-copy:hover { background: #16a34a; color: white; border-color: #16a34a; }
    .btn-copy.copied { background: #f0fdf4; color: #16a34a; border-color: #bbf7d0; }

    /* Solicitudes */
    .requests-card { margin-bottom: 24px; border: 1.5px solid #fde68a; }
    .requests-card h2 { display: flex; align-items: center; font-size: 15px; font-weight: 700; color: #92400e; margin: 0 0 16px; }
    .req-count { margin-left: auto; background: #f59e0b; color: white; border-radius: 20px; padding: 2px 10px; font-size: 12px; }
    .req-list { display: flex; flex-direction: column; gap: 10px; }
    .req-item { display: flex; align-items: center; gap: 12px; padding: 12px 14px; background: #fffbeb; border-radius: 10px; border: 1px solid #fde68a; flex-wrap: wrap; }
    .req-avatar { width: 38px; height: 38px; background: #f59e0b; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 15px; flex-shrink: 0; }
    .req-info { flex: 1; min-width: 0; }
    .req-name { display: block; font-size: 14px; font-weight: 600; color: #111827; }
    .req-meta { display: block; font-size: 12px; color: #6b7280; }
    .req-msg { display: block; font-size: 12px; color: #92400e; font-style: italic; margin-top: 2px; }
    .req-actions { display: flex; gap: 8px; flex-shrink: 0; }
    .btn-accept { padding: 7px 16px; background: #16a34a; color: white; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
    .btn-accept:hover:not(:disabled) { background: #15803d; }
    .btn-accept:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-reject { padding: 7px 14px; background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
    .btn-reject:hover:not(:disabled) { background: #fee2e2; }
    .btn-reject:disabled { opacity: 0.5; cursor: not-allowed; }

    @media (max-width: 640px) {
      .stats-row, .actions-grid { grid-template-columns: 1fr; }
      .link-code-card { flex-direction: column; align-items: flex-start; }
    }
  `]
})
export class ProfessionalDashboardComponent implements OnInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);

  patientCount = signal(0);
  todayAppts = signal(0);
  upcomingAppts = signal(0);
  todayAppointments = signal<any[]>([]);
  linkCode = signal<string | null>(null);
  copied = signal(false);
  linkRequests = signal<any[]>([]);
  processingReq = signal<string | null>(null);

  firstName() {
    const user = this.auth.currentUser;
    return user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || '';
  }

  copyCode() {
    const code = this.linkCode();
    if (!code) return;
    navigator.clipboard.writeText(code);
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2000);
  }

  acceptRequest(id: string) {
    this.processingReq.set(id);
    this.api.actionLinkRequest(id, 'accept').subscribe({
      next: () => {
        this.linkRequests.update(r => r.filter(x => x.id !== id));
        this.api.getPatients().subscribe({ next: (p) => this.patientCount.set(p.length) });
        this.processingReq.set(null);
      },
      error: () => this.processingReq.set(null)
    });
  }

  rejectRequest(id: string) {
    this.processingReq.set(id);
    this.api.actionLinkRequest(id, 'reject').subscribe({
      next: () => { this.linkRequests.update(r => r.filter(x => x.id !== id)); this.processingReq.set(null); },
      error: () => this.processingReq.set(null)
    });
  }

  ngOnInit() {
    this.api.getLinkCode().subscribe({ next: (r) => this.linkCode.set(r.link_code) });
    this.api.getPatients().subscribe({ next: (p) => this.patientCount.set(p.length) });
    this.api.getLinkRequests().subscribe({ next: (r) => this.linkRequests.set(r) });

    this.api.getAppointments().subscribe({
      next: (appts) => {
        const today = new Date();
        const todayStr = today.toDateString();

        const todayList = appts.filter(a => {
          const d = a.appointment_datetime?.seconds
            ? new Date(a.appointment_datetime.seconds * 1000)
            : new Date(a.appointment_datetime);
          return d.toDateString() === todayStr && a.status !== 'cancelled';
        });

        const upcoming = appts.filter(a => {
          const d = a.appointment_datetime?.seconds
            ? new Date(a.appointment_datetime.seconds * 1000)
            : new Date(a.appointment_datetime);
          return d > today && a.status !== 'cancelled';
        });

        this.todayAppts.set(todayList.length);
        this.upcomingAppts.set(upcoming.length);
        this.todayAppointments.set(todayList.sort((a, b) =>
          (a.appointment_datetime?.seconds || 0) - (b.appointment_datetime?.seconds || 0)
        ));
      }
    });
  }

  formatTime(dt: any): string {
    if (!dt) return '';
    try {
      const d = dt.seconds ? new Date(dt.seconds * 1000) : new Date(dt);
      return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  }

  statusLabel(s: string): string {
    return { scheduled: 'Programado', confirmed: 'Confirmado', cancelled: 'Cancelado', completed: 'Completado' }[s] || s;
  }
}

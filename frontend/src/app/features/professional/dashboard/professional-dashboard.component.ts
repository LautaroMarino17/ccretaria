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
    @media (max-width: 640px) {
      .stats-row, .actions-grid { grid-template-columns: 1fr; }
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

  firstName() {
    const user = this.auth.currentUser;
    return user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || '';
  }

  ngOnInit() {
    this.api.getPatients().subscribe({ next: (p) => this.patientCount.set(p.length) });

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

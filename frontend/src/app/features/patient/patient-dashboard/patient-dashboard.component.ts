import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-patient-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="page">
      <div class="welcome-banner">
        <div>
          <h1>Bienvenido, {{ firstName() }}</h1>
          <p>Accedé a tu información de salud de forma segura</p>
        </div>
        <div class="banner-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </div>
      </div>

      <div class="cards-grid">
        <a routerLink="/patient/histories" class="info-card">
          <div class="card-icon blue">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
          </div>
          <div>
            <h3>Historias clínicas</h3>
            <p>Ver mis consultas anteriores</p>
          </div>
        </a>

        <a routerLink="/patient/routine" class="info-card">
          <div class="card-icon green">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
            </svg>
          </div>
          <div>
            <h3>Mi rutina</h3>
            <p>Ver mi plan de actividades</p>
          </div>
        </a>

        <a routerLink="/patient/appointments" class="info-card">
          <div class="card-icon purple">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          <div>
            <h3>Mis turnos</h3>
            <p>Ver y gestionar turnos</p>
          </div>
        </a>
      </div>

      <!-- Próximo turno -->
      @if (nextAppointment()) {
        <div class="next-appt-card">
          <div class="next-appt-label">Próximo turno</div>
          <div class="next-appt-info">
            <h3>{{ nextAppointment().professional_name }}</h3>
            <p>{{ formatDate(nextAppointment().appointment_datetime) }}</p>
          </div>
          <span class="status-badge" [class]="nextAppointment().status">
            {{ statusLabel(nextAppointment().status) }}
          </span>
        </div>
      }
    </div>
  `,
  styles: [`
    .page { max-width: 900px; }
    .welcome-banner {
      display: flex; align-items: center; justify-content: space-between;
      background: linear-gradient(135deg, #4f46e5, #7c3aed);
      color: white; border-radius: 20px; padding: 32px 28px; margin-bottom: 24px;
    }
    .welcome-banner h1 { font-size: 24px; font-weight: 700; margin: 0 0 6px; }
    .welcome-banner p { margin: 0; opacity: 0.8; font-size: 15px; }
    .banner-icon { opacity: 0.6; }
    .cards-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 20px; }
    .info-card {
      display: flex; align-items: center; gap: 14px; padding: 20px;
      background: white; border-radius: 14px; text-decoration: none;
      box-shadow: 0 1px 4px rgba(0,0,0,0.05); border: 1.5px solid #e5e7eb;
      transition: all 0.15s;
    }
    .info-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.1); transform: translateY(-2px); }
    .card-icon {
      width: 48px; height: 48px; border-radius: 14px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
    }
    .card-icon.blue { background: #eff6ff; color: #2563eb; }
    .card-icon.green { background: #f0fdf4; color: #16a34a; }
    .card-icon.purple { background: #faf5ff; color: #7c3aed; }
    .info-card h3 { font-size: 15px; font-weight: 600; color: #111827; margin: 0 0 4px; }
    .info-card p { font-size: 13px; color: #6b7280; margin: 0; }
    .next-appt-card {
      display: flex; align-items: center; gap: 16px; background: white;
      border-radius: 14px; padding: 20px 24px; box-shadow: 0 1px 4px rgba(0,0,0,0.05);
      border-left: 4px solid #4f46e5;
    }
    .next-appt-label { font-size: 12px; font-weight: 600; color: #4f46e5; text-transform: uppercase; letter-spacing: 0.5px; min-width: 90px; }
    .next-appt-info { flex: 1; }
    .next-appt-info h3 { font-size: 15px; font-weight: 600; color: #111827; margin: 0 0 4px; }
    .next-appt-info p { font-size: 13px; color: #6b7280; margin: 0; }
    .status-badge { padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .status-badge.scheduled { background: #fffbeb; color: #92400e; }
    .status-badge.confirmed { background: #f0fdf4; color: #166534; }
    .status-badge.cancelled { background: #fef2f2; color: #991b1b; }
    @media (max-width: 640px) { .cards-grid { grid-template-columns: 1fr; } }
  `]
})
export class PatientDashboardComponent implements OnInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);

  nextAppointment = signal<any>(null);

  firstName() {
    const user = this.auth.currentUser;
    return user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || '';
  }

  ngOnInit() {
    this.api.getAppointments().subscribe({
      next: (appts) => {
        const upcoming = appts
          .filter(a => a.status !== 'cancelled' && a.status !== 'completed')
          .sort((a, b) => (a.appointment_datetime?.seconds || 0) - (b.appointment_datetime?.seconds || 0));
        this.nextAppointment.set(upcoming[0] || null);
      }
    });
  }

  formatDate(date: any): string {
    if (!date) return '';
    try {
      const d = date.seconds ? new Date(date.seconds * 1000) : new Date(date);
      return d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  }

  statusLabel(s: string): string {
    return { scheduled: 'Programado', confirmed: 'Confirmado', cancelled: 'Cancelado', completed: 'Completado' }[s] || s;
  }
}

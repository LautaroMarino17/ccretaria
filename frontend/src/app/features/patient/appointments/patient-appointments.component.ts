import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-patient-appointments',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Mis turnos</h1>
          <p class="subtitle">Reservá un turno con tu profesional</p>
        </div>
        <button class="btn-primary" (click)="toggleBooking()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Reservar turno
        </button>
      </div>

      <!-- Panel de reserva -->
      @if (showBooking()) {
        <div class="booking-card">
          <!-- Tabs -->
          <div class="booking-tabs">
            <button class="tab-btn" [class.active]="bookingTab() === 'slots'" (click)="bookingTab.set('slots')">Reservar turno</button>
            <button class="tab-btn" [class.active]="bookingTab() === 'request'" (click)="bookingTab.set('request')">Solicitar vinculación</button>
          </div>

          @if (bookingTab() === 'slots') {
          <h3>Reservar turno</h3>

          <div class="field">
            <label>Código de tu profesional</label>
            <input [(ngModel)]="linkCode" placeholder="Ej: DR-A3X9" style="text-transform:uppercase" />
            <span class="field-hint">Pedíselo a tu profesional — lo ve en su panel de inicio</span>
          </div>
          <div class="field">
            <label>Tu DNI</label>
            <div class="input-row">
              <input [(ngModel)]="patientDni" placeholder="Ej: 30123456" type="text" inputmode="numeric" />
              <button class="btn-search" (click)="loadSlots()" [disabled]="!linkCode || !patientDni || loadingSlots()">
                {{ loadingSlots() ? '...' : 'Ver disponibilidad' }}
              </button>
            </div>
            <span class="field-hint">Usamos tu DNI para encontrarte en el sistema</span>
          </div>

          @if (availableSlots().length > 0) {
            <div class="slots-grid">
              @for (slot of availableSlots(); track slot.id) {
                <button
                  class="slot-btn"
                  [class.selected]="selectedSlot()?.id === slot.id"
                  (click)="selectedSlot.set(slot)">
                  <span class="slot-date">{{ formatDate(slot.datetime) }}</span>
                  <span class="slot-time">{{ formatTime(slot.datetime) }}</span>
                  <span class="slot-dur">{{ slot.duration_minutes }} min</span>
                  @if (slot.notes) { <span class="slot-notes">{{ slot.notes }}</span> }
                </button>
              }
            </div>

            @if (selectedSlot()) {
              <div class="selected-summary">
                Seleccionaste: <strong>{{ formatDate(selectedSlot()!.datetime) }} {{ formatTime(selectedSlot()!.datetime) }}</strong>
              </div>
              <div class="field">
                <label>Notas (opcional)</label>
                <input [(ngModel)]="bookingNotes" placeholder="Ej: Primera consulta, traigo estudios..." />
              </div>
              <div class="form-actions">
                <button class="btn-secondary" (click)="showBooking.set(false)">Cancelar</button>
                <button class="btn-primary" (click)="book()" [disabled]="booking()">
                  {{ booking() ? 'Reservando...' : 'Confirmar turno' }}
                </button>
              </div>
            }
          } @else if (slotsLoaded() && availableSlots().length === 0) {
            <div class="no-slots">No hay horarios disponibles para este profesional por el momento.</div>
          }

          @if (bookingError()) {
            <div class="error-banner">{{ bookingError() }}</div>
          }
          @if (bookingSuccess()) {
            <div class="success-banner">¡Turno reservado correctamente!</div>
          }
          } @else {
            <!-- Tab: Solicitar vinculación -->
            <h3>Solicitar vinculación</h3>
            <p class="tab-desc">Enviá una solicitud a tu profesional. Una vez que la acepte, vas a poder ver tus historias, rutinas y evaluaciones.</p>
            <div class="field">
              <label>Código del profesional</label>
              <input [(ngModel)]="reqLinkCode" placeholder="Ej: DR-A3X9" style="text-transform:uppercase" />
            </div>
            <div class="field">
              <label>Tu nombre</label>
              <input [(ngModel)]="reqNombre" placeholder="Juan" />
            </div>
            <div class="field">
              <label>Tu apellido</label>
              <input [(ngModel)]="reqApellido" placeholder="Pérez" />
            </div>
            <div class="field">
              <label>Tu DNI</label>
              <input [(ngModel)]="reqDni" placeholder="Ej: 30123456" inputmode="numeric" />
            </div>
            <div class="field">
              <label>Mensaje (opcional)</label>
              <input [(ngModel)]="reqMensaje" placeholder="Ej: Soy paciente desde 2023..." />
            </div>
            @if (reqError()) { <div class="error-banner">{{ reqError() }}</div> }
            @if (reqSuccess()) { <div class="success-banner">¡Solicitud enviada! Tu profesional la revisará pronto.</div> }
            <div class="form-actions">
              <button class="btn-secondary" (click)="showBooking.set(false)">Cancelar</button>
              <button class="btn-primary" (click)="sendRequest()" [disabled]="reqLoading() || !reqLinkCode || !reqNombre || !reqApellido || !reqDni">
                {{ reqLoading() ? 'Enviando...' : 'Enviar solicitud' }}
              </button>
            </div>
          }
        </div>
      }

      <!-- Mis turnos -->
      @if (loading()) {
        <div class="loading-text">Cargando turnos...</div>
      } @else if (appointments().length === 0) {
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" stroke-width="1.5">
            <rect x="3" y="4" width="18" height="18" rx="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <p>No tenés turnos reservados</p>
        </div>
      } @else {
        <div class="appts-list">
          @for (appt of appointments(); track appt.id) {
            <div class="appt-card" [class]="appt.status">
              <div class="appt-left">
                <span class="appt-day">{{ formatDay(appt.appointment_datetime) }}</span>
                <span class="appt-month">{{ formatMonth(appt.appointment_datetime) }}</span>
              </div>
              <div class="appt-center">
                <h3>{{ appt.professional_name || 'Profesional' }}</h3>
                <p class="appt-time">{{ formatTime(appt.appointment_datetime) }} · {{ appt.duration_minutes }} min</p>
                @if (appt.notes) { <p class="appt-notes">{{ appt.notes }}</p> }
              </div>
              <div class="appt-right">
                <span class="status-badge" [class]="appt.status">{{ statusLabel(appt.status) }}</span>
                @if (appt.status === 'confirmed' || appt.status === 'scheduled') {
                  <button class="btn-cancel" (click)="cancel(appt.id)">Cancelar</button>
                }
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .page { max-width: 800px; }
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; flex-wrap: wrap; gap: 12px; }
    h1 { font-size: 22px; font-weight: 700; color: #111827; margin: 0 0 4px; }
    .subtitle { color: #6b7280; font-size: 14px; margin: 0; }

    /* Booking */
    .booking-card { background: white; border-radius: 16px; padding: 24px; margin-bottom: 24px; box-shadow: 0 1px 6px rgba(0,0,0,0.07); }
    .booking-card h3 { font-size: 16px; font-weight: 700; color: #111827; margin: 0 0 18px; }
    .booking-tabs { display: flex; gap: 4px; background: #f3f4f6; border-radius: 10px; padding: 4px; margin-bottom: 20px; }
    .tab-btn { flex: 1; padding: 8px; border: none; background: none; border-radius: 8px; font-size: 13px; font-weight: 500; color: #6b7280; cursor: pointer; transition: all 0.15s; }
    .tab-btn.active { background: white; color: #4f46e5; font-weight: 600; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
    .tab-desc { font-size: 13px; color: #6b7280; margin: -10px 0 16px; line-height: 1.5; }
    .field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
    label { font-size: 13px; font-weight: 500; color: #374151; }
    .input-row { display: flex; gap: 10px; }
    input { flex: 1; padding: 10px 12px; border: 1.5px solid #e5e7eb; border-radius: 8px; font-size: 14px; outline: none; font-family: inherit; }
    input:focus { border-color: #4f46e5; }
    .field-hint { font-size: 12px; color: #9ca3af; }
    .btn-search { padding: 10px 16px; background: #4f46e5; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; white-space: nowrap; }
    .btn-search:disabled { opacity: 0.5; cursor: not-allowed; }

    .slots-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 10px; margin-bottom: 16px; }
    .slot-btn {
      display: flex; flex-direction: column; align-items: center; gap: 4px;
      padding: 14px 12px; border: 1.5px solid #e5e7eb; border-radius: 12px;
      background: white; cursor: pointer; transition: all 0.15s; text-align: center;
    }
    .slot-btn:hover { border-color: #4f46e5; background: #eef2ff; }
    .slot-btn.selected { border-color: #4f46e5; background: #eef2ff; }
    .slot-date { font-size: 13px; font-weight: 600; color: #374151; }
    .slot-time { font-size: 20px; font-weight: 700; color: #4f46e5; }
    .slot-dur { font-size: 11px; color: #9ca3af; }
    .slot-notes { font-size: 11px; color: #6b7280; }
    .selected-summary { background: #eef2ff; color: #4f46e5; border-radius: 8px; padding: 10px 14px; font-size: 14px; margin-bottom: 14px; }
    .no-slots { text-align: center; color: #9ca3af; font-size: 14px; padding: 20px 0; }
    .form-actions { display: flex; gap: 10px; justify-content: flex-end; }

    /* Appointments */
    .appts-list { display: flex; flex-direction: column; gap: 10px; }
    .appt-card {
      display: flex; align-items: center; gap: 16px; background: white;
      border-radius: 14px; padding: 18px 20px; box-shadow: 0 1px 4px rgba(0,0,0,0.05);
      border-left: 4px solid #e5e7eb;
    }
    .appt-card.confirmed { border-left-color: #22c55e; }
    .appt-card.scheduled { border-left-color: #f59e0b; }
    .appt-card.cancelled { border-left-color: #ef4444; opacity: 0.6; }
    .appt-left { text-align: center; min-width: 50px; }
    .appt-day { display: block; font-size: 28px; font-weight: 700; color: #4f46e5; line-height: 1; }
    .appt-month { display: block; font-size: 11px; font-weight: 600; text-transform: uppercase; color: #9ca3af; }
    .appt-center { flex: 1; }
    .appt-center h3 { font-size: 15px; font-weight: 600; color: #111827; margin: 0 0 4px; }
    .appt-time { font-size: 13px; color: #6b7280; margin: 0 0 4px; }
    .appt-notes { font-size: 12px; color: #9ca3af; margin: 0; }
    .appt-right { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
    .status-badge { padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
    .status-badge.confirmed { background: #f0fdf4; color: #166534; }
    .status-badge.scheduled { background: #fffbeb; color: #92400e; }
    .status-badge.cancelled { background: #fef2f2; color: #991b1b; }

    /* Shared */
    .btn-primary { display: flex; align-items: center; gap: 8px; padding: 10px 18px; background: #4f46e5; color: white; border: none; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-secondary { padding: 10px 18px; background: #f3f4f6; color: #374151; border: none; border-radius: 10px; font-size: 14px; cursor: pointer; }
    .btn-cancel { padding: 4px 10px; background: #fef2f2; color: #991b1b; border: none; border-radius: 6px; font-size: 12px; cursor: pointer; }
    .error-banner { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 8px; padding: 10px 14px; font-size: 14px; margin-top: 12px; }
    .success-banner { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; border-radius: 8px; padding: 10px 14px; font-size: 14px; margin-top: 12px; }
    .loading-text { padding: 32px; text-align: center; color: #9ca3af; }
    .empty-state { text-align: center; padding: 56px; display: flex; flex-direction: column; align-items: center; gap: 12px; color: #9ca3af; }
    @media (max-width: 540px) { .slots-grid { grid-template-columns: 1fr 1fr; } }
  `]
})
export class PatientAppointmentsComponent implements OnInit {
  private api = inject(ApiService);

  appointments = signal<any[]>([]);
  availableSlots = signal<any[]>([]);
  loading = signal(true);
  loadingSlots = signal(false);
  slotsLoaded = signal(false);
  showBooking = signal(false);
  booking = signal(false);
  selectedSlot = signal<any>(null);
  bookingError = signal('');
  bookingSuccess = signal(false);
  bookingTab = signal<'slots' | 'request'>('slots');
  resolvedProfessionalUid = '';
  linkCode = '';
  patientDni = '';
  bookingNotes = '';

  // Solicitud de vinculación
  reqLinkCode = '';
  reqNombre = '';
  reqApellido = '';
  reqDni = '';
  reqMensaje = '';
  reqLoading = signal(false);
  reqError = signal('');
  reqSuccess = signal(false);

  ngOnInit() { this.loadAppointments(); }

  loadAppointments() {
    this.api.getAppointments().subscribe({
      next: (data) => {
        const now = new Date();
        const active = data.filter(a => {
          if (a.status === 'cancelled') return false;
          const d = a.appointment_datetime?.seconds
            ? new Date(a.appointment_datetime.seconds * 1000)
            : new Date(a.appointment_datetime);
          return d >= now;
        });
        this.appointments.set(active.sort((a, b) =>
          (a.appointment_datetime?.seconds || 0) - (b.appointment_datetime?.seconds || 0)
        ));
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  toggleBooking() {
    this.showBooking.update(v => !v);
    this.bookingSuccess.set(false);
    this.bookingError.set('');
    this.selectedSlot.set(null);
    this.reqError.set('');
    this.reqSuccess.set(false);
  }

  sendRequest() {
    this.reqLoading.set(true);
    this.reqError.set('');
    this.reqSuccess.set(false);
    this.api.requestLink({
      link_code: this.reqLinkCode.trim().toUpperCase(),
      dni: this.reqDni.trim(),
      nombre: this.reqNombre.trim(),
      apellido: this.reqApellido.trim(),
      mensaje: this.reqMensaje.trim()
    }).subscribe({
      next: () => {
        this.reqLoading.set(false);
        this.reqSuccess.set(true);
        this.reqLinkCode = ''; this.reqNombre = ''; this.reqApellido = ''; this.reqDni = ''; this.reqMensaje = '';
        setTimeout(() => { this.showBooking.set(false); this.reqSuccess.set(false); }, 3000);
      },
      error: (err) => {
        this.reqLoading.set(false);
        this.reqError.set(err.error?.detail || 'Error al enviar la solicitud');
      }
    });
  }

  loadSlots() {
    const code = this.linkCode.trim().toUpperCase();
    if (!code) return;
    this.loadingSlots.set(true);
    this.slotsLoaded.set(false);
    this.selectedSlot.set(null);
    this.bookingError.set('');
    this.api.resolveCode(code).subscribe({
      next: (prof) => {
        this.resolvedProfessionalUid = prof.professional_uid;
        // Guardar vínculo para que rutinas e historias funcionen sin índices
        this.api.linkToProfessional(code, this.patientDni.trim()).subscribe();
        this.api.getAvailableSlots(prof.professional_uid).subscribe({
          next: (data) => { this.availableSlots.set(data); this.loadingSlots.set(false); this.slotsLoaded.set(true); },
          error: () => { this.loadingSlots.set(false); this.slotsLoaded.set(true); }
        });
      },
      error: () => {
        this.bookingError.set('Código inválido. Verificá con tu profesional.');
        this.loadingSlots.set(false);
        this.slotsLoaded.set(true);
      }
    });
  }

  book() {
    const slot = this.selectedSlot();
    if (!slot) return;
    this.booking.set(true);
    this.bookingError.set('');
    this.api.bookAppointment({
      professional_uid: this.resolvedProfessionalUid,
      slot_id: slot.id,
      notes: this.bookingNotes
    }).subscribe({
      next: () => {
        this.booking.set(false);
        this.bookingSuccess.set(true);
        this.selectedSlot.set(null);
        this.availableSlots.update(s => s.filter(sl => sl.id !== slot.id));
        this.loadAppointments();
        setTimeout(() => { this.showBooking.set(false); this.bookingSuccess.set(false); }, 2000);
      },
      error: (err) => {
        this.bookingError.set(err.error?.detail || 'Error al reservar el turno');
        this.booking.set(false);
      }
    });
  }

  cancel(id: string) {
    this.api.cancelAppointment(id).subscribe({ next: () => this.loadAppointments() });
  }

  formatDate(dt: any): string {
    if (!dt) return '';
    try {
      const d = dt.seconds ? new Date(dt.seconds * 1000) : new Date(dt);
      return d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
    } catch { return ''; }
  }

  formatDay(dt: any): string {
    if (!dt) return '';
    try { return (dt.seconds ? new Date(dt.seconds * 1000) : new Date(dt)).getDate().toString(); }
    catch { return ''; }
  }

  formatMonth(dt: any): string {
    if (!dt) return '';
    try {
      return (dt.seconds ? new Date(dt.seconds * 1000) : new Date(dt))
        .toLocaleDateString('es-AR', { month: 'short' }).toUpperCase();
    } catch { return ''; }
  }

  formatTime(dt: any): string {
    if (!dt) return '';
    try {
      return (dt.seconds ? new Date(dt.seconds * 1000) : new Date(dt))
        .toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  }

  statusLabel(s: string): string {
    return { scheduled: 'Programado', confirmed: 'Confirmado', cancelled: 'Cancelado', completed: 'Completado' }[s] || s;
  }
}

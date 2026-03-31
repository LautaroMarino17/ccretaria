import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-professional-appointments',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Turnos</h1>
          <p class="subtitle">Tus consultas programadas y disponibilidad</p>
        </div>
        <button class="btn-primary" (click)="showSlotForm.set(!showSlotForm())">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Agregar horario disponible
        </button>
      </div>

      <!-- Formulario nuevo horario disponible -->
      @if (showSlotForm()) {
        <div class="form-card">
          <h3>Nuevo horario disponible</h3>
          <div class="fields-row">
            <div class="field">
              <label>Fecha y hora *</label>
              <input type="datetime-local" [(ngModel)]="newSlot.datetime_iso" />
            </div>
            <div class="field">
              <label>Duración (minutos)</label>
              <select [(ngModel)]="newSlot.duration_minutes">
                <option [value]="20">20 min</option>
                <option [value]="30">30 min</option>
                <option [value]="45">45 min</option>
                <option [value]="60">60 min</option>
              </select>
            </div>
            <div class="field">
              <label>Notas</label>
              <input [(ngModel)]="newSlot.notes" placeholder="Ej: Solo primera consulta" />
            </div>
          </div>
          <div class="form-actions">
            <button class="btn-secondary" (click)="showSlotForm.set(false)">Cancelar</button>
            <button class="btn-primary" (click)="createSlot()" [disabled]="savingSlot()">
              {{ savingSlot() ? 'Guardando...' : 'Agregar horario' }}
            </button>
          </div>
        </div>
      }

      <!-- Tabs -->
      <div class="tabs">
        <button class="tab" [class.active]="activeTab() === 'appointments'" (click)="activeTab.set('appointments')">
          Turnos reservados
          @if (appointments().length > 0) {
            <span class="badge">{{ appointments().length }}</span>
          }
        </button>
        <button class="tab" [class.active]="activeTab() === 'slots'" (click)="activeTab.set('slots')">
          Mis horarios disponibles
          @if (availableSlots().length > 0) {
            <span class="badge green">{{ availableSlots().length }}</span>
          }
        </button>
      </div>

      <!-- Turnos reservados -->
      @if (activeTab() === 'appointments') {
        @if (loadingAppts()) {
          <div class="loading-text">Cargando turnos...</div>
        } @else if (appointments().length === 0) {
          <div class="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" stroke-width="1.5">
              <rect x="3" y="4" width="18" height="18" rx="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <p>No tenés turnos reservados por el momento</p>
          </div>
        } @else {
          <div class="appt-list">
            @for (appt of appointments(); track appt.id) {
              <div class="appt-card" [class]="appt.status">
                <div class="appt-datetime">
                  <span class="appt-day">{{ formatDay(appt.appointment_datetime) }}</span>
                  <span class="appt-month">{{ formatMonth(appt.appointment_datetime) }}</span>
                  <span class="appt-time">{{ formatTime(appt.appointment_datetime) }}</span>
                </div>
                <div class="appt-info">
                  <h4>{{ appt.patient_name }}</h4>
                  @if (appt.notes) { <p>{{ appt.notes }}</p> }
                  <span class="duration">{{ appt.duration_minutes }} min</span>
                </div>
                <div class="appt-right">
                  <span class="status-badge" [class]="appt.status">{{ statusLabel(appt.status) }}</span>
                  @if (appt.status !== 'cancelled' && appt.status !== 'completed') {
                    <button class="btn-xs red" (click)="cancel(appt.id)">Cancelar</button>
                  }
                </div>
              </div>
            }
          </div>
        }
      }

      <!-- Horarios disponibles -->
      @if (activeTab() === 'slots') {
        @if (loadingSlots()) {
          <div class="loading-text">Cargando horarios...</div>
        } @else if (slots().length === 0) {
          <div class="empty-state">
            <p>No tenés horarios disponibles cargados</p>
            <button class="btn-primary" (click)="showSlotForm.set(true)">Agregar horario</button>
          </div>
        } @else {
          <div class="slots-list">
            @for (slot of slots(); track slot.id) {
              <div class="slot-card" [class.booked]="slot.booked">
                <div class="slot-datetime">
                  <span class="slot-day">{{ formatDay(slot.datetime) }}</span>
                  <span class="slot-month">{{ formatMonth(slot.datetime) }}</span>
                  <span class="slot-time">{{ formatTime(slot.datetime) }}</span>
                </div>
                <div class="slot-info">
                  <span class="duration">{{ slot.duration_minutes }} min</span>
                  @if (slot.notes) { <span class="slot-notes">{{ slot.notes }}</span> }
                </div>
                <div class="slot-status">
                  @if (slot.booked) {
                    <span class="status-badge confirmed">Reservado</span>
                  } @else {
                    <span class="status-badge available">Disponible</span>
                    <button class="btn-xs red" (click)="deleteSlot(slot.id)">Eliminar</button>
                  }
                </div>
              </div>
            }
          </div>
        }
      }
    </div>
  `,
  styles: [`
    .page { max-width: 860px; }
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; flex-wrap: wrap; gap: 12px; }
    h1 { font-size: 22px; font-weight: 700; color: #111827; margin: 0 0 4px; }
    .subtitle { color: #6b7280; font-size: 14px; margin: 0; }

    .form-card { background: white; border-radius: 14px; padding: 22px; margin-bottom: 20px; box-shadow: 0 1px 6px rgba(0,0,0,0.07); }
    .form-card h3 { font-size: 15px; font-weight: 700; color: #111827; margin: 0 0 14px; }
    .fields-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }
    .field { display: flex; flex-direction: column; gap: 6px; }
    label { font-size: 13px; font-weight: 500; color: #374151; }
    input, select { padding: 10px 12px; border: 1.5px solid #e5e7eb; border-radius: 8px; font-size: 14px; outline: none; font-family: inherit; }
    input:focus, select:focus { border-color: #4f46e5; }
    .form-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 14px; }

    /* Tabs */
    .tabs { display: flex; gap: 4px; background: #f3f4f6; border-radius: 10px; padding: 4px; margin-bottom: 20px; }
    .tab {
      flex: 1; padding: 9px 16px; border: none; border-radius: 8px; cursor: pointer;
      font-size: 14px; font-weight: 500; color: #6b7280; background: transparent;
      display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.15s;
    }
    .tab.active { background: white; color: #111827; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
    .badge { background: #4f46e5; color: white; border-radius: 20px; padding: 1px 8px; font-size: 11px; font-weight: 700; }
    .badge.green { background: #22c55e; }

    /* Appointments */
    .appt-list { display: flex; flex-direction: column; gap: 10px; }
    .appt-card {
      display: flex; align-items: center; gap: 16px; background: white;
      border-radius: 14px; padding: 16px 20px; box-shadow: 0 1px 4px rgba(0,0,0,0.05);
      border-left: 4px solid #e5e7eb;
    }
    .appt-card.confirmed { border-left-color: #22c55e; }
    .appt-card.scheduled { border-left-color: #f59e0b; }
    .appt-card.cancelled { border-left-color: #ef4444; opacity: 0.6; }
    .appt-datetime { text-align: center; min-width: 52px; }
    .appt-day { display: block; font-size: 24px; font-weight: 700; color: #4f46e5; line-height: 1; }
    .appt-month { display: block; font-size: 11px; font-weight: 600; color: #9ca3af; text-transform: uppercase; }
    .appt-time { display: block; font-size: 13px; font-weight: 500; color: #374151; margin-top: 2px; }
    .appt-info { flex: 1; }
    .appt-info h4 { font-size: 15px; font-weight: 600; color: #111827; margin: 0 0 3px; }
    .appt-info p { font-size: 13px; color: #6b7280; margin: 0 0 4px; }
    .duration { font-size: 12px; color: #9ca3af; }
    .appt-right { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }

    /* Slots */
    .slots-list { display: flex; flex-direction: column; gap: 8px; }
    .slot-card {
      display: flex; align-items: center; gap: 16px; background: white;
      border-radius: 12px; padding: 14px 18px; box-shadow: 0 1px 4px rgba(0,0,0,0.05);
      border-left: 4px solid #22c55e;
    }
    .slot-card.booked { border-left-color: #4f46e5; opacity: 0.7; }
    .slot-datetime { text-align: center; min-width: 52px; }
    .slot-day { display: block; font-size: 22px; font-weight: 700; color: #22c55e; line-height: 1; }
    .slot-card.booked .slot-day { color: #4f46e5; }
    .slot-month { display: block; font-size: 11px; font-weight: 600; color: #9ca3af; text-transform: uppercase; }
    .slot-time { display: block; font-size: 13px; font-weight: 500; color: #374151; margin-top: 2px; }
    .slot-info { flex: 1; display: flex; align-items: center; gap: 10px; }
    .slot-notes { font-size: 13px; color: #9ca3af; }
    .slot-status { display: flex; align-items: center; gap: 8px; }

    /* Shared */
    .status-badge { padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
    .status-badge.confirmed { background: #f0fdf4; color: #166534; }
    .status-badge.scheduled { background: #fffbeb; color: #92400e; }
    .status-badge.cancelled { background: #fef2f2; color: #991b1b; }
    .status-badge.available { background: #f0fdf4; color: #166534; }
    .btn-primary { display: flex; align-items: center; gap: 8px; padding: 10px 18px; background: #4f46e5; color: white; border: none; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-secondary { padding: 10px 18px; background: #f3f4f6; color: #374151; border: none; border-radius: 10px; font-size: 14px; cursor: pointer; }
    .btn-xs { padding: 4px 10px; border: none; border-radius: 6px; font-size: 12px; cursor: pointer; background: #f3f4f6; color: #374151; }
    .btn-xs.red { background: #fef2f2; color: #991b1b; }
    .loading-text { padding: 32px; text-align: center; color: #9ca3af; }
    .empty-state { text-align: center; padding: 48px; display: flex; flex-direction: column; align-items: center; gap: 12px; color: #9ca3af; }
    @media (max-width: 640px) { .fields-row { grid-template-columns: 1fr; } }
  `]
})
export class ProfessionalAppointmentsComponent implements OnInit {
  private api = inject(ApiService);

  appointments = signal<any[]>([]);
  slots = signal<any[]>([]);
  availableSlots = signal<any[]>([]);
  loadingAppts = signal(true);
  loadingSlots = signal(true);
  showSlotForm = signal(false);
  savingSlot = signal(false);
  activeTab = signal<'appointments' | 'slots'>('appointments');

  newSlot = { datetime_iso: '', duration_minutes: 30, notes: '' };

  ngOnInit() {
    this.loadAppointments();
    this.loadSlots();
  }

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
        this.loadingAppts.set(false);
      },
      error: () => this.loadingAppts.set(false)
    });
  }

  loadSlots() {
    this.api.getMySlots().subscribe({
      next: (data) => {
        this.slots.set(data);
        this.availableSlots.set(data.filter(s => !s.booked));
        this.loadingSlots.set(false);
      },
      error: () => this.loadingSlots.set(false)
    });
  }

  createSlot() {
    if (!this.newSlot.datetime_iso) return;
    this.savingSlot.set(true);
    // Convertir la hora local a UTC antes de enviar al backend
    const utcIso = new Date(this.newSlot.datetime_iso).toISOString();
    this.api.createSlot({ ...this.newSlot, datetime_iso: utcIso }).subscribe({
      next: () => {
        this.savingSlot.set(false);
        this.showSlotForm.set(false);
        this.newSlot = { datetime_iso: '', duration_minutes: 30, notes: '' };
        this.loadSlots();
      },
      error: () => this.savingSlot.set(false)
    });
  }

  deleteSlot(id: string) {
    this.api.deleteSlot(id).subscribe({ next: () => this.loadSlots() });
  }

  cancel(id: string) {
    this.api.cancelAppointment(id).subscribe({ next: () => this.loadAppointments() });
  }

  formatDay(dt: any): string {
    if (!dt) return '';
    try { return (dt.seconds ? new Date(dt.seconds * 1000) : new Date(dt)).getDate().toString(); }
    catch { return ''; }
  }

  formatMonth(dt: any): string {
    if (!dt) return '';
    try {
      const d = dt.seconds ? new Date(dt.seconds * 1000) : new Date(dt);
      return d.toLocaleDateString('es-AR', { month: 'short' }).toUpperCase();
    } catch { return ''; }
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

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
          <p class="subtitle">Consultá disponibilidad y reservá un turno</p>
        </div>
      </div>

      <!-- Selector de profesional -->
      <div class="prof-selector">
        @for (prof of linkedProfs(); track prof.uid) {
          <div class="prof-card" [class.selected]="selectedProfUid() === prof.uid" (click)="selectProf(prof)">
            <div class="prof-avatar">{{ profInitial(prof.name) }}</div>
            <div class="prof-info">
              <p class="prof-name">{{ prof.name }}</p>
              <span class="prof-code">{{ prof.code }}</span>
            </div>
            @if (selectedProfUid() === prof.uid) {
              <svg class="check-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            }
          </div>
        }
        <div class="prof-card add-card" (click)="showOtherCode.set(!showOtherCode())">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <span>Buscar otro profesional</span>
        </div>
      </div>

      @if (showOtherCode()) {
        <div class="code-form">
          <div class="field">
            <label>Código del profesional</label>
            <div class="input-row">
              <input [(ngModel)]="otherCode" placeholder="Ej: DR-A3X9" style="text-transform:uppercase" />
              <button class="btn-search" (click)="resolveOtherCode()" [disabled]="!otherCode || resolvingCode()">
                {{ resolvingCode() ? '...' : 'Buscar' }}
              </button>
            </div>
          </div>
          @if (resolveError()) { <div class="error-banner">{{ resolveError() }}</div> }
        </div>
      }

      @if (!selectedProfUid()) {
        <div class="hint-box">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span>Seleccioná un profesional para ver su disponibilidad</span>
        </div>
      }

      <!-- Calendario del profesional seleccionado -->
      @if (selectedProfUid()) {
        <div class="date-nav">
          <button class="nav-btn" (click)="prevDay()" [disabled]="isToday()" [style.opacity]="isToday() ? '0.3' : '1'" [style.cursor]="isToday() ? 'not-allowed' : 'pointer'">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div class="date-display-wrap">
            <span class="date-day" (click)="datePickerRef.showPicker()">{{ formatNavDate() }}</span>
            <input #datePickerRef type="date" class="date-picker-hidden" [min]="todayStr()" [value]="toDateStr(currentDate)" (change)="onDatePick($event)" />
          </div>
          <button class="nav-btn" (click)="nextDay()">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
          <button class="btn-today" (click)="goToday()">Hoy</button>
          <button class="btn-toggle-cal" (click)="showCalendar.set(!showCalendar())">
            @if (showCalendar()) {
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>
              Ocultar
            } @else {
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
              Ver disponibilidad
            }
          </button>
        </div>

        @if (showCalendar()) {
          @if (loadingDay()) {
            <div class="loading-text">Cargando...</div>
          } @else if (daySlots().length === 0) {
            <div class="empty-state">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <p>No hay horarios para este día</p>
            </div>
          } @else {
            <div class="calendar-table">
              <div class="cal-header">
                <span>Hora</span>
                <span>Estado</span>
                <span>Sede</span>
              </div>
              @for (slot of daySlots(); track slot.id) {
                <div class="cal-row" [class]="slot.status">
                  <div class="cal-time">
                    <span>{{ formatTime(slot.datetime) }}</span>
                    <span class="cal-dur">{{ slot.duration_minutes }} min</span>
                  </div>
                  <div class="cal-status">
                    @if (slot.status === 'available') {
                      <span class="status-pill available">Disponible</span>
                      <button class="btn-reservar" (click)="openBook(slot)">Reservar</button>
                    } @else if (slot.status === 'mine') {
                      <span class="status-pill mine">Mi turno</span>
                      <span class="appt-status-sub">{{ apptStatusLabel(slot.appointment_status) }}</span>
                      @if (slot.appointment_status === 'confirmed' || slot.appointment_status === 'pending_confirmation') {
                        <button class="btn-cancelar" (click)="cancelMyAppt(slot)">Cancelar</button>
                      }
                    } @else {
                      <span class="status-pill occupied">Ocupado</span>
                    }
                  </div>
                  <div class="cal-sede">
                    @if (slot.lugar) { <span>📍 {{ slot.lugar }}</span> } @else { <span class="text-muted">—</span> }
                  </div>
                </div>
              }
            </div>
          }
        }
      }

      <!-- Modal reservar turno -->
      @if (bookingSlot()) {
        <div class="modal-overlay" (click)="bookingSlot.set(null)">
          <div class="modal" (click)="$event.stopPropagation()">
            <h3>Reservar turno</h3>
            <div class="booking-summary">
              <div class="bs-row">
                <span class="bs-label">Fecha y hora</span>
                <span class="bs-val">{{ formatDate(bookingSlot()!.datetime) }} {{ formatTime(bookingSlot()!.datetime) }}</span>
              </div>
              <div class="bs-row">
                <span class="bs-label">Duración</span>
                <span class="bs-val">{{ bookingSlot()!.duration_minutes }} min</span>
              </div>
              @if (bookingSlot()!.lugar) {
                <div class="bs-row">
                  <span class="bs-label">Sede</span>
                  <span class="bs-val">📍 {{ bookingSlot()!.lugar }}</span>
                </div>
              }
            </div>
            <div class="field" style="margin-top:16px">
              <label>Notas (opcional)</label>
              <input [(ngModel)]="bookingNotes" placeholder="Ej: Primera consulta, traigo estudios..." />
            </div>
            @if (bookingError()) { <div class="error-banner">{{ bookingError() }}</div> }
            @if (bookingSuccess()) { <div class="success-banner">¡Turno reservado! Quedará pendiente hasta que el médico lo confirme.</div> }
            <div class="modal-actions">
              <button class="btn-secondary" (click)="bookingSlot.set(null)">Cancelar</button>
              <button class="btn-primary" (click)="book()" [disabled]="booking()">
                {{ booking() ? 'Reservando...' : 'Confirmar reserva' }}
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Mis turnos próximos -->
      <div class="my-appts-section">
        <h2>Mis próximos turnos</h2>
        @if (loading()) {
          <div class="loading-text">Cargando...</div>
        } @else if (appointments().length === 0) {
          <div class="empty-small">No tenés turnos próximos</div>
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
                  @if (appt.lugar) { <p class="appt-lugar">📍 {{ appt.lugar }}</p> }
                  @if (appt.notes) { <p class="appt-notes">{{ appt.notes }}</p> }
                </div>
                <div class="appt-right">
                  <span class="status-badge" [class]="appt.status">{{ statusLabel(appt.status) }}</span>
                  @if (appt.status === 'confirmed' || appt.status === 'pending_confirmation') {
                    <button class="btn-cancel" (click)="cancelApptById(appt.id)">Cancelar</button>
                  }
                </div>
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .page { max-width: 820px; }
    .page-header { margin-bottom: 20px; }
    h1 { font-size: 22px; font-weight: 700; color: #111827; margin: 0 0 4px; }
    .subtitle { color: #6b7280; font-size: 14px; margin: 0; }

    /* Selector de profesional */
    .prof-selector { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; }
    .prof-card { display: flex; align-items: center; gap: 12px; background: white; border: 1.5px solid #e5e7eb; border-radius: 14px; padding: 14px 18px; cursor: pointer; transition: all 0.15s; min-width: 220px; }
    .prof-card:hover { border-color: #4f46e5; }
    .prof-card.selected { border-color: #4f46e5; background: #eef2ff; }
    .prof-card.add-card { color: #6b7280; font-size: 14px; font-weight: 500; border-style: dashed; }
    .prof-card.add-card:hover { color: #4f46e5; }
    .prof-avatar { width: 40px; height: 40px; background: #eef2ff; color: #4f46e5; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 16px; flex-shrink: 0; }
    .prof-info { flex: 1; }
    .prof-name { font-size: 14px; font-weight: 600; color: #111827; margin: 0 0 2px; }
    .prof-code { font-size: 12px; color: #6b7280; font-family: monospace; }
    .check-icon { flex-shrink: 0; }

    .code-form { background: white; border-radius: 12px; padding: 16px 20px; margin-bottom: 16px; box-shadow: 0 1px 4px rgba(0,0,0,0.05); }
    .field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; }
    label { font-size: 13px; font-weight: 500; color: #374151; }
    .input-row { display: flex; gap: 10px; }
    input { flex: 1; padding: 10px 12px; border: 1.5px solid #e5e7eb; border-radius: 8px; font-size: 14px; outline: none; font-family: inherit; }
    input:focus { border-color: #4f46e5; }
    .btn-search { padding: 10px 16px; background: #4f46e5; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; white-space: nowrap; }
    .btn-search:disabled { opacity: 0.5; cursor: not-allowed; }

    .hint-box { display: flex; align-items: center; gap: 10px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px 16px; font-size: 14px; color: #6b7280; margin-bottom: 16px; }

    /* Date nav */
    .date-nav { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
    .nav-btn { width: 36px; height: 36px; background: white; border: 1.5px solid #e5e7eb; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #374151; transition: all 0.15s; }
    .nav-btn:hover { border-color: #4f46e5; color: #4f46e5; }
    .date-display-wrap { flex: 1; display: flex; justify-content: center; position: relative; }
    .date-day { font-size: 16px; font-weight: 700; color: #111827; cursor: pointer; padding: 4px 10px; border-radius: 8px; transition: background 0.15s; }
    .date-day:hover { background: #eef2ff; color: #4f46e5; }
    .date-picker-hidden { position: absolute; opacity: 0; pointer-events: none; width: 0; height: 0; }
    .btn-today { padding: 7px 14px; background: #eef2ff; color: #4f46e5; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
    .btn-toggle-cal { display: flex; align-items: center; gap: 5px; padding: 7px 14px; background: #f3f4f6; color: #374151; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
    .btn-toggle-cal:hover { background: #e5e7eb; }

    /* Calendar table */
    .calendar-table { background: white; border-radius: 14px; overflow: hidden; box-shadow: 0 1px 6px rgba(0,0,0,0.06); margin-bottom: 28px; }
    .cal-header { display: grid; grid-template-columns: 90px 1fr 160px; padding: 10px 16px; background: #f3f4f6; font-size: 12px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
    .cal-row { display: grid; grid-template-columns: 90px 1fr 160px; padding: 12px 16px; border-top: 1px solid #f3f4f6; align-items: center; gap: 12px; }
    .cal-row.available { background: #f0fdf4; }
    .cal-row.mine { background: #eef2ff; }
    .cal-row.occupied { background: #f9fafb; }
    .cal-time span { font-size: 15px; font-weight: 700; color: #111827; display: block; }
    .cal-dur { font-size: 11px; color: #9ca3af; font-weight: 400 !important; }
    .cal-status { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .status-pill { padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .status-pill.available { background: #dcfce7; color: #15803d; }
    .status-pill.mine { background: #e0e7ff; color: #3730a3; }
    .status-pill.occupied { background: #f3f4f6; color: #6b7280; }
    .appt-status-sub { font-size: 12px; color: #6b7280; }
    .btn-reservar { padding: 5px 12px; background: #4f46e5; color: white; border: none; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; }
    .btn-cancelar { padding: 4px 10px; background: #fef2f2; color: #991b1b; border: none; border-radius: 6px; font-size: 12px; cursor: pointer; }
    .cal-sede { font-size: 13px; color: #374151; }
    .text-muted { color: #9ca3af; }

    /* Modal */
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 200; padding: 16px; }
    .modal { background: white; border-radius: 16px; padding: 28px; max-width: 440px; width: 100%; box-shadow: 0 20px 60px rgba(0,0,0,0.2); }
    .modal h3 { font-size: 18px; font-weight: 700; color: #111827; margin: 0 0 16px; }
    .booking-summary { background: #f9fafb; border-radius: 10px; padding: 14px 16px; display: flex; flex-direction: column; gap: 8px; }
    .bs-row { display: flex; justify-content: space-between; align-items: center; }
    .bs-label { font-size: 12px; color: #9ca3af; font-weight: 500; }
    .bs-val { font-size: 14px; color: #111827; font-weight: 600; }
    .modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px; }

    /* Mis turnos */
    .my-appts-section { margin-top: 8px; }
    .my-appts-section h2 { font-size: 16px; font-weight: 700; color: #111827; margin: 0 0 14px; }
    .appts-list { display: flex; flex-direction: column; gap: 10px; }
    .appt-card { display: flex; align-items: center; gap: 16px; background: white; border-radius: 14px; padding: 18px 20px; box-shadow: 0 1px 4px rgba(0,0,0,0.05); border-left: 4px solid #e5e7eb; }
    .appt-card.confirmed { border-left-color: #22c55e; }
    .appt-card.pending_confirmation { border-left-color: #f59e0b; }
    .appt-card.scheduled { border-left-color: #f59e0b; }
    .appt-card.cancelled { border-left-color: #ef4444; opacity: 0.6; }
    .appt-left { text-align: center; min-width: 50px; }
    .appt-day { display: block; font-size: 28px; font-weight: 700; color: #4f46e5; line-height: 1; }
    .appt-month { display: block; font-size: 11px; font-weight: 600; text-transform: uppercase; color: #9ca3af; }
    .appt-center { flex: 1; }
    .appt-center h3 { font-size: 15px; font-weight: 600; color: #111827; margin: 0 0 4px; }
    .appt-time { font-size: 13px; color: #6b7280; margin: 0 0 4px; }
    .appt-lugar { font-size: 12px; color: #4f46e5; margin: 0 0 2px; }
    .appt-notes { font-size: 12px; color: #9ca3af; margin: 0; }
    .appt-right { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
    .status-badge { padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
    .status-badge.confirmed { background: #f0fdf4; color: #166534; }
    .status-badge.pending_confirmation { background: #fffbeb; color: #92400e; }
    .status-badge.scheduled { background: #fffbeb; color: #92400e; }
    .status-badge.cancelled { background: #fef2f2; color: #991b1b; }
    .empty-small { font-size: 14px; color: #9ca3af; padding: 20px 0; text-align: center; }

    /* Shared */
    .btn-primary { padding: 10px 20px; background: #4f46e5; color: white; border: none; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-secondary { padding: 10px 18px; background: #f3f4f6; color: #374151; border: none; border-radius: 10px; font-size: 14px; cursor: pointer; }
    .btn-cancel { padding: 4px 10px; background: #fef2f2; color: #991b1b; border: none; border-radius: 6px; font-size: 12px; cursor: pointer; }
    .error-banner { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 8px; padding: 10px 14px; font-size: 14px; margin-top: 10px; }
    .success-banner { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; border-radius: 8px; padding: 10px 14px; font-size: 14px; margin-top: 10px; }
    .loading-text { padding: 24px; text-align: center; color: #9ca3af; }
    .empty-state { text-align: center; padding: 40px; display: flex; flex-direction: column; align-items: center; gap: 12px; color: #9ca3af; }

    @media (max-width: 540px) {
      .cal-header, .cal-row { grid-template-columns: 80px 1fr; }
      .cal-header span:last-child, .cal-sede { display: none; }
    }
  `]
})
export class PatientAppointmentsComponent implements OnInit {
  private api = inject(ApiService);

  appointments = signal<any[]>([]);
  daySlots = signal<any[]>([]);
  linkedProfs = signal<{ uid: string; name: string; code: string }[]>([]);
  selectedProfUid = signal('');
  loading = signal(true);
  loadingDay = signal(false);
  bookingSlot = signal<any>(null);
  booking = signal(false);
  bookingError = signal('');
  bookingSuccess = signal(false);
  bookingNotes = '';
  showOtherCode = signal(false);
  showCalendar = signal(false);
  otherCode = '';
  resolvingCode = signal(false);
  resolveError = signal('');

  currentDate = new Date();

  ngOnInit() {
    this.loadMyAppointments();
    // Cargar profesionales vinculados
    this.api.getMyLink().subscribe({
      next: (links) => {
        const profs = (links || []).map(l => ({
          uid: l.professional_uid,
          name: l.professional_name || 'Mi profesional',
          code: l.link_code || ''
        }));
        this.linkedProfs.set(profs);
        if (profs.length > 0) this.selectProf(profs[0]);
      },
      error: () => {}
    });
  }

  selectProf(prof: { uid: string; name: string; code: string }) {
    this.selectedProfUid.set(prof.uid);
    this.showCalendar.set(false);
    this.loadDay();
  }

  resolveOtherCode() {
    const code = this.otherCode.trim().toUpperCase();
    if (!code) return;
    this.resolvingCode.set(true);
    this.resolveError.set('');
    this.api.resolveCode(code).subscribe({
      next: (prof) => {
        this.resolvingCode.set(false);
        this.showOtherCode.set(false);
        this.otherCode = '';
        this.selectedProfUid.set(prof.professional_uid);
        this.loadDay();
      },
      error: () => {
        this.resolvingCode.set(false);
        this.resolveError.set('Código inválido. Verificá con tu profesional.');
      }
    });
  }

  loadMyAppointments() {
    this.api.getAppointments().subscribe({
      next: (data) => {
        const now = new Date();
        const active = data.filter((a: any) => {
          if (a.status === 'cancelled') return false;
          const d = a.appointment_datetime?.seconds ? new Date(a.appointment_datetime.seconds * 1000) : new Date(a.appointment_datetime);
          return d >= now;
        });
        this.appointments.set(active.sort((a: any, b: any) =>
          (a.appointment_datetime?.seconds || 0) - (b.appointment_datetime?.seconds || 0)
        ));
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  loadDay() {
    const uid = this.selectedProfUid();
    if (!uid) return;
    this.loadingDay.set(true);
    const dateStr = this.toDateStr(this.currentDate);
    this.api.getDaySlots(uid, dateStr).subscribe({
      next: (slots) => { this.daySlots.set(slots); this.loadingDay.set(false); },
      error: () => this.loadingDay.set(false)
    });
  }

  todayStr(): string { return this.toDateStr(new Date()); }

  onDatePick(event: Event) {
    const val = (event.target as HTMLInputElement).value;
    if (!val) return;
    const [y, m, d] = val.split('-').map(Number);
    this.currentDate = new Date(y, m - 1, d);
    this.loadDay();
  }

  isToday(): boolean {
    const t = new Date();
    return this.currentDate.getFullYear() === t.getFullYear() &&
           this.currentDate.getMonth() === t.getMonth() &&
           this.currentDate.getDate() === t.getDate();
  }

  prevDay() {
    if (this.isToday()) return;
    this.currentDate = new Date(this.currentDate);
    this.currentDate.setDate(this.currentDate.getDate() - 1);
    this.loadDay();
  }
  nextDay() { this.currentDate = new Date(this.currentDate); this.currentDate.setDate(this.currentDate.getDate() + 1); this.loadDay(); }
  goToday() { this.currentDate = new Date(); this.loadDay(); }

  openBook(slot: any) {
    this.bookingSlot.set(slot);
    this.bookingNotes = '';
    this.bookingError.set('');
    this.bookingSuccess.set(false);
  }

  book() {
    const slot = this.bookingSlot();
    if (!slot) return;
    this.booking.set(true);
    this.bookingError.set('');
    this.api.bookAppointment({
      professional_uid: this.selectedProfUid(),
      slot_id: slot.id,
      notes: this.bookingNotes
    }).subscribe({
      next: () => {
        this.booking.set(false);
        this.bookingSuccess.set(true);
        this.loadDay();
        this.loadMyAppointments();
        setTimeout(() => this.bookingSlot.set(null), 2500);
      },
      error: (err: any) => {
        this.bookingError.set(err.error?.detail || 'Error al reservar el turno');
        this.booking.set(false);
      }
    });
  }

  cancelMyAppt(slot: any) {
    if (!slot.appointment_id) return;
    this.api.cancelAppointment(slot.appointment_id).subscribe({
      next: () => { this.loadDay(); this.loadMyAppointments(); }
    });
  }

  cancelApptById(id: string) {
    this.api.cancelAppointment(id).subscribe({ next: () => this.loadMyAppointments() });
  }

  profInitial(name: string): string {
    return (name || '?')[0].toUpperCase();
  }

  apptStatusLabel(s: string): string {
    return { confirmed: 'Confirmado', pending_confirmation: 'Pendiente', scheduled: 'Programado', cancelled: 'Cancelado' }[s] || s;
  }

  statusLabel(s: string): string {
    return { scheduled: 'Programado', confirmed: 'Confirmado', pending_confirmation: 'Pendiente confirmación', cancelled: 'Cancelado', completed: 'Completado' }[s] || s;
  }

  formatNavDate(): string {
    return this.currentDate.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  formatDate(dt: any): string {
    if (!dt) return '';
    try {
      return (dt.seconds ? new Date(dt.seconds * 1000) : new Date(dt))
        .toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
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

  toDateStr(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}

import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';

interface HourRow {
  hour: number;
  appointments: any[];
}

@Component({
  selector: 'app-professional-appointments',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Turnos</h1>
          <p class="subtitle">Agenda del día</p>
        </div>
      </div>

      <!-- Navegación de fecha -->
      <div class="date-nav">
        <button class="nav-btn" (click)="prevDay()" [disabled]="isToday()" [style.opacity]="isToday() ? '0.3' : '1'" [style.cursor]="isToday() ? 'not-allowed' : 'pointer'">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div class="date-display-wrap">
          <span class="date-display" (click)="datePickerRef.showPicker()">{{ formatNavDate() }}</span>
          <input #datePickerRef type="date" class="date-picker-hidden" [value]="toDateStr(currentDate)" (change)="onDatePick($event)" />
        </div>
        <button class="nav-btn" (click)="nextDay()">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
        <button class="btn-today" (click)="goToday()">Hoy</button>
      </div>

      <!-- Leyenda -->
      <div class="legend-row">
        <span class="legend-dot consulta"></span><span class="legend-lbl">Consulta</span>
        <span class="legend-dot sesion"></span><span class="legend-lbl">Sesión</span>
      </div>

      <!-- Tabla de turnos -->
      @if (loadingDay()) {
        <div class="loading-text">Cargando...</div>
      } @else {
        <div class="cal-table">
          <div class="cal-head">
            <span class="col-hour">Hora</span>
            <span class="col-patients">Pacientes</span>
          </div>

          @for (row of visibleRows(); track row.hour) {
            <div class="cal-row" [class.row-past]="isPast(row.hour)" [class.row-occupied]="row.appointments.length > 0">
              <div class="col-hour">
                <span class="hour-label">{{ padHour(row.hour) }}:00</span>
              </div>
              <div class="col-patients">
                @for (appt of row.appointments; track appt.id) {
                  <span class="patient-chip" [class.tipo-sesion]="appt.tipo === 'sesion'">
                    {{ appt.patient_name }}
                    <button class="btn-chip-remove" (click)="removeAppt(appt.id)" title="Quitar paciente">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </span>
                }
                @if (!isPast(row.hour)) {
                  <button class="btn-add-patient" (click)="openModal(row.hour)" title="Agregar paciente">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </button>
                }
              </div>
            </div>
          }
        </div>

        <button class="btn-expand" (click)="showFullDay.set(!showFullDay())">
          @if (showFullDay()) {
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>
            Mostrar menos
          } @else {
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
            Ver horario completo
          }
        </button>
      }
    </div>

    <!-- Modal overlay para seleccionar paciente -->
    @if (openDropdownHour() !== null) {
      <div class="modal-overlay" (click)="closeModal()">
        <div class="assign-modal" (click)="$event.stopPropagation()">
          <div class="assign-modal-header">
            <div>
              <h3>Asignar paciente</h3>
              <p class="assign-modal-time">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                {{ padHour(openDropdownHour()!) }}:00 — {{ formatNavDateShort() }}
              </p>
            </div>
            <button class="btn-modal-close" (click)="closeModal()">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          <div class="tipo-row">
            <label class="tipo-opt" [class.active]="assignTipo() === 'consulta'">
              <input type="radio" name="tipo" value="consulta" [(ngModel)]="assignTipoValue" (change)="assignTipo.set('consulta')" />
              <span class="tipo-dot consulta"></span> Consulta
            </label>
            <label class="tipo-opt" [class.active]="assignTipo() === 'sesion'">
              <input type="radio" name="tipo" value="sesion" [(ngModel)]="assignTipoValue" (change)="assignTipo.set('sesion')" />
              <span class="tipo-dot sesion"></span> Sesión
            </label>
          </div>

          @if (patients().length === 0) {
            <p class="modal-empty">No hay pacientes registrados.</p>
          } @else {
            <div class="patient-list">
              @for (p of patients(); track p.id) {
                @if (isAssignedToday(p.id)) {
                  <div class="patient-option disabled">
                    <span class="patient-option-name">{{ p.apellido }}, {{ p.nombre }}</span>
                    <span class="already-badge">Ya tiene turno hoy</span>
                  </div>
                } @else {
                  <button class="patient-option"
                    [disabled]="savingHour() !== null"
                    (click)="doAssign(openDropdownHour()!, p)">
                    <span class="patient-option-name">{{ p.apellido }}, {{ p.nombre }}</span>
                    @if (savingHour() !== null) {
                      <span class="saving-dot"></span>
                    }
                  </button>
                }
              }
            </div>
          }
        </div>
      </div>
    }
  `,
  styles: [`
    .page { max-width: 760px; }
    .page-header { margin-bottom: 20px; }
    h1 { font-size: 22px; font-weight: 700; color: #111827; margin: 0 0 4px; }
    .subtitle { color: #6b7280; font-size: 14px; margin: 0; }

    /* Date nav */
    .date-nav { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
    .nav-btn { width: 36px; height: 36px; background: white; border: 1.5px solid #e5e7eb; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #374151; flex-shrink: 0; }
    .nav-btn:hover:not(:disabled) { border-color: #16a34a; color: #16a34a; }
    .date-display-wrap { flex: 1; display: flex; justify-content: center; position: relative; }
    .date-display { font-size: 16px; font-weight: 700; color: #111827; text-transform: capitalize; cursor: pointer; padding: 4px 10px; border-radius: 8px; transition: background 0.15s; }
    .date-display:hover { background: #f0fdf4; color: #16a34a; }
    .date-picker-hidden { position: absolute; opacity: 0; pointer-events: none; width: 0; height: 0; }
    .btn-today { padding: 7px 14px; background: #f0fdf4; color: #16a34a; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; flex-shrink: 0; }

    /* Calendar */
    .cal-table { background: white; border-radius: 14px; overflow: hidden; box-shadow: 0 1px 6px rgba(0,0,0,0.06); }
    .cal-head { display: grid; grid-template-columns: 80px 1fr; padding: 10px 16px; background: #f3f4f6; font-size: 11px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; }
    .cal-row { display: grid; grid-template-columns: 80px 1fr; border-top: 1px solid #f0f0f0; align-items: stretch; min-height: 50px; background: white; }
    .cal-row.row-past { background: #fafafa; opacity: 0.4; pointer-events: none; }
    .cal-row.row-occupied { background: #f5f7ff; }

    .col-hour { display: flex; align-items: center; padding: 0 16px; border-right: 1px solid #f0f0f0; flex-shrink: 0; }
    .hour-label { font-size: 14px; font-weight: 700; color: #374151; font-variant-numeric: tabular-nums; }
    .col-patients { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; padding: 8px 14px; min-height: 50px; }

    /* Legend */
    .legend-row { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; font-size: 13px; color: #6b7280; }
    .legend-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
    .legend-dot.consulta { background: #16a34a; }
    .legend-dot.sesion { background: #1d4ed8; }
    .legend-lbl { margin-right: 6px; }

    /* Patient chips */
    .patient-chip { display: inline-flex; align-items: center; gap: 5px; background: #dcfce7; color: #166534; border-radius: 20px; padding: 4px 10px 4px 12px; font-size: 13px; font-weight: 600; white-space: nowrap; }
    .patient-chip.tipo-sesion { background: #dbeafe; color: #1d4ed8; }
    .patient-chip.tipo-sesion .btn-chip-remove { color: #1d4ed8; }
    .btn-chip-remove { display: flex; align-items: center; justify-content: center; width: 18px; height: 18px; border-radius: 50%; border: none; background: rgba(55,48,163,0.15); color: #166534; cursor: pointer; padding: 0; flex-shrink: 0; transition: all 0.15s; }
    .btn-chip-remove:hover { background: #dc2626; color: white; }

    /* Add patient button */
    .btn-add-patient { width: 28px; height: 28px; border-radius: 50%; background: #f0fdf4; color: #16a34a; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.15s; }
    .btn-add-patient:hover { background: #16a34a; color: white; }

    /* Expand */
    .btn-expand { display: flex; align-items: center; gap: 6px; margin: 10px auto 0; padding: 8px 18px; background: #f3f4f6; color: #6b7280; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
    .btn-expand:hover { background: #e5e7eb; color: #374151; }
    .loading-text { padding: 32px; text-align: center; color: #9ca3af; }

    /* Modal overlay */
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; z-index: 300; padding: 20px; backdrop-filter: blur(2px); }
    .assign-modal { background: white; border-radius: 18px; width: 100%; max-width: 420px; max-height: 80vh; display: flex; flex-direction: column; box-shadow: 0 24px 64px rgba(0,0,0,0.25); overflow: hidden; }
    .assign-modal-header { display: flex; align-items: flex-start; justify-content: space-between; padding: 20px 20px 14px; border-bottom: 1px solid #f0f0f0; flex-shrink: 0; }
    .assign-modal-header h3 { font-size: 17px; font-weight: 700; color: #111827; margin: 0 0 4px; }
    .assign-modal-time { font-size: 13px; color: #6b7280; margin: 0; display: flex; align-items: center; gap: 5px; text-transform: capitalize; }
    .btn-modal-close { width: 32px; height: 32px; border-radius: 8px; border: none; background: #f3f4f6; color: #6b7280; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.15s; }
    .btn-modal-close:hover { background: #e5e7eb; color: #111827; }

    /* Patient list */
    .patient-list { overflow-y: auto; flex: 1; padding: 8px; }
    .patient-option { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 12px 14px; border: none; border-radius: 10px; background: transparent; cursor: pointer; text-align: left; transition: background 0.12s; gap: 10px; }
    .patient-option:not(.disabled):hover { background: #f0fdf4; }
    .patient-option:not(.disabled):hover .patient-option-name { color: #16a34a; }
    .patient-option.disabled { cursor: default; opacity: 0.55; }
    .patient-option-name { font-size: 14px; font-weight: 600; color: #111827; }
    .already-badge { font-size: 11px; font-weight: 600; color: #9ca3af; background: #f3f4f6; padding: 2px 8px; border-radius: 20px; white-space: nowrap; flex-shrink: 0; }
    .modal-empty { padding: 24px 20px; color: #9ca3af; font-size: 14px; text-align: center; margin: 0; }
    .saving-dot { width: 8px; height: 8px; border-radius: 50%; background: #16a34a; animation: pulse 1s infinite; flex-shrink: 0; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }

    /* Tipo radio */
    .tipo-row { display: flex; gap: 10px; padding: 12px 20px 4px; flex-shrink: 0; }
    .tipo-opt { display: flex; align-items: center; gap: 7px; padding: 7px 14px; border-radius: 10px; border: 1.5px solid #e5e7eb; cursor: pointer; font-size: 13px; font-weight: 600; color: #374151; user-select: none; transition: all 0.15s; }
    .tipo-opt input { display: none; }
    .tipo-opt.active { border-color: #16a34a; background: #f0fdf4; }
    .tipo-opt.active:last-child { border-color: #1d4ed8; background: #eff6ff; color: #1d4ed8; }
    .tipo-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
    .tipo-dot.consulta { background: #16a34a; }
    .tipo-dot.sesion { background: #1d4ed8; }

    @media (max-width: 600px) {
      .cal-head, .cal-row { grid-template-columns: 65px 1fr; }
      .hour-label { font-size: 12px; }
      .assign-modal { max-width: 100%; margin: 0; border-radius: 18px 18px 0 0; align-self: flex-end; max-height: 85vh; }
      .modal-overlay { align-items: flex-end; padding: 0; }
    }
  `]
})
export class ProfessionalAppointmentsComponent implements OnInit {
  private api = inject(ApiService);

  patients         = signal<any[]>([]);
  rawAppts         = signal<any[]>([]);
  loadingDay       = signal(false);
  openDropdownHour = signal<number | null>(null);
  savingHour       = signal<number | null>(null);
  showFullDay      = signal(false);
  assignTipo       = signal<string>('consulta');
  assignTipoValue  = 'consulta';
  currentDate      = new Date();

  assignedTodayIds = computed(() => new Set(this.rawAppts().map(a => a.patient_doc_id)));

  hourRows = computed<HourRow[]>(() => {
    const appts = this.rawAppts();
    return Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      appointments: appts.filter(a => new Date(a.appointment_datetime).getHours() === h)
    }));
  });

  visibleRows = computed<HourRow[]>(() => {
    const rows = this.hourRows();
    if (this.showFullDay()) return rows;
    return rows.filter(r => (r.hour >= 7 && r.hour <= 21) || r.appointments.length > 0);
  });

  ngOnInit() {
    this.api.getPatients().subscribe({ next: p => this.patients.set(p) });
    this.loadDay();
  }

  loadDay() {
    this.loadingDay.set(true);
    this.openDropdownHour.set(null);
    // Intentar endpoint optimizado; si falla (backend viejo) usar getAppointments y filtrar
    this.api.getDayAppointments(this.toDateStr(this.currentDate)).subscribe({
      next: data => { this.rawAppts.set(data); this.loadingDay.set(false); },
      error: ()   => this.loadDayFallback()
    });
  }

  private loadDayFallback() {
    this.api.getAppointments().subscribe({
      next: (all: any[]) => {
        const dateStr = this.toDateStr(this.currentDate);
        const filtered = all
          .filter((a: any) => {
            if (a.status === 'cancelled') return false;
            const dt = a.appointment_datetime;
            if (!dt) return false;
            const iso = typeof dt === 'string' ? dt : (dt.seconds ? new Date(dt.seconds * 1000).toISOString() : String(dt));
            return iso.startsWith(dateStr);
          })
          .map((a: any) => ({
            ...a,
            appointment_datetime: typeof a.appointment_datetime === 'string'
              ? a.appointment_datetime
              : new Date(a.appointment_datetime.seconds * 1000).toISOString()
          }));
        this.rawAppts.set(filtered);
        this.loadingDay.set(false);
      },
      error: () => this.loadingDay.set(false)
    });
  }

  openModal(hour: number)  { this.assignTipo.set('consulta'); this.assignTipoValue = 'consulta'; this.openDropdownHour.set(hour); }
  closeModal()             { this.openDropdownHour.set(null); }

  isAssignedToday(patientDocId: string): boolean {
    return this.assignedTodayIds().has(patientDocId);
  }

  doAssign(hour: number, patient: any) {
    if (this.savingHour() !== null) return;
    this.savingHour.set(hour);
    const d = new Date(this.currentDate);
    d.setHours(hour, 0, 0, 0);
    this.api.assignAppointment({
      patient_id: patient.id,
      patient_name: `${patient.nombre} ${patient.apellido}`.trim(),
      datetime_iso: d.toISOString(),
      duration_minutes: 60,
      tipo: this.assignTipo()
    }).subscribe({
      next: () => {
        this.savingHour.set(null);
        this.closeModal();
        this.loadDay();
      },
      error: () => this.savingHour.set(null)
    });
  }

  removeAppt(id: string) {
    this.api.deleteAppointment(id).subscribe({
      next: () => this.loadDay(),
      error: () => {
        // Fallback: backend viejo no tiene DELETE, usar cancel
        this.api.cancelByProfessional(id).subscribe({ next: () => this.loadDay() });
      }
    });
  }

  isPast(hour: number): boolean {
    if (!this.isToday()) return false;
    return hour < new Date().getHours();
  }

  isToday(): boolean {
    const t = new Date();
    return this.currentDate.getFullYear() === t.getFullYear() &&
           this.currentDate.getMonth()    === t.getMonth()    &&
           this.currentDate.getDate()     === t.getDate();
  }

  prevDay() {
    if (this.isToday()) return;
    this.currentDate = new Date(this.currentDate);
    this.currentDate.setDate(this.currentDate.getDate() - 1);
    this.loadDay();
  }
  nextDay() { this.currentDate = new Date(this.currentDate); this.currentDate.setDate(this.currentDate.getDate() + 1); this.loadDay(); }
  goToday()  { this.currentDate = new Date(); this.loadDay(); }

  onDatePick(event: Event) {
    const val = (event.target as HTMLInputElement).value;
    if (!val) return;
    const [y, m, d] = val.split('-').map(Number);
    this.currentDate = new Date(y, m - 1, d);
    this.loadDay();
  }

  padHour(h: number): string { return String(h).padStart(2, '0'); }

  formatNavDate(): string {
    return this.currentDate.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  formatNavDateShort(): string {
    return this.currentDate.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  toDateStr(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}

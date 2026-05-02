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
              <!-- Hora -->
              <div class="col-hour">
                <span class="hour-label">{{ padHour(row.hour) }}:00</span>
              </div>

              <!-- Pacientes + controles -->
              <div class="col-patients">
                <!-- Chips de pacientes ya asignados -->
                @for (appt of row.appointments; track appt.id) {
                  <span class="patient-chip">
                    {{ appt.patient_name }}
                    <button class="btn-chip-remove" (click)="removeAppt(appt.id)" title="Quitar paciente">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </span>
                }

                <!-- Dropdown inline para agregar paciente -->
                @if (openDropdownHour() === row.hour) {
                  <div class="inline-assign" (click)="$event.stopPropagation()">
                    <select [(ngModel)]="selectedPatientId" class="patient-select" (ngModelChange)="onPatientChange($event)">
                      <option value="">— Seleccionar paciente —</option>
                      @for (p of patients(); track p.id) {
                        <option [value]="p.id">{{ p.apellido }}, {{ p.nombre }}</option>
                      }
                    </select>
                    <button class="btn-assign-confirm"
                      (click)="doAssign(row.hour)"
                      [disabled]="!selectedPatientId || savingHour() === row.hour">
                      {{ savingHour() === row.hour ? '...' : 'Asignar' }}
                    </button>
                    <button class="btn-assign-cancel" (click)="openDropdownHour.set(null)">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                } @else if (!isPast(row.hour)) {
                  <button class="btn-add-patient" (click)="openAdd(row.hour)" title="Agregar paciente">
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
  `,
  styles: [`
    .page { max-width: 760px; }
    .page-header { margin-bottom: 20px; }
    h1 { font-size: 22px; font-weight: 700; color: #111827; margin: 0 0 4px; }
    .subtitle { color: #6b7280; font-size: 14px; margin: 0; }

    /* Date nav */
    .date-nav { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
    .nav-btn { width: 36px; height: 36px; background: white; border: 1.5px solid #e5e7eb; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #374151; flex-shrink: 0; }
    .nav-btn:hover:not(:disabled) { border-color: #4f46e5; color: #4f46e5; }
    .date-display-wrap { flex: 1; display: flex; justify-content: center; position: relative; }
    .date-display { font-size: 16px; font-weight: 700; color: #111827; text-transform: capitalize; cursor: pointer; padding: 4px 10px; border-radius: 8px; transition: background 0.15s; }
    .date-display:hover { background: #eef2ff; color: #4f46e5; }
    .date-picker-hidden { position: absolute; opacity: 0; pointer-events: none; width: 0; height: 0; }
    .btn-today { padding: 7px 14px; background: #eef2ff; color: #4f46e5; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; flex-shrink: 0; }

    /* Calendar */
    .cal-table { background: white; border-radius: 14px; overflow: hidden; box-shadow: 0 1px 6px rgba(0,0,0,0.06); }
    .cal-head { display: grid; grid-template-columns: 80px 1fr; padding: 10px 16px; background: #f3f4f6; font-size: 11px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; }
    .cal-row { display: grid; grid-template-columns: 80px 1fr; border-top: 1px solid #f0f0f0; align-items: stretch; min-height: 50px; transition: background 0.1s; background: white; }
    .cal-row.row-past { background: #fafafa; opacity: 0.45; pointer-events: none; }
    .cal-row.row-occupied { background: #f5f7ff; }

    .col-hour { display: flex; align-items: center; padding: 0 16px; border-right: 1px solid #f0f0f0; flex-shrink: 0; }
    .hour-label { font-size: 14px; font-weight: 700; color: #374151; font-variant-numeric: tabular-nums; }
    .col-patients { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; padding: 8px 14px; min-height: 50px; }

    /* Patient chips */
    .patient-chip { display: inline-flex; align-items: center; gap: 5px; background: #e0e7ff; color: #3730a3; border-radius: 20px; padding: 4px 10px 4px 12px; font-size: 13px; font-weight: 600; white-space: nowrap; }
    .btn-chip-remove { display: flex; align-items: center; justify-content: center; width: 18px; height: 18px; border-radius: 50%; border: none; background: rgba(55,48,163,0.15); color: #3730a3; cursor: pointer; padding: 0; flex-shrink: 0; transition: all 0.15s; }
    .btn-chip-remove:hover { background: #dc2626; color: white; }

    /* Add patient button */
    .btn-add-patient { width: 28px; height: 28px; border-radius: 50%; background: #eef2ff; color: #4f46e5; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.15s; }
    .btn-add-patient:hover { background: #4f46e5; color: white; }

    /* Inline assign dropdown */
    .inline-assign { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .patient-select { padding: 6px 10px; border: 1.5px solid #c7d2fe; border-radius: 8px; font-size: 13px; outline: none; font-family: inherit; background: white; color: #111827; cursor: pointer; }
    .patient-select:focus { border-color: #4f46e5; }
    .btn-assign-confirm { padding: 6px 14px; background: #4f46e5; color: white; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap; }
    .btn-assign-confirm:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-assign-confirm:not(:disabled):hover { background: #4338ca; }
    .btn-assign-cancel { width: 28px; height: 28px; border-radius: 50%; background: #f3f4f6; color: #6b7280; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .btn-assign-cancel:hover { background: #e5e7eb; }

    .btn-expand { display: flex; align-items: center; gap: 6px; margin: 10px auto 0; padding: 8px 18px; background: #f3f4f6; color: #6b7280; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
    .btn-expand:hover { background: #e5e7eb; color: #374151; }
    .loading-text { padding: 32px; text-align: center; color: #9ca3af; }

    @media (max-width: 600px) {
      .cal-head, .cal-row { grid-template-columns: 65px 1fr; }
      .hour-label { font-size: 12px; }
      .patient-select { font-size: 12px; }
    }
  `]
})
export class ProfessionalAppointmentsComponent implements OnInit {
  private api  = inject(ApiService);

  patients        = signal<any[]>([]);
  rawAppts        = signal<any[]>([]);
  loadingDay      = signal(false);
  openDropdownHour = signal<number | null>(null);
  savingHour      = signal<number | null>(null);
  showFullDay     = signal(false);
  selectedPatientId = '';
  currentDate     = new Date();

  hourRows = computed<HourRow[]>(() => {
    const appts = this.rawAppts();
    return Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      appointments: appts.filter(a => {
        const dt = new Date(a.appointment_datetime);
        return dt.getHours() === h;
      })
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
    this.api.getDayAppointments(this.toDateStr(this.currentDate)).subscribe({
      next: data => { this.rawAppts.set(data); this.loadingDay.set(false); },
      error: ()   => this.loadingDay.set(false)
    });
  }

  openAdd(hour: number) {
    this.selectedPatientId = '';
    this.openDropdownHour.set(hour);
  }

  onPatientChange(id: string) { this.selectedPatientId = id; }

  doAssign(hour: number) {
    const patient = this.patients().find(p => p.id === this.selectedPatientId);
    if (!patient) return;
    this.savingHour.set(hour);
    const d = new Date(this.currentDate);
    d.setHours(hour, 0, 0, 0);
    this.api.assignAppointment({
      patient_id: patient.id,
      patient_name: `${patient.nombre} ${patient.apellido}`.trim(),
      datetime_iso: d.toISOString(),
      duration_minutes: 60
    }).subscribe({
      next: () => {
        this.savingHour.set(null);
        this.openDropdownHour.set(null);
        this.selectedPatientId = '';
        this.loadDay();
      },
      error: () => this.savingHour.set(null)
    });
  }

  removeAppt(id: string) {
    this.api.deleteAppointment(id).subscribe({ next: () => this.loadDay() });
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

  toDateStr(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}

import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';

interface HourRow {
  hour: number;           // 0-23
  slot: any | null;       // slot from backend, or null
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
          <p class="subtitle">Calendario de consultas</p>
        </div>
        <button class="btn-secondary-outline" (click)="showAssignForm.set(!showAssignForm())">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/>
            <line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>
          </svg>
          Asignar turno
        </button>
      </div>

      <!-- Formulario asignar turno directo -->
      @if (showAssignForm()) {
        <div class="form-card">
          <h3>Asignar turno a paciente</h3>
          <div class="fields-row">
            <div class="field">
              <label>Paciente *</label>
              <select [(ngModel)]="assignForm.patient_id" (ngModelChange)="onPatientSelect($event)">
                <option value="">— Seleccioná un paciente —</option>
                @for (p of patients(); track p.id) {
                  <option [value]="p.id">{{ p.apellido }}, {{ p.nombre }}</option>
                }
              </select>
            </div>
            <div class="field">
              <label>Fecha *</label>
              <input type="date" [(ngModel)]="assignForm.date" [min]="todayStr()" />
            </div>
            <div class="field">
              <label>Hora *</label>
              <select [(ngModel)]="assignForm.hour">
                @for (h of hours24; track h) {
                  <option [value]="h">{{ padHour(h) }}:00</option>
                }
              </select>
            </div>
          </div>
          <div class="fields-row">
            <div class="field">
              <label>Lugar de atención</label>
              <select [(ngModel)]="assignForm.lugar">
                <option value="">— Sin especificar —</option>
                @for (l of lugares(); track $index) { <option [value]="l">{{ l }}</option> }
              </select>
            </div>
            <div class="field">
              <label>Notas</label>
              <input [(ngModel)]="assignForm.notes" placeholder="Indicaciones, motivo..." />
            </div>
          </div>
          @if (assignError()) { <div class="error-banner">{{ assignError() }}</div> }
          @if (assignSuccess()) { <div class="success-banner">¡Turno asignado correctamente!</div> }
          <div class="form-actions">
            <button class="btn-secondary" (click)="showAssignForm.set(false)">Cancelar</button>
            <button class="btn-primary" (click)="assignAppt()" [disabled]="savingAssign() || !assignForm.patient_id || !assignForm.date">
              {{ savingAssign() ? 'Asignando...' : 'Asignar turno' }}
            </button>
          </div>
        </div>
      }

      <!-- Tabs -->
      <div class="tabs">
        <button class="tab" [class.active]="activeTab() === 'calendar'" (click)="activeTab.set('calendar')">
          Calendario
        </button>
        <button class="tab" [class.active]="activeTab() === 'pending'" (click)="activeTab.set('pending')">
          Solicitudes
          @if (pendingCount() > 0) { <span class="badge-red">{{ pendingCount() }}</span> }
        </button>
      </div>

      <!-- ── CALENDARIO ── -->
      @if (activeTab() === 'calendar') {
        <div class="date-nav">
          <button class="nav-btn" (click)="prevDay()" [disabled]="isToday()" [style.opacity]="isToday() ? '0.3' : '1'" [style.cursor]="isToday() ? 'not-allowed' : 'pointer'">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div class="date-display-wrap">
            <span class="date-display" (click)="datePickerRef.showPicker()">{{ formatNavDate() }}</span>
            <input #datePickerRef type="date" class="date-picker-hidden" [min]="todayStr()" [value]="toDateStr(currentDate)" (change)="onDatePick($event)" />
          </div>
          <button class="nav-btn" (click)="nextDay()">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
          <button class="btn-today" (click)="goToday()">Hoy</button>
        </div>

        <div class="legend">
          <span class="leg available">Disponible</span>
          <span class="leg pending">Pendiente</span>
          <span class="leg occupied">Confirmado</span>
          <span class="leg disabled">Sin horario — clic para agregar</span>
        </div>

        @if (loadingDay()) {
          <div class="loading-text">Cargando...</div>
        } @else {
          <div class="cal-table">
            <div class="cal-head">
              <span class="col-hour">Hora</span>
              <span class="col-patient">Paciente</span>
              <span class="col-sede">Sede</span>
              <span class="col-actions"></span>
            </div>
            @for (row of visibleRows(); track row.hour) {
              <div class="cal-row" [class]="rowClass(row)" (click)="onRowClick(row)">
                <div class="col-hour">
                  <span class="hour-label">{{ padHour(row.hour) }}:00</span>
                </div>

                @if (row.slot === null) {
                  <!-- Hora vacía: click para agregar -->
                  <div class="col-patient empty-hint">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Agregar horario
                  </div>
                  <div class="col-sede"></div>
                  <div class="col-actions"></div>
                } @else {
                  <!-- Slot existente -->
                  <div class="col-patient" (click)="$event.stopPropagation()">
                    @if (!row.slot.booked) {
                      <span class="pill available">Disponible</span>
                      <button class="btn-xs red" (click)="deleteSlot(row.slot.id)">Eliminar</button>
                    } @else if (row.slot.appointment_status === 'pending_confirmation') {
                      <span class="pill pending">{{ row.slot.patient_name || 'Solicitud pendiente' }}</span>
                      <button class="btn-xs green" (click)="confirmAppt(row.slot.appointment_id)">✓ Confirmar</button>
                      <button class="btn-xs red" (click)="rejectAppt(row.slot.appointment_id)">✕ Rechazar</button>
                    } @else if (row.slot.appointment_status === 'cancelled') {
                      <span class="pill cancelled">Cancelado</span>
                    } @else {
                      <span class="pill occupied">{{ row.slot.patient_name || 'Paciente' }}</span>
                      <button class="btn-xs red" (click)="openCancelModal(row.slot)">Cancelar turno</button>
                    }
                  </div>
                  <div class="col-sede" (click)="$event.stopPropagation()">
                    <span>{{ row.slot.lugar || '—' }}</span>
                  </div>
                  <div class="col-actions" (click)="$event.stopPropagation()">
                    <span class="dur-label">{{ row.slot.duration_minutes }} min</span>
                  </div>
                }
              </div>
            }
          </div>
          <button class="btn-expand" (click)="showFullDay.set(!showFullDay())">
            @if (showFullDay()) {
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>
              Mostrar menos
            } @else {
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
              Ver horario completo (00:00 – 06:00 y 22:00 – 23:00)
            }
          </button>
        }
      }

      <!-- ── SOLICITUDES ── -->
      @if (activeTab() === 'pending') {
        @if (pendingAppts().length === 0) {
          <div class="empty-state"><p>No hay solicitudes pendientes</p></div>
        } @else {
          <div class="appt-list">
            @for (appt of pendingAppts(); track appt.id) {
              <div class="appt-card">
                <div class="appt-dt">
                  <span class="appt-day">{{ formatDay(appt.appointment_datetime) }}</span>
                  <span class="appt-month">{{ formatMonth(appt.appointment_datetime) }}</span>
                  <span class="appt-time-sm">{{ formatTime(appt.appointment_datetime) }}</span>
                </div>
                <div class="appt-info">
                  <h4>{{ appt.patient_name }}</h4>
                  @if (appt.lugar) { <p class="appt-lugar">📍 {{ appt.lugar }}</p> }
                  @if (appt.notes) { <p class="appt-notes">{{ appt.notes }}</p> }
                  <span class="dur-label">{{ appt.duration_minutes }} min</span>
                </div>
                <div class="appt-actions">
                  <button class="btn-sm green" (click)="confirmApptDirect(appt.id)">✓ Confirmar</button>
                  <button class="btn-sm red" (click)="rejectApptDirect(appt.id)">✕ Rechazar</button>
                </div>
              </div>
            }
          </div>
        }
      }
    </div>

    <!-- Modal: agregar horario desde tabla -->
    @if (newSlotHour() !== null) {
      <div class="modal-overlay" (click)="newSlotHour.set(null)">
        <div class="modal" (click)="$event.stopPropagation()">
          <h3>Agregar horario — {{ padHour(newSlotHour()!) }}:00</h3>
          <p class="modal-date">{{ formatNavDate() }}</p>
          <div class="field">
            <label>Duración</label>
            <input type="text" value="60 min" disabled style="background:#f3f4f6;color:#6b7280;cursor:not-allowed" />
          </div>
          <div class="field">
            <label>Lugar de atención</label>
            <select [(ngModel)]="newSlot.lugar">
              <option value="">— Sin especificar —</option>
              @for (l of lugares(); track $index) { <option [value]="l">{{ l }}</option> }
            </select>
          </div>
          <div class="field">
            <label>Notas (opcional)</label>
            <input [(ngModel)]="newSlot.notes" placeholder="Ej: Solo primera consulta" />
          </div>
          <div class="modal-actions">
            <button class="btn-secondary" (click)="newSlotHour.set(null)">Cancelar</button>
            <button class="btn-primary" (click)="createSlotFromRow()" [disabled]="savingSlot()">
              {{ savingSlot() ? 'Guardando...' : 'Agregar horario' }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Modal: cancelar turno -->
    @if (cancelSlotData()) {
      <div class="modal-overlay" (click)="cancelSlotData.set(null)">
        <div class="modal" (click)="$event.stopPropagation()">
          <h3>¿Cancelar turno?</h3>
          <p>Se liberará el horario y se notificará al paciente por email.</p>
          <div class="modal-actions">
            <button class="btn-secondary" (click)="cancelSlotData.set(null)">No, mantener</button>
            <button class="btn-danger" (click)="confirmCancelSlot()">Sí, cancelar</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .page { max-width: 860px; }
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; flex-wrap: wrap; gap: 12px; }
    h1 { font-size: 22px; font-weight: 700; color: #111827; margin: 0 0 4px; }
    .subtitle { color: #6b7280; font-size: 14px; margin: 0; }

    /* Form card */
    .form-card { background: white; border-radius: 14px; padding: 22px; margin-bottom: 20px; box-shadow: 0 1px 6px rgba(0,0,0,0.07); }
    .form-card h3 { font-size: 15px; font-weight: 700; color: #111827; margin: 0 0 14px; }
    .fields-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; margin-bottom: 10px; }
    .field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; }
    label { font-size: 13px; font-weight: 500; color: #374151; }
    input, select { padding: 10px 12px; border: 1.5px solid #e5e7eb; border-radius: 8px; font-size: 14px; outline: none; font-family: inherit; width: 100%; box-sizing: border-box; }
    input:focus, select:focus { border-color: #4f46e5; }
    .form-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 6px; }

    /* Tabs */
    .tabs { display: flex; gap: 4px; background: #f3f4f6; border-radius: 10px; padding: 4px; margin-bottom: 20px; }
    .tab { flex: 1; padding: 9px 16px; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 500; color: #6b7280; background: transparent; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.15s; }
    .tab.active { background: white; color: #111827; box-shadow: 0 1px 4px rgba(0,0,0,0.08); font-weight: 700; }
    .badge-red { background: #fef2f2; color: #dc2626; border-radius: 20px; padding: 1px 8px; font-size: 11px; font-weight: 700; }

    /* Date nav */
    .date-nav { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
    .nav-btn { width: 36px; height: 36px; background: white; border: 1.5px solid #e5e7eb; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #374151; flex-shrink: 0; }
    .nav-btn:hover { border-color: #4f46e5; color: #4f46e5; }
    .date-display-wrap { flex: 1; display: flex; justify-content: center; position: relative; }
    .date-display { font-size: 16px; font-weight: 700; color: #111827; text-transform: capitalize; cursor: pointer; padding: 4px 10px; border-radius: 8px; transition: background 0.15s; }
    .date-display:hover { background: #eef2ff; color: #4f46e5; }
    .date-picker-hidden { position: absolute; opacity: 0; pointer-events: none; width: 0; height: 0; }
    .btn-today { padding: 7px 14px; background: #eef2ff; color: #4f46e5; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; flex-shrink: 0; }

    /* Legend */
    .legend { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 12px; }
    .leg { font-size: 12px; font-weight: 600; padding: 3px 10px; border-radius: 20px; }
    .leg.available { background: #dcfce7; color: #15803d; }
    .leg.pending { background: #fef9c3; color: #a16207; }
    .leg.occupied { background: #e0e7ff; color: #3730a3; }
    .leg.disabled { background: #f3f4f6; color: #9ca3af; }

    /* Calendar table */
    .cal-table { background: white; border-radius: 14px; overflow: hidden; box-shadow: 0 1px 6px rgba(0,0,0,0.06); }
    .cal-head { display: grid; grid-template-columns: 80px 1fr 160px 80px; padding: 10px 16px; background: #f3f4f6; font-size: 11px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; }
    .cal-row { display: grid; grid-template-columns: 80px 1fr 160px 80px; padding: 0; border-top: 1px solid #f0f0f0; align-items: stretch; min-height: 48px; transition: background 0.1s; }

    /* Row states */
    .cal-row.row-empty { background: white; cursor: pointer; }
    .cal-row.row-empty:hover { background: #f9fafb; }
    .cal-row.row-empty:hover .empty-hint { color: #4f46e5; }
    .cal-row.row-past { background: #fafafa; cursor: default; opacity: 0.45; }
    .cal-row.row-available { background: #f0fdf4; }
    .cal-row.row-pending { background: #fefce8; }
    .cal-row.row-occupied { background: #eef2ff; }
    .cal-row.row-cancelled { background: #fef2f2; opacity: 0.7; }

    .col-hour { display: flex; align-items: center; padding: 0 16px; border-right: 1px solid #f0f0f0; }
    .hour-label { font-size: 14px; font-weight: 700; color: #374151; font-variant-numeric: tabular-nums; }
    .col-patient { display: flex; align-items: center; gap: 8px; padding: 10px 14px; flex-wrap: wrap; }
    .col-sede { display: flex; align-items: center; padding: 0 12px; font-size: 13px; color: #374151; border-left: 1px solid #f0f0f0; }
    .col-actions { display: flex; align-items: center; justify-content: flex-end; padding: 0 12px; border-left: 1px solid #f0f0f0; }

    .empty-hint { font-size: 12px; color: #d1d5db; font-weight: 500; display: flex; align-items: center; gap: 6px; }

    /* Pills */
    .pill { padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 700; white-space: nowrap; }
    .pill.available { background: #dcfce7; color: #15803d; }
    .pill.pending { background: #fef9c3; color: #a16207; }
    .pill.occupied { background: #e0e7ff; color: #3730a3; }
    .pill.cancelled { background: #fee2e2; color: #991b1b; }
    .dur-label { font-size: 11px; color: #9ca3af; }

    /* Pending list */
    .appt-list { display: flex; flex-direction: column; gap: 10px; }
    .appt-card { display: flex; align-items: center; gap: 16px; background: white; border-radius: 14px; padding: 16px 20px; box-shadow: 0 1px 4px rgba(0,0,0,0.05); border-left: 4px solid #f59e0b; }
    .appt-dt { text-align: center; min-width: 52px; }
    .appt-day { display: block; font-size: 24px; font-weight: 700; color: #4f46e5; line-height: 1; }
    .appt-month { display: block; font-size: 11px; font-weight: 600; color: #9ca3af; text-transform: uppercase; }
    .appt-time-sm { display: block; font-size: 13px; font-weight: 500; color: #374151; margin-top: 2px; }
    .appt-info { flex: 1; }
    .appt-info h4 { font-size: 15px; font-weight: 600; color: #111827; margin: 0 0 3px; }
    .appt-lugar { font-size: 12px; color: #4f46e5; margin: 0 0 2px; }
    .appt-notes { font-size: 13px; color: #6b7280; margin: 0 0 2px; }
    .appt-actions { display: flex; flex-direction: column; gap: 6px; }

    /* Buttons */
    .btn-primary { display: flex; align-items: center; gap: 8px; padding: 10px 18px; background: #4f46e5; color: white; border: none; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-secondary { padding: 10px 18px; background: #f3f4f6; color: #374151; border: none; border-radius: 10px; font-size: 14px; cursor: pointer; }
    .btn-secondary-outline { display: flex; align-items: center; gap: 8px; padding: 10px 16px; background: white; color: #4f46e5; border: 1.5px solid #c7d2fe; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; }
    .btn-secondary-outline:hover { background: #eef2ff; }
    .btn-xs { padding: 4px 10px; border: none; border-radius: 6px; font-size: 12px; cursor: pointer; font-weight: 600; white-space: nowrap; }
    .btn-xs.red { background: #fee2e2; color: #991b1b; }
    .btn-xs.green { background: #dcfce7; color: #15803d; }
    .btn-sm { padding: 7px 14px; border: none; border-radius: 8px; font-size: 13px; cursor: pointer; font-weight: 600; }
    .btn-sm.red { background: #fee2e2; color: #991b1b; }
    .btn-sm.green { background: #dcfce7; color: #15803d; }
    .btn-danger { padding: 8px 16px; background: #dc2626; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }

    /* Modal */
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 200; padding: 16px; }
    .modal { background: white; border-radius: 16px; padding: 28px; max-width: 420px; width: 100%; box-shadow: 0 20px 60px rgba(0,0,0,0.2); }
    .modal h3 { font-size: 18px; font-weight: 700; color: #111827; margin: 0 0 2px; }
    .modal-date { font-size: 13px; color: #6b7280; margin: 0 0 20px; text-transform: capitalize; }
    .modal p { font-size: 14px; color: #6b7280; margin: 0 0 20px; line-height: 1.5; }
    .modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px; }

    .btn-expand { display: flex; align-items: center; gap: 6px; margin: 10px auto 0; padding: 8px 18px; background: #f3f4f6; color: #6b7280; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
    .btn-expand:hover { background: #e5e7eb; color: #374151; }
    .loading-text { padding: 32px; text-align: center; color: #9ca3af; }
    .empty-state { text-align: center; padding: 48px; color: #9ca3af; }
    .error-banner { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 8px; padding: 10px 14px; font-size: 13px; margin: 10px 0 0; }
    .success-banner { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; border-radius: 8px; padding: 10px 14px; font-size: 13px; margin: 10px 0 0; }

    @media (max-width: 640px) {
      .fields-row { grid-template-columns: 1fr; }
      .cal-head, .cal-row { grid-template-columns: 70px 1fr 60px; }
      .cal-head span:nth-child(3), .col-sede, .col-actions { display: none; }
    }
  `]
})
export class ProfessionalAppointmentsComponent implements OnInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);

  patients = signal<any[]>([]);
  lugares = signal<string[]>([]);
  rawSlots = signal<any[]>([]);
  pendingAppts = signal<any[]>([]);
  loadingDay = signal(false);
  showAssignForm = signal(false);
  savingSlot = signal(false);
  savingAssign = signal(false);
  assignError = signal('');
  assignSuccess = signal(false);
  activeTab = signal<'calendar' | 'pending'>('calendar');
  cancelSlotData = signal<any>(null);
  newSlotHour = signal<number | null>(null);

  currentDate = new Date();
  newSlot = { duration_minutes: 60, notes: '', lugar: '' };
  assignForm = { patient_id: '', patient_name: '', date: '', hour: 9, notes: '', lugar: '' };
  hours24 = Array.from({ length: 24 }, (_, i) => i);

  showFullDay = signal(false);
  pendingCount = computed(() => this.pendingAppts().length);

  /** Genera filas para las 24 horas, mapeando slots existentes */
  hourRows = computed<HourRow[]>(() => {
    const slots = this.rawSlots();
    const rows: HourRow[] = [];
    for (let h = 0; h < 24; h++) {
      const slot = slots.find(s => {
        const dt = s.datetime?.seconds ? new Date(s.datetime.seconds * 1000) : new Date(s.datetime);
        return dt.getHours() === h;
      }) ?? null;
      rows.push({ hour: h, slot });
    }
    return rows;
  });

  /** Filas visibles: 07-21 por defecto (más cualquier hora con slot), todas 00-23 si showFullDay */
  visibleRows = computed<HourRow[]>(() => {
    if (this.showFullDay()) return this.hourRows();
    return this.hourRows().filter(r => r.hour >= 7 && r.hour <= 21 || r.slot !== null);
  });

  ngOnInit() {
    this.api.getPatients().subscribe({ next: (p) => this.patients.set(p) });
    this.api.getProfessionalProfile().subscribe({ next: (prof) => this.lugares.set(prof.lugares_atencion || []) });
    this.loadDay();
    this.loadPending();
  }

  loadDay() {
    const uid = this.auth.currentUser?.uid;
    if (!uid) return;
    this.loadingDay.set(true);
    this.api.getDaySlots(uid, this.toDateStr(this.currentDate)).subscribe({
      next: (slots) => { this.rawSlots.set(slots); this.loadingDay.set(false); },
      error: () => this.loadingDay.set(false)
    });
  }

  loadPending() {
    this.api.getAppointments().subscribe({
      next: (data) => {
        const now = new Date();
        this.pendingAppts.set(
          data.filter((a: any) => {
            if (a.status !== 'pending_confirmation') return false;
            const d = a.appointment_datetime?.seconds ? new Date(a.appointment_datetime.seconds * 1000) : new Date(a.appointment_datetime);
            return d >= now;
          }).sort((a: any, b: any) => (a.appointment_datetime?.seconds || 0) - (b.appointment_datetime?.seconds || 0))
        );
      }
    });
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

  rowClass(row: HourRow): string {
    if (!row.slot) {
      if (this.isToday() && row.hour <= new Date().getHours()) return 'row-past';
      return 'row-empty';
    }
    const s = row.slot.appointment_status || '';
    if (!row.slot.booked) return 'row-available';
    if (s === 'pending_confirmation') return 'row-pending';
    if (s === 'cancelled') return 'row-cancelled';
    return 'row-occupied';
  }

  onRowClick(row: HourRow) {
    if (row.slot) return;
    if (this.isToday() && row.hour <= new Date().getHours()) return; // hora pasada hoy
    this.newSlot = { duration_minutes: 60, notes: '', lugar: '' };
    this.newSlotHour.set(row.hour);
  }

  createSlotFromRow() {
    const hour = this.newSlotHour();
    if (hour === null) return;
    this.savingSlot.set(true);
    const d = new Date(this.currentDate);
    d.setHours(hour, 0, 0, 0);
    const utcIso = d.toISOString();
    this.api.createSlot({ ...this.newSlot, duration_minutes: 60, datetime_iso: utcIso }).subscribe({
      next: () => {
        this.savingSlot.set(false);
        this.newSlotHour.set(null);
        this.loadDay();
      },
      error: () => this.savingSlot.set(false)
    });
  }

  deleteSlot(id: string) {
    this.api.deleteSlot(id).subscribe({ next: () => this.loadDay() });
  }

  confirmAppt(appointmentId: string) {
    this.api.confirmAppointment(appointmentId).subscribe({ next: () => { this.loadDay(); this.loadPending(); } });
  }

  rejectAppt(appointmentId: string) {
    this.api.rejectAppointment(appointmentId).subscribe({ next: () => { this.loadDay(); this.loadPending(); } });
  }

  confirmApptDirect(id: string) { this.confirmAppt(id); }
  rejectApptDirect(id: string) { this.rejectAppt(id); }

  openCancelModal(slot: any) { this.cancelSlotData.set(slot); }

  confirmCancelSlot() {
    const slot = this.cancelSlotData();
    if (!slot?.appointment_id) return;
    this.api.cancelByProfessional(slot.appointment_id).subscribe({
      next: () => { this.cancelSlotData.set(null); this.loadDay(); this.loadPending(); }
    });
  }

  onPatientSelect(id: string) {
    const p = this.patients().find(x => x.id === id);
    this.assignForm.patient_name = p ? `${p.nombre} ${p.apellido}` : '';
  }

  assignAppt() {
    if (!this.assignForm.date) return;
    const d = new Date(`${this.assignForm.date}T${this.padHour(this.assignForm.hour)}:00:00`);
    if (d <= new Date()) {
      this.assignError.set('No se pueden asignar turnos en horarios ya transcurridos');
      return;
    }
    this.savingAssign.set(true);
    this.assignError.set('');
    this.assignSuccess.set(false);
    const datetimeIso = d.toISOString();
    this.api.assignAppointment({
      patient_id: this.assignForm.patient_id,
      patient_name: this.assignForm.patient_name,
      datetime_iso: datetimeIso,
      duration_minutes: 60,
      notes: this.assignForm.notes,
      lugar: this.assignForm.lugar
    }).subscribe({
      next: () => {
        this.savingAssign.set(false);
        this.assignSuccess.set(true);
        this.assignForm = { patient_id: '', patient_name: '', date: '', hour: 9, notes: '', lugar: '' };
        this.loadDay();
        setTimeout(() => { this.showAssignForm.set(false); this.assignSuccess.set(false); }, 2000);
      },
      error: (err) => { this.savingAssign.set(false); this.assignError.set(err.error?.detail || 'Error al asignar el turno'); }
    });
  }

  todayStr(): string { return this.toDateStr(new Date()); }

  onDatePick(event: Event) {
    const val = (event.target as HTMLInputElement).value;
    if (!val) return;
    const [y, m, d] = val.split('-').map(Number);
    const picked = new Date(y, m - 1, d);
    this.currentDate = picked;
    this.loadDay();
  }

  padHour(h: number): string { return String(h).padStart(2, '0'); }

  formatNavDate(): string {
    return this.currentDate.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  formatDay(dt: any): string {
    if (!dt) return '';
    try { return (dt.seconds ? new Date(dt.seconds * 1000) : new Date(dt)).getDate().toString(); } catch { return ''; }
  }

  formatMonth(dt: any): string {
    if (!dt) return '';
    try { return (dt.seconds ? new Date(dt.seconds * 1000) : new Date(dt)).toLocaleDateString('es-AR', { month: 'short' }).toUpperCase(); } catch { return ''; }
  }

  formatTime(dt: any): string {
    if (!dt) return '';
    try { return (dt.seconds ? new Date(dt.seconds * 1000) : new Date(dt)).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
  }

  toDateStr(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}

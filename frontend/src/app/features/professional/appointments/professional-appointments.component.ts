import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

interface HourRow { hour: number; appointments: any[]; }

@Component({
  selector: 'app-professional-appointments',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Turnos</h1>
          <p class="subtitle">{{ viewMode() === 'day' ? 'Agenda del día' : 'Agenda semanal' }}</p>
        </div>
        <div class="view-toggle">
          <button [class.active]="viewMode() === 'day'" (click)="switchView('day')">Día</button>
          <button [class.active]="viewMode() === 'week'" (click)="switchView('week')">Semana</button>
        </div>
      </div>

      <!-- Navegación de fecha -->
      <div class="date-nav">
        <button class="nav-btn" (click)="prevPeriod()"
          [disabled]="viewMode() === 'day' && isToday()"
          [style.opacity]="viewMode() === 'day' && isToday() ? '0.3' : '1'"
          [style.cursor]="viewMode() === 'day' && isToday() ? 'not-allowed' : 'pointer'">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div class="date-display-wrap">
          <span class="date-display" (click)="datePickerRef.showPicker()">{{ formatNavDate() }}</span>
          <input #datePickerRef type="date" class="date-picker-hidden" [value]="toDateStr(currentDate())" (change)="onDatePick($event)" />
        </div>
        <button class="nav-btn" (click)="nextPeriod()">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
        <button class="btn-today" (click)="goToday()">Hoy</button>
      </div>

      <!-- Leyenda -->
      <div class="legend-row">
        <span class="legend-dot consulta"></span><span class="legend-lbl">Consulta</span>
        <span class="legend-dot sesion"></span><span class="legend-lbl">Sesión</span>
      </div>

      <!-- ── Vista Día ── -->
      @if (viewMode() === 'day') {
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
      }

      <!-- ── Vista Semana ── -->
      @if (viewMode() === 'week') {
        @if (loadingWeek()) {
          <div class="loading-text">Cargando semana...</div>
        } @else {
          <div class="week-wrap">
            <div class="week-grid">
              <!-- Cabecera días -->
              <div class="wg-corner"></div>
              @for (d of weekDates(); track toDateStr(d)) {
                <div class="wg-head" [class.wg-today-col]="isDateToday(d)">
                  <span class="wg-dow">{{ formatDow(d) }}</span>
                  <span class="wg-day-num" [class.wg-today-num]="isDateToday(d)">{{ d.getDate() }}</span>
                </div>
              }
              <!-- Filas de horas -->
              @for (hour of weekVisibleHours(); track hour) {
                <div class="wg-hour">{{ padHour(hour) }}:00</div>
                @for (d of weekDates(); track toDateStr(d)) {
                  <div class="wg-cell" [class.wg-past]="isDateTimePast(d, hour)">
                    @for (appt of getWeekCellAppts(d, hour); track appt.id) {
                      <span class="patient-chip-sm" [class.tipo-sesion]="appt.tipo === 'sesion'">
                        {{ appt.patient_name }}
                        <button class="btn-chip-remove-sm" (click)="removeAppt(appt.id)" title="Quitar">
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      </span>
                    }
                    @if (!isDateTimePast(d, hour)) {
                      <button class="btn-add-sm" (click)="openModal(hour, toDateStr(d))" title="Agregar">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      </button>
                    }
                  </div>
                }
              }
            </div>
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
      }
    </div>

    <!-- ── Modal overlay ── -->
    @if (modalHour() !== null) {
      <div class="modal-overlay" (click)="closeModal()">
        <div class="assign-modal" (click)="$event.stopPropagation()">
          <div class="assign-modal-header">
            <div>
              <h3>{{ modalStep() === 1 ? 'Asignar paciente' : 'Seleccionar fechas' }}</h3>
              <p class="assign-modal-time">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                {{ padHour(modalHour()!) }}:00 — {{ formatDateShort(modalBaseDate()) }}
              </p>
            </div>
            <button class="btn-modal-close" (click)="closeModal()">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          <!-- Paso 1: elegir tipo + paciente -->
          @if (modalStep() === 1) {
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
                  @if (isPatientOnDate(p.id, toDateStr(modalBaseDate()))) {
                    <div class="patient-option disabled">
                      <span class="patient-option-name">{{ p.apellido }}, {{ p.nombre }}</span>
                      <span class="already-badge">Ya tiene turno ese día</span>
                    </div>
                  } @else {
                    <button class="patient-option" (click)="selectPatient(p)">
                      <span class="patient-option-name">{{ p.apellido }}, {{ p.nombre }}</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>
                  }
                }
              </div>
            }
            <!-- Opción: paciente no registrado -->
            <div class="guest-section">
              <div class="guest-divider"><span>o</span></div>
              @if (!guestMode()) {
                <button class="btn-guest" (click)="guestMode.set(true)">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                  Otro (sin registrar)
                </button>
              } @else {
                <div class="guest-input-wrap">
                  <label class="guest-label">Nombre del paciente</label>
                  <input class="guest-input" [(ngModel)]="guestName" placeholder="Ej: Juan García" (keydown.enter)="selectGuest()" autofocus />
                  <div class="guest-actions">
                    <button class="btn-guest-cancel" (click)="guestMode.set(false); guestName = ''">Cancelar</button>
                    <button class="btn-guest-ok" [disabled]="!guestName.trim()" (click)="selectGuest()">Continuar →</button>
                  </div>
                </div>
              }
            </div>
          }

          <!-- Paso 2: elegir fechas -->
          @if (modalStep() === 2) {
            <div class="modal-step2">
              <div class="step2-patient-info">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#166534" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                <span>{{ selectedPatient()?.apellido }}, {{ selectedPatient()?.nombre }}</span>
              </div>
              <p class="step2-hint">Seleccioná los días para asignar este turno:</p>
              <div class="date-opts-list">
                @for (opt of dateOptions(); track opt.dateStr) {
                  <label class="date-opt"
                    [class.checked]="modalDates().has(opt.dateStr)"
                    [class.taken]="isPatientOnDate(selectedPatient()?.id, opt.dateStr)">
                    <input type="checkbox"
                      [checked]="modalDates().has(opt.dateStr)"
                      [disabled]="isPatientOnDate(selectedPatient()?.id, opt.dateStr)"
                      (change)="toggleDate(opt.dateStr)" />
                    <span class="date-opt-label">{{ opt.label }}</span>
                    @if (isPatientOnDate(selectedPatient()?.id, opt.dateStr)) {
                      <span class="already-badge">Ya asignado</span>
                    }
                  </label>
                }
              </div>
              <div class="step2-actions">
                <button class="btn-back-step" (click)="modalStep.set(1)">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                  Volver
                </button>
                <button class="btn-assign-multi"
                  [disabled]="modalDates().size === 0 || savingHour() !== null"
                  (click)="doAssignMulti()">
                  @if (savingHour() !== null) {
                    <span class="saving-dot"></span> Asignando...
                  } @else {
                    Asignar {{ modalDates().size }} turno{{ modalDates().size !== 1 ? 's' : '' }}
                  }
                </button>
              </div>
            </div>
          }
        </div>
      </div>
    }
  `,
  styles: [`
    .page { max-width: 900px; }
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; gap: 12px; flex-wrap: wrap; }
    h1 { font-size: 22px; font-weight: 700; color: #111827; margin: 0 0 4px; }
    .subtitle { color: #6b7280; font-size: 14px; margin: 0; }

    /* View toggle */
    .view-toggle { display: flex; background: #f3f4f6; border-radius: 8px; padding: 3px; gap: 2px; flex-shrink: 0; }
    .view-toggle button { padding: 5px 16px; border: none; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; color: #6b7280; background: transparent; transition: all 0.15s; }
    .view-toggle button.active { background: white; color: #111827; box-shadow: 0 1px 3px rgba(0,0,0,0.12); }

    /* Date nav */
    .date-nav { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
    .nav-btn { width: 36px; height: 36px; background: white; border: 1.5px solid #e5e7eb; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #374151; flex-shrink: 0; }
    .nav-btn:hover:not(:disabled) { border-color: #16a34a; color: #16a34a; }
    .date-display-wrap { flex: 1; display: flex; justify-content: center; position: relative; }
    .date-display { font-size: 15px; font-weight: 700; color: #111827; text-transform: capitalize; cursor: pointer; padding: 4px 10px; border-radius: 8px; transition: background 0.15s; }
    .date-display:hover { background: #f0fdf4; color: #16a34a; }
    .date-picker-hidden { position: absolute; opacity: 0; pointer-events: none; width: 0; height: 0; }
    .btn-today { padding: 7px 14px; background: #f0fdf4; color: #16a34a; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; flex-shrink: 0; }

    /* Legend */
    .legend-row { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; font-size: 13px; color: #6b7280; }
    .legend-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
    .legend-dot.consulta { background: #16a34a; }
    .legend-dot.sesion { background: #1d4ed8; }
    .legend-lbl { margin-right: 6px; }

    /* ── Day view ── */
    .cal-table { background: white; border-radius: 14px; overflow: hidden; box-shadow: 0 1px 6px rgba(0,0,0,0.06); }
    .cal-head { display: grid; grid-template-columns: 80px 1fr; padding: 10px 16px; background: #f3f4f6; font-size: 11px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; }
    .cal-row { display: grid; grid-template-columns: 80px 1fr; border-top: 1px solid #f0f0f0; align-items: stretch; min-height: 50px; background: white; }
    .cal-row.row-past { background: #fafafa; opacity: 0.4; pointer-events: none; }
    .cal-row.row-occupied { background: #f5f7ff; }
    .col-hour { display: flex; align-items: center; padding: 0 16px; border-right: 1px solid #f0f0f0; flex-shrink: 0; }
    .hour-label { font-size: 14px; font-weight: 700; color: #374151; font-variant-numeric: tabular-nums; }
    .col-patients { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; padding: 8px 14px; min-height: 50px; }

    /* Patient chips */
    .patient-chip { display: inline-flex; align-items: center; gap: 5px; background: #dcfce7; color: #166534; border-radius: 20px; padding: 4px 10px 4px 12px; font-size: 13px; font-weight: 600; white-space: nowrap; }
    .patient-chip.tipo-sesion { background: #dbeafe; color: #1d4ed8; }
    .btn-chip-remove { display: flex; align-items: center; justify-content: center; width: 18px; height: 18px; border-radius: 50%; border: none; background: rgba(0,0,0,0.08); color: currentColor; cursor: pointer; padding: 0; flex-shrink: 0; transition: all 0.15s; }
    .btn-chip-remove:hover { background: #dc2626; color: white; }
    .btn-add-patient { width: 28px; height: 28px; border-radius: 50%; background: #f0fdf4; color: #16a34a; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.15s; }
    .btn-add-patient:hover { background: #16a34a; color: white; }

    /* ── Week view ── */
    .week-wrap { overflow-x: auto; border-radius: 14px; box-shadow: 0 1px 6px rgba(0,0,0,0.06); }
    .week-grid { display: grid; grid-template-columns: 62px repeat(7, minmax(90px, 1fr)); min-width: 720px; background: white; border-radius: 14px; overflow: hidden; }
    .wg-corner { background: #f3f4f6; border-bottom: 1px solid #e5e7eb; }
    .wg-head { background: #f3f4f6; padding: 8px 4px 6px; text-align: center; border-left: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; }
    .wg-head.wg-today-col { background: #f0fdf4; }
    .wg-dow { display: block; font-size: 10px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 4px; }
    .wg-day-num { display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; font-size: 13px; font-weight: 700; color: #374151; border-radius: 50%; }
    .wg-today-num { background: #16a34a; color: white; }
    .wg-hour { display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: #9ca3af; background: #fafafa; border-top: 1px solid #f0f0f0; min-height: 52px; font-variant-numeric: tabular-nums; padding: 0 4px; }
    .wg-cell { border-left: 1px solid #f0f0f0; border-top: 1px solid #f0f0f0; padding: 4px 5px; display: flex; flex-wrap: wrap; gap: 3px; align-items: flex-start; align-content: flex-start; min-height: 52px; }
    .wg-cell.wg-past { background: #fafafa; opacity: 0.35; pointer-events: none; }
    .patient-chip-sm { display: inline-flex; align-items: center; gap: 3px; background: #dcfce7; color: #166534; border-radius: 10px; padding: 2px 5px 2px 7px; font-size: 11px; font-weight: 600; white-space: nowrap; max-width: 100%; overflow: hidden; }
    .patient-chip-sm.tipo-sesion { background: #dbeafe; color: #1d4ed8; }
    .btn-chip-remove-sm { display: flex; align-items: center; justify-content: center; width: 14px; height: 14px; border-radius: 50%; border: none; background: rgba(0,0,0,0.08); color: currentColor; cursor: pointer; padding: 0; flex-shrink: 0; }
    .btn-chip-remove-sm:hover { background: #dc2626; color: white; }
    .btn-add-sm { width: 20px; height: 20px; border-radius: 50%; background: #f0fdf4; color: #16a34a; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.15s; padding: 0; }
    .btn-add-sm:hover { background: #16a34a; color: white; }

    /* Expand */
    .btn-expand { display: flex; align-items: center; gap: 6px; margin: 10px auto 0; padding: 8px 18px; background: #f3f4f6; color: #6b7280; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
    .btn-expand:hover { background: #e5e7eb; color: #374151; }
    .loading-text { padding: 32px; text-align: center; color: #9ca3af; }

    /* ── Modal ── */
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; z-index: 300; padding: 20px; backdrop-filter: blur(2px); }
    .assign-modal { background: white; border-radius: 18px; width: 100%; max-width: 420px; max-height: 82vh; display: flex; flex-direction: column; box-shadow: 0 24px 64px rgba(0,0,0,0.25); overflow: hidden; }
    .assign-modal-header { display: flex; align-items: flex-start; justify-content: space-between; padding: 20px 20px 14px; border-bottom: 1px solid #f0f0f0; flex-shrink: 0; }
    .assign-modal-header h3 { font-size: 17px; font-weight: 700; color: #111827; margin: 0 0 4px; }
    .assign-modal-time { font-size: 13px; color: #6b7280; margin: 0; display: flex; align-items: center; gap: 5px; text-transform: capitalize; }
    .btn-modal-close { width: 32px; height: 32px; border-radius: 8px; border: none; background: #f3f4f6; color: #6b7280; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .btn-modal-close:hover { background: #e5e7eb; color: #111827; }

    /* Tipo radio */
    .tipo-row { display: flex; gap: 10px; padding: 12px 20px 4px; flex-shrink: 0; }
    .tipo-opt { display: flex; align-items: center; gap: 7px; padding: 7px 14px; border-radius: 10px; border: 1.5px solid #e5e7eb; cursor: pointer; font-size: 13px; font-weight: 600; color: #374151; user-select: none; transition: all 0.15s; }
    .tipo-opt input { display: none; }
    .tipo-opt.active { border-color: #16a34a; background: #f0fdf4; }
    .tipo-opt.active:last-child { border-color: #1d4ed8; background: #eff6ff; color: #1d4ed8; }
    .tipo-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
    .tipo-dot.consulta { background: #16a34a; }
    .tipo-dot.sesion { background: #1d4ed8; }

    /* Patient list */
    .patient-list { overflow-y: auto; flex: 1; padding: 8px; }
    .patient-option { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 12px 14px; border: none; border-radius: 10px; background: transparent; cursor: pointer; text-align: left; transition: background 0.12s; gap: 10px; }
    .patient-option:not(.disabled):hover { background: #f0fdf4; }
    .patient-option:not(.disabled):hover .patient-option-name { color: #16a34a; }
    .patient-option.disabled { cursor: default; opacity: 0.55; }
    .patient-option-name { font-size: 14px; font-weight: 600; color: #111827; }
    .already-badge { font-size: 11px; font-weight: 600; color: #9ca3af; background: #f3f4f6; padding: 2px 8px; border-radius: 20px; white-space: nowrap; flex-shrink: 0; }
    .modal-empty { padding: 24px 20px; color: #9ca3af; font-size: 14px; text-align: center; margin: 0; }

    /* Guest option */
    .guest-section { padding: 0 8px 12px; flex-shrink: 0; }
    .guest-divider { display: flex; align-items: center; gap: 10px; color: #d1d5db; font-size: 11px; margin: 6px 0 8px; }
    .guest-divider::before, .guest-divider::after { content: ''; flex: 1; height: 1px; background: #f0f0f0; }
    .btn-guest { width: 100%; display: flex; align-items: center; justify-content: center; gap: 7px; padding: 9px 14px; border: 1.5px dashed #d1d5db; border-radius: 10px; background: transparent; color: #6b7280; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.12s; }
    .btn-guest:hover { border-color: #9ca3af; color: #374151; background: #f9fafb; }
    .guest-input-wrap { border: 1.5px solid #e5e7eb; border-radius: 10px; padding: 10px 12px; display: flex; flex-direction: column; gap: 8px; }
    .guest-label { font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.4px; }
    .guest-input { padding: 8px 10px; border: 1.5px solid #e5e7eb; border-radius: 8px; font-size: 14px; outline: none; font-family: inherit; }
    .guest-input:focus { border-color: #16a34a; }
    .guest-actions { display: flex; gap: 8px; }
    .btn-guest-cancel { padding: 7px 12px; background: #f3f4f6; color: #374151; border: none; border-radius: 8px; font-size: 13px; cursor: pointer; }
    .btn-guest-cancel:hover { background: #e5e7eb; }
    .btn-guest-ok { flex: 1; padding: 8px 14px; background: #16a34a; color: white; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
    .btn-guest-ok:disabled { opacity: 0.45; cursor: not-allowed; }

    /* Step 2 */
    .modal-step2 { padding: 16px 20px 20px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 10px; }
    .step2-patient-info { display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: #f0fdf4; border-radius: 10px; font-size: 14px; font-weight: 600; color: #166534; }
    .step2-hint { font-size: 13px; color: #6b7280; margin: 0; }
    .date-opts-list { display: flex; flex-direction: column; gap: 6px; }
    .date-opt { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 10px; cursor: pointer; border: 1.5px solid #e5e7eb; transition: all 0.12s; user-select: none; }
    .date-opt input { display: none; }
    .date-opt.checked { border-color: #16a34a; background: #f0fdf4; }
    .date-opt.checked .date-opt-label { color: #166534; font-weight: 600; }
    .date-opt.taken { opacity: 0.5; cursor: default; }
    .date-opt-label { font-size: 14px; color: #374151; text-transform: capitalize; flex: 1; }
    .step2-actions { display: flex; gap: 10px; padding-top: 4px; flex-shrink: 0; }
    .btn-back-step { display: flex; align-items: center; gap: 5px; flex-shrink: 0; padding: 10px 14px; background: #f3f4f6; color: #374151; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
    .btn-back-step:hover { background: #e5e7eb; }
    .btn-assign-multi { flex: 1; padding: 11px 18px; background: #16a34a; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; transition: background 0.15s; }
    .btn-assign-multi:hover:not(:disabled) { background: #15803d; }
    .btn-assign-multi:disabled { opacity: 0.6; cursor: not-allowed; }
    .saving-dot { width: 8px; height: 8px; border-radius: 50%; background: white; animation: pulse 1s infinite; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }

    @media (max-width: 600px) {
      .cal-head, .cal-row { grid-template-columns: 65px 1fr; }
      .hour-label { font-size: 12px; }
      .assign-modal { max-width: 100%; border-radius: 18px 18px 0 0; align-self: flex-end; max-height: 88vh; }
      .modal-overlay { align-items: flex-end; padding: 0; }
      .page-header { flex-direction: row; }
    }
  `]
})
export class ProfessionalAppointmentsComponent implements OnInit {
  private api = inject(ApiService);

  // View
  viewMode    = signal<'day' | 'week'>('day');
  currentDate = signal<Date>(new Date());

  // Data
  allAppts    = signal<{ [dateStr: string]: any[] }>({});
  loadingDay  = signal(false);
  loadingWeek = signal(false);
  patients    = signal<any[]>([]);

  // Day view computed
  rawAppts = computed<any[]>(() => this.allAppts()[this.toDateStr(this.currentDate())] || []);
  hourRows = computed<HourRow[]>(() => {
    const appts = this.rawAppts();
    return Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      appointments: appts.filter((a: any) => new Date(a.appointment_datetime).getHours() === h)
    }));
  });
  visibleRows = computed<HourRow[]>(() => {
    const rows = this.hourRows();
    if (this.showFullDay()) return rows;
    return rows.filter(r => (r.hour >= 7 && r.hour <= 21) || r.appointments.length > 0);
  });

  // Week view computed
  weekDates = computed<Date[]>(() => {
    const monday = this._getMondayOf(this.currentDate());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      return d;
    });
  });
  weekVisibleHours = computed<number[]>(() => {
    if (this.showFullDay()) return Array.from({ length: 24 }, (_, i) => i);
    return Array.from({ length: 15 }, (_, i) => i + 7);
  });

  // UI
  showFullDay     = signal(false);
  assignTipo      = signal<string>('consulta');
  assignTipoValue = 'consulta';
  savingHour      = signal<number | null>(null);

  // Modal
  modalHour       = signal<number | null>(null);
  modalBaseDate   = signal<Date>(new Date());
  modalStep       = signal<1 | 2>(1);
  selectedPatient = signal<any>(null);
  modalDates      = signal<Set<string>>(new Set());
  dateOptions     = signal<{ label: string; dateStr: string }[]>([]);
  guestMode       = signal(false);
  guestName       = '';

  ngOnInit() {
    this.api.getPatients().subscribe({ next: p => this.patients.set(p) });
    this.loadDay();
  }

  loadDay() {
    this.loadingDay.set(true);
    const dateStr = this.toDateStr(this.currentDate());
    this.api.getDayAppointments(dateStr).subscribe({
      next: data => {
        this.allAppts.update(a => ({ ...a, [dateStr]: data }));
        this.loadingDay.set(false);
      },
      error: () => this._loadDayFallback()
    });
  }

  private _loadDayFallback() {
    const dateStr = this.toDateStr(this.currentDate());
    this.api.getAppointments().subscribe({
      next: (all: any[]) => {
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
        this.allAppts.update(a => ({ ...a, [dateStr]: filtered }));
        this.loadingDay.set(false);
      },
      error: () => this.loadingDay.set(false)
    });
  }

  loadWeek() {
    this.loadingWeek.set(true);
    const dates = this.weekDates();
    const reqs = dates.map(d =>
      this.api.getDayAppointments(this.toDateStr(d)).pipe(catchError(() => of([])))
    );
    forkJoin(reqs).subscribe({
      next: (results: any[][]) => {
        const byDate: { [d: string]: any[] } = {};
        results.forEach((data, i) => { byDate[this.toDateStr(dates[i])] = data; });
        this.allAppts.update(a => ({ ...a, ...byDate }));
        this.loadingWeek.set(false);
      },
      error: () => this.loadingWeek.set(false)
    });
  }

  switchView(mode: 'day' | 'week') {
    this.viewMode.set(mode);
    if (mode === 'week') this.loadWeek();
    else this.loadDay();
  }

  prevPeriod() {
    if (this.viewMode() === 'week') {
      this.currentDate.update(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n; });
      this.loadWeek();
    } else {
      if (this.isToday()) return;
      this.currentDate.update(d => { const n = new Date(d); n.setDate(n.getDate() - 1); return n; });
      this.loadDay();
    }
  }

  nextPeriod() {
    if (this.viewMode() === 'week') {
      this.currentDate.update(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; });
      this.loadWeek();
    } else {
      this.currentDate.update(d => { const n = new Date(d); n.setDate(n.getDate() + 1); return n; });
      this.loadDay();
    }
  }

  goToday() {
    this.currentDate.set(new Date());
    if (this.viewMode() === 'week') this.loadWeek();
    else this.loadDay();
  }

  onDatePick(event: Event) {
    const val = (event.target as HTMLInputElement).value;
    if (!val) return;
    const [y, m, d] = val.split('-').map(Number);
    this.currentDate.set(new Date(y, m - 1, d));
    if (this.viewMode() === 'week') this.loadWeek();
    else this.loadDay();
  }

  openModal(hour: number, dateStr?: string) {
    const baseDate = dateStr
      ? (() => { const [y, m, d] = dateStr.split('-').map(Number); return new Date(y, m - 1, d); })()
      : new Date(this.currentDate());
    this.assignTipo.set('consulta');
    this.assignTipoValue = 'consulta';
    this.modalHour.set(hour);
    this.modalBaseDate.set(baseDate);
    this.modalStep.set(1);
    this.selectedPatient.set(null);
    this.modalDates.set(new Set());
    this.dateOptions.set([]);
    this.guestMode.set(false);
    this.guestName = '';
  }

  selectGuest() {
    const name = this.guestName.trim();
    if (!name) return;
    this.selectPatient({ id: '', nombre: name, apellido: '' });
  }

  closeModal() {
    this.modalHour.set(null);
    this.modalStep.set(1);
    this.selectedPatient.set(null);
  }

  selectPatient(p: any) {
    this.selectedPatient.set(p);
    this.dateOptions.set(this._buildDateOptions(this.modalBaseDate()));
    this.modalDates.set(new Set([this.toDateStr(this.modalBaseDate())]));
    this.modalStep.set(2);
  }

  toggleDate(ds: string) {
    this.modalDates.update(s => {
      const n = new Set(s);
      n.has(ds) ? n.delete(ds) : n.add(ds);
      return n;
    });
  }

  doAssignMulti() {
    const patient = this.selectedPatient();
    const hour = this.modalHour();
    if (!patient || hour === null) return;
    const dates = [...this.modalDates()];
    if (!dates.length) return;
    const tipo = this.assignTipo();
    this.savingHour.set(hour);
    const reqs = dates.map(ds => {
      const [y, m, d] = ds.split('-').map(Number);
      const dt = new Date(y, m - 1, d, hour, 0, 0, 0);
      return this.api.assignAppointment({
        patient_id: patient.id,
        patient_name: `${patient.nombre} ${patient.apellido}`.trim(),
        datetime_iso: dt.toISOString(),
        duration_minutes: 60,
        tipo
      });
    });
    forkJoin(reqs).subscribe({
      next: () => {
        this.savingHour.set(null);
        this.closeModal();
        this._reload();
      },
      error: () => this.savingHour.set(null)
    });
  }

  removeAppt(id: string) {
    this.api.deleteAppointment(id).subscribe({
      next: () => this._reload(),
      error: () => { this.api.cancelByProfessional(id).subscribe({ next: () => this._reload() }); }
    });
  }

  private _reload() {
    if (this.viewMode() === 'week') this.loadWeek();
    else this.loadDay();
  }

  getWeekCellAppts(d: Date, hour: number): any[] {
    return (this.allAppts()[this.toDateStr(d)] || [])
      .filter((a: any) => new Date(a.appointment_datetime).getHours() === hour);
  }

  isPatientOnDate(patientDocId: string | undefined, dateStr: string): boolean {
    if (!patientDocId) return false;
    return (this.allAppts()[dateStr] || []).some((a: any) => a.patient_doc_id === patientDocId);
  }

  isPast(hour: number): boolean {
    if (!this.isToday()) return false;
    return hour < new Date().getHours();
  }

  isDateTimePast(d: Date, hour: number): boolean {
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dStart   = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (dStart < dayStart) return true;
    if (dStart.getTime() === dayStart.getTime()) return hour < now.getHours();
    return false;
  }

  isToday(): boolean { return this._isSameDay(this.currentDate(), new Date()); }
  isDateToday(d: Date): boolean { return this._isSameDay(d, new Date()); }

  private _isSameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  private _getMondayOf(d: Date): Date {
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const m = new Date(d);
    m.setDate(m.getDate() + diff);
    m.setHours(0, 0, 0, 0);
    return m;
  }

  private _buildDateOptions(baseDate: Date): { label: string; dateStr: string }[] {
    return Array.from({ length: 5 }, (_, i) => {
      const d = new Date(baseDate);
      d.setDate(d.getDate() + i * 7);
      const suffix = this._isSameDay(d, new Date()) ? ' · hoy' : '';
      return {
        label: d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'short' }) + suffix,
        dateStr: this.toDateStr(d)
      };
    });
  }

  padHour(h: number): string { return String(h).padStart(2, '0'); }

  formatNavDate(): string {
    if (this.viewMode() === 'week') {
      const dates = this.weekDates();
      const f = dates[0].toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
      const l = dates[6].toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
      return `${f} – ${l}`;
    }
    return this.currentDate().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  formatDateShort(d: Date): string {
    return d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  formatDow(d: Date): string {
    return d.toLocaleDateString('es-AR', { weekday: 'short' });
  }

  toDateStr(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}

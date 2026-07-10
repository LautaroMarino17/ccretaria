import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ApiService } from '../../../core/services/api.service';

interface Rango {
  limite?: number | null;
  mayor_es_mejor?: boolean;
  asimetria_max?: number | null;
}

interface Medida {
  nombre: string; unidad: string; tipo: string;
  // new format
  intentos?: string[];
  nombre_a?: string; nombre_b?: string;
  intentos_a?: string[]; intentos_b?: string[];
  // legacy read-only
  valor?: string; v1?: string; v2?: string; v3?: string;
  nombre_izq?: string; nombre_der?: string;
  valor_izq?: string; valor_der?: string;
  izq1?: string; izq2?: string; izq3?: string;
  der1?: string; der2?: string; der3?: string;
  rango?: Rango; mostrar_rango?: boolean;
}

interface EvalForm {
  nombre: string; fecha: string; observaciones: string;
  medidas: Medida[]; imagenes: string[]; patient_name?: string;
}

const EMPTY_M = (): Medida => ({ nombre: '', unidad: '', tipo: 'simple', intentos: [''], mostrar_rango: false, rango: {} });
const EMPTY_F = (): EvalForm => ({
  nombre: '', fecha: new Date().toISOString().split('T')[0],
  observaciones: '', medidas: [EMPTY_M()], imagenes: [], patient_name: ''
});

@Component({
  selector: 'app-professional-evaluations',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
<div class="page">

  <div class="page-header">
    <div class="header-left">
      <a [routerLink]="backLink" class="btn-back">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        Volver
      </a>
      <div>
        <h1>Evaluaciones</h1>
        <p class="subtitle">{{ isGuest ? 'Paciente sin registrar' : 'Testeos y mediciones del paciente' }}</p>
      </div>
    </div>
    <button class="btn-primary" (click)="openForm()">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Nueva evaluación
    </button>
  </div>

  @if (showForm()) {
    <div class="form-card">
      <h3>{{ editingId() ? 'Editar evaluación' : 'Nueva evaluación' }}</h3>

      @if (isGuest) {
        <div class="field mb14">
          <label>Nombre del paciente (sin registrar)</label>
          <input [(ngModel)]="guestName" placeholder="Ej: Juan P." />
        </div>
      }

      <div class="fields-row-2">
        <div class="field">
          <label>Nombre de la evaluación *</label>
          <input [(ngModel)]="form().nombre" placeholder="Ej: Test de fuerza isométrica..." />
        </div>
        <div class="field">
          <label>Fecha *</label>
          <input type="date" [(ngModel)]="form().fecha" />
        </div>
      </div>

      <div class="measures-section">
        <div class="measures-header">
          <h4>Medidas</h4>
          <button class="btn-add-circle" (click)="addMedida()" title="Agregar medida">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
        </div>

        @for (m of form().medidas; track $index) {
          <div class="mcard-form">
            <div class="mrow-header">
              <input [(ngModel)]="m.nombre" placeholder="Nombre de la medida" class="flex-grow" />
              <select [(ngModel)]="m.tipo" (ngModelChange)="resetMedida(m)" class="tipo-sel">
                <option value="simple">Simple</option>
                <option value="asimetria">Asimetría</option>
                <option value="relacion">Relación</option>
              </select>
              <input [(ngModel)]="m.unidad" placeholder="Unidad" class="unit-inp" />
              @if (form().medidas.length > 1) {
                <button class="btn-rm" (click)="removeMedida($index)" title="Eliminar">×</button>
              }
            </div>

            <!-- Simple: intentos dinámicos -->
            @if (m.tipo === 'simple') {
              <div class="attempts-wrap">
                @for (v of (m.intentos ?? ['']); track $index) {
                  <div class="attempt-cell">
                    <span class="attempt-num">{{ $index + 1 }}</span>
                    <input [(ngModel)]="m.intentos![$index]" type="number" placeholder="0" class="val-inp sm" />
                    @if ((m.intentos?.length ?? 0) > 1) {
                      <button class="btn-rm-xs" (click)="rmIntento(m, $index)" type="button">×</button>
                    }
                  </div>
                }
                <button class="btn-add-int" (click)="addIntento(m)" type="button">+ intento</button>
                @if (hasValues(m.intentos)) {
                  <span class="computed-lbl">Mejor: {{ bestSimple(m) | number:'1.1-2' }} {{ m.unidad }}</span>
                }
              </div>
            }

            <!-- Asimetría / Relación: dos lados con intentos -->
            @if (m.tipo === 'asimetria' || m.tipo === 'relacion') {
              <div class="bi-form">
                <!-- Lado A -->
                <div class="bi-side">
                  <span class="dot blue-dot"></span>
                  <input [(ngModel)]="m.nombre_a"
                    [placeholder]="m.tipo === 'asimetria' ? 'Nombre lado A' : 'Variable A'"
                    class="side-name-inp" />
                  <div class="attempts-wrap compact">
                    @for (v of (m.intentos_a ?? ['']); track $index) {
                      <div class="attempt-cell">
                        <span class="attempt-num">{{ $index + 1 }}</span>
                        <input [(ngModel)]="m.intentos_a![$index]" type="number" placeholder="0" class="val-inp sm" />
                        @if ((m.intentos_a?.length ?? 0) > 1) {
                          <button class="btn-rm-xs" (click)="rmIntentoA(m, $index)" type="button">×</button>
                        }
                      </div>
                    }
                    <button class="btn-add-int" (click)="addIntentoA(m)" type="button">+</button>
                  </div>
                  @if (bestA(m)) {
                    <span class="computed-lbl">{{ bestA(m) | number:'1.1-2' }}</span>
                  }
                </div>
                <!-- Lado B -->
                <div class="bi-side">
                  <span class="dot orange-dot"></span>
                  <input [(ngModel)]="m.nombre_b"
                    [placeholder]="m.tipo === 'asimetria' ? 'Nombre lado B' : 'Variable B'"
                    class="side-name-inp" />
                  <div class="attempts-wrap compact">
                    @for (v of (m.intentos_b ?? ['']); track $index) {
                      <div class="attempt-cell">
                        <span class="attempt-num">{{ $index + 1 }}</span>
                        <input [(ngModel)]="m.intentos_b![$index]" type="number" placeholder="0" class="val-inp sm" />
                        @if ((m.intentos_b?.length ?? 0) > 1) {
                          <button class="btn-rm-xs" (click)="rmIntentoB(m, $index)" type="button">×</button>
                        }
                      </div>
                    }
                    <button class="btn-add-int" (click)="addIntentoB(m)" type="button">+</button>
                  </div>
                  @if (bestB(m)) {
                    <span class="computed-lbl">{{ bestB(m) | number:'1.1-2' }}</span>
                  }
                </div>
                <!-- Resultado -->
                @if (bestA(m) || bestB(m)) {
                  <div class="bi-result">
                    @if (m.tipo === 'asimetria') {
                      <span class="result-chip">Asimetría: {{ calcAsim(m) | number:'1.1-1' }}%</span>
                    } @else {
                      <span class="result-chip">
                        {{ m.nombre_a || 'A' }}/{{ m.nombre_b || 'B' }} = {{ calcRelacion(m) | number:'1.1-1' }}%
                      </span>
                    }
                  </div>
                }
              </div>
            }

            <!-- Rango -->
            <button class="range-toggle" (click)="m.mostrar_rango = !m.mostrar_rango" type="button">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 19.07a10 10 0 0 1 0-14.14"/></svg>
              {{ m.mostrar_rango ? 'Ocultar rango' : '+ Configurar rango' }}
            </button>

            @if (m.mostrar_rango) {
              <div class="range-row">
                @if (m.tipo === 'asimetria') {
                  <span class="rlbl">Asim. máx</span>
                  <input [(ngModel)]="m.rango!.asimetria_max" type="number" placeholder="10" class="rinp" />
                  <span class="rlbl">%</span>
                } @else {
                  <span class="rlbl">{{ m.tipo === 'relacion' ? 'Ratio límite %' : 'Límite' }}</span>
                  <input [(ngModel)]="m.rango!.limite" type="number" placeholder="—" class="rinp" />
                  <button class="dir-btn" (click)="toggleDir(m)" type="button">
                    {{ m.rango?.mayor_es_mejor !== false ? 'Bueno si ≥' : 'Bueno si ≤' }}
                  </button>
                }
              </div>
            }
          </div>
        }
      </div>

      <div class="field">
        <label>Observaciones</label>
        <textarea [(ngModel)]="form().observaciones" rows="3" placeholder="Notas adicionales..."></textarea>
      </div>

      <div class="field">
        <label>Imágenes (URLs de Drive, una por línea)</label>
        <textarea [(ngModel)]="imagenesText" rows="2" placeholder="https://drive.google.com/file/d/..."></textarea>
      </div>

      @if (formError()) { <div class="error-banner">{{ formError() }}</div> }

      <div class="form-actions">
        <button class="btn-secondary" (click)="closeForm()">Cancelar</button>
        <button class="btn-primary" (click)="saveEval()" [disabled]="saving()">
          {{ saving() ? 'Guardando...' : (editingId() ? 'Guardar cambios' : 'Crear evaluación') }}
        </button>
      </div>
    </div>
  }

  @if (loading()) {
    <div class="loading-text">Cargando evaluaciones...</div>
  } @else if (evals().length === 0 && !showForm()) {
    <div class="empty-state">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" stroke-width="1.5"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
      <p>No hay evaluaciones registradas aún</p>
      <button class="btn-primary" (click)="openForm()">Crear primera evaluación</button>
    </div>
  } @else {
    <div class="evals-list">
      @for (ev of evals(); track ev.id) {
        <div class="eval-card">
          <div class="eval-header">
            <div>
              <h3>{{ ev.nombre }}</h3>
              <div class="eval-meta">
                <span class="eval-date">{{ formatDate(ev.fecha) }}</span>
                @if (ev.patient_name) { <span class="guest-badge">{{ ev.patient_name }}</span> }
                @if (ev.professional_name) { <span class="prof-badge">{{ ev.professional_name }}</span> }
              </div>
            </div>
            <div class="eval-actions">
              <button class="btn-icon" (click)="exportPdf(ev)" title="Exportar PDF">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
              </button>
              <button class="btn-icon" (click)="downloadEval(ev)" title="Descargar Excel">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              </button>
              <button class="btn-icon" (click)="editEval(ev)" title="Editar">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button class="btn-icon danger" (click)="deleteEval(ev.id)" title="Eliminar">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
              </button>
            </div>
          </div>

          @if (ev.medidas?.length > 0) {
            <div class="meds-grid">
              @for (m of ev.medidas; track $index) {
                <div class="mcard-view">
                  <div class="mcard-top">
                    <div class="mcard-info">
                      <div class="mcard-title-row">
                        <span class="mcard-name">{{ m.nombre }}</span>
                        @if (m.unidad) { <span class="mcard-unit">{{ m.unidad }}</span> }
                      </div>

                      @if (isSimpleTipo(m.tipo)) {
                        @if (allAttempts(m).length > 1) {
                          <div class="chips-row">
                            @for (a of allAttempts(m); track a) {
                              <span class="trial-chip">T{{ $index+1 }}: {{ a }}</span>
                            }
                          </div>
                        }
                        <div class="best-row">
                          <span class="big-val">{{ bestSimple(m) | number:'1.0-2' }}</span>
                          @if (m.unidad) { <span class="big-unit">{{ m.unidad }}</span> }
                          @if (badgeForVal(bestSimple(m), m.rango) !== null) {
                            <span class="badge" [class.badge-good]="badgeForVal(bestSimple(m), m.rango)!" [class.badge-bad]="badgeForVal(bestSimple(m), m.rango) === false">
                              {{ badgeForVal(bestSimple(m), m.rango) ? 'Bueno' : 'Malo' }}
                            </span>
                          }
                        </div>
                      }

                      @if (isBilateralTipo(m.tipo) || isRelacionTipo(m.tipo)) {
                        <div class="side-row">
                          <span class="dot blue-dot"></span>
                          <span class="side-name">{{ nameA(m) }}</span>
                          <span class="side-num">{{ bestA(m) | number:'1.1-2' }}</span>
                          @if (badgeForVal(bestA(m), m.rango) !== null) {
                            <span class="badge sm" [class.badge-good]="badgeForVal(bestA(m), m.rango)!" [class.badge-bad]="badgeForVal(bestA(m), m.rango) === false">{{ badgeForVal(bestA(m), m.rango) ? '✓' : '✗' }}</span>
                          }
                        </div>
                        <div class="side-row">
                          <span class="dot orange-dot"></span>
                          <span class="side-name">{{ nameB(m) }}</span>
                          <span class="side-num">{{ bestB(m) | number:'1.1-2' }}</span>
                          @if (badgeForVal(bestB(m), m.rango) !== null) {
                            <span class="badge sm" [class.badge-good]="badgeForVal(bestB(m), m.rango)!" [class.badge-bad]="badgeForVal(bestB(m), m.rango) === false">{{ badgeForVal(bestB(m), m.rango) ? '✓' : '✗' }}</span>
                          }
                        </div>
                        <div class="asim-row">
                          @if (isBilateralTipo(m.tipo)) {
                            <span class="asim-lbl-v">Asim:</span>
                            <span class="asim-num">{{ calcAsim(m) | number:'1.1-1' }}%</span>
                            @if (badgeForAsim(calcAsim(m), m.rango) !== null) {
                              <span class="badge sm" [class.badge-good]="badgeForAsim(calcAsim(m), m.rango)!" [class.badge-bad]="badgeForAsim(calcAsim(m), m.rango) === false">{{ badgeForAsim(calcAsim(m), m.rango) ? '✓' : '✗' }}</span>
                            }
                          } @else {
                            <span class="asim-lbl-v">Ratio:</span>
                            <span class="asim-num">{{ calcRelacion(m) | number:'1.1-1' }}%</span>
                            @if (badgeForVal(calcRelacion(m), m.rango) !== null) {
                              <span class="badge sm" [class.badge-good]="badgeForVal(calcRelacion(m), m.rango)!" [class.badge-bad]="badgeForVal(calcRelacion(m), m.rango) === false">{{ badgeForVal(calcRelacion(m), m.rango) ? '✓' : '✗' }}</span>
                            }
                          }
                        </div>
                      }
                    </div>

                    <div class="mcard-chart" [innerHTML]="chartSvg(m)"></div>
                  </div>
                </div>
              }
            </div>
          }

          @if (ev.observaciones) {
            <div class="obs-box"><span class="obs-label">Observaciones</span><p>{{ ev.observaciones }}</p></div>
          }

          @if (ev.imagenes?.length > 0) {
            <div class="images-row">
              @for (img of ev.imagenes; track $index) {
                <a [href]="img" target="_blank" class="img-link">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  Imagen {{ $index + 1 }}
                </a>
              }
            </div>
          }
        </div>
      }
    </div>
  }
</div>
  `,
  styles: [`
    .page { max-width: 900px; }
    .page-header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:24px; gap:12px; flex-wrap:wrap; }
    .header-left { display:flex; align-items:flex-start; gap:14px; }
    .btn-back { display:inline-flex; align-items:center; gap:6px; padding:8px 12px; background:white; border:1px solid #e5e7eb; border-radius:8px; font-size:14px; color:#374151; text-decoration:none; white-space:nowrap; margin-top:2px; }
    h1 { font-size:22px; font-weight:700; color:#111827; margin:0 0 4px; }
    .subtitle { color:#6b7280; font-size:14px; margin:0; }

    .form-card { background:white; border-radius:16px; padding:28px; margin-bottom:20px; box-shadow:0 1px 6px rgba(0,0,0,0.07); }
    .form-card h3 { font-size:17px; font-weight:700; color:#111827; margin:0 0 20px; }
    .fields-row-2 { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:14px; }
    .field { display:flex; flex-direction:column; gap:6px; }
    .mb14 { margin-bottom:14px; }
    label { font-size:13px; font-weight:500; color:#374151; }
    input, textarea, select { padding:10px 12px; border:1.5px solid #e5e7eb; border-radius:8px; font-size:14px; outline:none; font-family:inherit; resize:vertical; box-sizing:border-box; }
    input:focus, textarea:focus, select:focus { border-color:#16a34a; }

    .measures-section { margin-bottom:14px; }
    .measures-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; }
    .measures-header h4 { font-size:14px; font-weight:700; color:#374151; margin:0; }
    .btn-add-circle { width:32px; height:32px; border-radius:50%; background:#f0fdf4; color:#16a34a; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; }
    .btn-add-circle:hover { background:#16a34a; color:white; }

    .mcard-form { background:#f9fafb; border:1.5px solid #e5e7eb; border-radius:12px; padding:14px; margin-bottom:10px; display:flex; flex-direction:column; gap:10px; }
    .mrow-header { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
    .flex-grow { flex:1; min-width:120px; }
    .tipo-sel { min-width:130px; }
    .unit-inp { width:80px; }
    .btn-rm { width:32px; height:32px; border-radius:6px; border:none; background:#fee2e2; color:#ef4444; cursor:pointer; font-size:18px; display:flex; align-items:center; justify-content:center; }
    .btn-rm:hover { background:#ef4444; color:white; }
    .btn-rm-xs { width:20px; height:20px; border-radius:4px; border:none; background:#fee2e2; color:#ef4444; cursor:pointer; font-size:13px; display:flex; align-items:center; justify-content:center; padding:0; line-height:1; }
    .btn-rm-xs:hover { background:#ef4444; color:white; }

    /* Attempts */
    .attempts-wrap { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
    .attempts-wrap.compact { flex-wrap:nowrap; }
    .attempt-cell { display:flex; align-items:center; gap:3px; }
    .attempt-num { font-size:11px; font-weight:700; color:#9ca3af; min-width:12px; text-align:center; }
    .val-inp { width:100px; }
    .val-inp.sm { width:72px; padding:8px 10px; }
    .btn-add-int { font-size:12px; color:#6366f1; border:1.5px dashed #c7d2fe; border-radius:6px; background:none; padding:4px 8px; cursor:pointer; white-space:nowrap; }
    .btn-add-int:hover { background:#ede9fe; border-color:#6366f1; }

    /* Bilateral / Relación form */
    .bi-form { display:flex; flex-direction:column; gap:8px; background:#fff; border:1px solid #e5e7eb; border-radius:10px; padding:12px; }
    .bi-side { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
    .side-name-inp { width:130px; font-size:13px; padding:7px 10px; }
    .bi-result { display:flex; align-items:center; gap:8px; padding-top:4px; border-top:1px dashed #e5e7eb; }
    .result-chip { font-size:12px; font-weight:700; color:#6d28d9; background:#ede9fe; padding:3px 10px; border-radius:20px; }
    .computed-lbl { font-size:12px; color:#6b7280; background:#f3f4f6; padding:4px 8px; border-radius:6px; white-space:nowrap; }

    /* Rango */
    .range-toggle { display:inline-flex; align-items:center; gap:5px; font-size:12px; color:#6366f1; cursor:pointer; border:none; background:none; padding:0; font-family:inherit; }
    .range-toggle:hover { color:#4f46e5; }
    .range-row { display:flex; align-items:center; gap:8px; flex-wrap:wrap; background:white; border:1px solid #e5e7eb; border-radius:8px; padding:10px; }
    .rlbl { font-size:12px; color:#6b7280; white-space:nowrap; }
    .rinp { width:72px; padding:6px 8px; font-size:13px; }
    .dir-btn { padding:6px 12px; border:1.5px solid #6366f1; border-radius:6px; background:white; color:#6366f1; font-size:12px; font-weight:600; cursor:pointer; white-space:nowrap; }
    .dir-btn:hover { background:#ede9fe; }

    .form-actions { display:flex; gap:10px; justify-content:flex-end; margin-top:8px; }
    .error-banner { background:#fef2f2; color:#dc2626; border:1px solid #fecaca; border-radius:8px; padding:10px 14px; font-size:14px; }

    /* Eval list */
    .evals-list { display:flex; flex-direction:column; gap:16px; }
    .eval-card { background:white; border-radius:16px; padding:22px; box-shadow:0 1px 6px rgba(0,0,0,0.06); }
    .eval-header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:16px; gap:10px; }
    .eval-card h3 { font-size:16px; font-weight:700; color:#111827; margin:0 0 6px; }
    .eval-meta { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
    .eval-date { font-size:12px; color:#9ca3af; }
    .prof-badge { padding:2px 8px; background:#f0fdf4; color:#16a34a; border-radius:20px; font-size:11px; font-weight:600; }
    .guest-badge { padding:2px 8px; background:#fef3c7; color:#92400e; border-radius:20px; font-size:11px; font-weight:600; }
    .eval-actions { display:flex; gap:8px; flex-shrink:0; }
    .btn-icon { width:32px; height:32px; border-radius:8px; border:1.5px solid #e5e7eb; background:white; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#6b7280; }
    .btn-icon:hover { border-color:#16a34a; color:#16a34a; }
    .btn-icon.danger:hover { border-color:#ef4444; color:#ef4444; }

    /* Measure cards */
    .meds-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(280px,1fr)); gap:12px; margin-bottom:12px; }
    .mcard-view { background:#f9fafb; border:1px solid #e5e7eb; border-radius:12px; overflow:hidden; }
    .mcard-top { display:flex; min-height:100px; }
    .mcard-info { flex:1; padding:14px; display:flex; flex-direction:column; gap:8px; min-width:0; overflow:hidden; }
    .mcard-title-row { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
    .mcard-name { font-size:14px; font-weight:700; color:#111827; }
    .mcard-unit { font-size:12px; color:#9ca3af; }
    .mcard-chart { width:190px; flex-shrink:0; display:flex; align-items:center; justify-content:center; background:#f3f4f6; padding:6px 4px; }

    .chips-row { display:flex; gap:4px; flex-wrap:wrap; }
    .trial-chip { font-size:11px; background:#e0e7ff; color:#3730a3; border-radius:5px; padding:2px 6px; }
    .best-row { display:flex; align-items:baseline; gap:6px; flex-wrap:wrap; }
    .big-val { font-size:22px; font-weight:800; color:#16a34a; line-height:1; }
    .big-unit { font-size:13px; color:#6b7280; }
    .badge { display:inline-flex; align-items:center; padding:2px 8px; border-radius:12px; font-size:11px; font-weight:700; }
    .badge.sm { padding:1px 5px; font-size:10px; }
    .badge-good { background:#dcfce7; color:#166534; }
    .badge-bad { background:#fee2e2; color:#991b1b; }
    .side-row { display:flex; align-items:center; gap:5px; }
    .dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
    .blue-dot { background:#3b82f6; }
    .orange-dot { background:#f97316; }
    .side-name { font-size:12px; font-weight:600; color:#374151; max-width:64px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .side-num { font-size:15px; font-weight:700; color:#111827; }
    .asim-row { display:flex; align-items:center; gap:5px; padding-top:4px; border-top:1px solid #e5e7eb; margin-top:2px; }
    .asim-lbl-v { font-size:11px; color:#6b7280; }
    .asim-num { font-size:13px; font-weight:600; color:#374151; }

    .obs-box { background:#fffbeb; border-radius:10px; padding:12px 14px; margin-top:10px; }
    .obs-label { display:block; font-size:11px; font-weight:600; color:#92400e; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px; }
    .obs-box p { font-size:14px; color:#78350f; margin:0; line-height:1.5; }

    .images-row { display:flex; flex-wrap:wrap; gap:8px; margin-top:10px; }
    .img-link { display:inline-flex; align-items:center; gap:5px; padding:5px 10px; background:#f3f4f6; border-radius:8px; font-size:12px; color:#6366f1; text-decoration:none; }
    .img-link:hover { background:#ede9fe; }

    .btn-primary { display:flex; align-items:center; gap:8px; padding:10px 18px; background:#16a34a; color:white; border:none; border-radius:10px; font-size:14px; font-weight:600; cursor:pointer; }
    .btn-primary:disabled { opacity:0.6; cursor:not-allowed; }
    .btn-secondary { padding:10px 18px; background:#f3f4f6; color:#374151; border:none; border-radius:10px; font-size:14px; cursor:pointer; }
    .loading-text { padding:32px; text-align:center; color:#9ca3af; }
    .empty-state { text-align:center; padding:56px; display:flex; flex-direction:column; align-items:center; gap:12px; color:#9ca3af; }
    .empty-state p { font-size:15px; margin:0; }

    @media (max-width:640px) {
      .fields-row-2 { grid-template-columns:1fr; }
      .meds-grid { grid-template-columns:1fr; }
      .mcard-top { flex-direction:column; }
      .mcard-chart { width:100%; min-height:110px; }
      .eval-actions { flex-wrap:wrap; }
    }
  `]
})
export class ProfessionalEvaluationsComponent implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private sanitizer = inject(DomSanitizer);

  patientId = this.route.snapshot.params['patientId'] || '_guest';
  get isGuest(): boolean { return this.patientId === '_guest'; }
  get backLink(): string[] { return this.isGuest ? ['/professional/patients'] : ['/professional/patients', this.patientId]; }

  evals = signal<any[]>([]);
  loading = signal(true);
  showForm = signal(false);
  saving = signal(false);
  editingId = signal<string | null>(null);
  formError = signal('');
  form = signal<EvalForm>(EMPTY_F());
  imagenesText = '';
  guestName = '';

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.api.getEvaluations(this.patientId).subscribe({
      next: (data) => { this.evals.set(data); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  openForm() {
    this.form.set(EMPTY_F()); this.imagenesText = ''; this.guestName = '';
    this.editingId.set(null); this.formError.set(''); this.showForm.set(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  closeForm() { this.showForm.set(false); this.editingId.set(null); this.formError.set(''); }

  editEval(ev: any) {
    this.editingId.set(ev.id);
    this.form.set({
      nombre: ev.nombre || '', fecha: ev.fecha || new Date().toISOString().split('T')[0],
      observaciones: ev.observaciones || '',
      medidas: ev.medidas?.length
        ? ev.medidas.map((m: any) => this._migrateMedida(m))
        : [EMPTY_M()],
      imagenes: ev.imagenes || [], patient_name: ev.patient_name || ''
    });
    this.guestName = ev.patient_name || '';
    this.imagenesText = (ev.imagenes || []).join('\n');
    this.formError.set(''); this.showForm.set(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private _migrateMedida(m: any): Medida {
    const base: Medida = { nombre: m.nombre || '', unidad: m.unidad || '', tipo: m.tipo || 'simple', rango: m.rango ? { ...m.rango } : {}, mostrar_rango: false };
    if (m.tipo === 'triple') {
      base.tipo = 'simple';
      const arr = [m.v1, m.v2, m.v3].filter((v: any) => v != null && v !== '');
      base.intentos = arr.length ? arr : [''];
    } else if (m.tipo === 'bilateral') {
      base.tipo = 'asimetria';
      base.nombre_a = m.nombre_izq || m.nombre_a || '';
      base.nombre_b = m.nombre_der || m.nombre_b || '';
      base.intentos_a = m.intentos_a?.length ? m.intentos_a : (m.valor_izq != null ? [String(m.valor_izq)] : ['']);
      base.intentos_b = m.intentos_b?.length ? m.intentos_b : (m.valor_der != null ? [String(m.valor_der)] : ['']);
    } else if (m.tipo === 'bilateral_triple') {
      base.tipo = 'asimetria';
      base.nombre_a = m.nombre_izq || m.nombre_a || '';
      base.nombre_b = m.nombre_der || m.nombre_b || '';
      const arrA = [m.izq1, m.izq2, m.izq3].filter((v: any) => v != null && v !== '');
      const arrB = [m.der1, m.der2, m.der3].filter((v: any) => v != null && v !== '');
      base.intentos_a = m.intentos_a?.length ? m.intentos_a : (arrA.length ? arrA : ['']);
      base.intentos_b = m.intentos_b?.length ? m.intentos_b : (arrB.length ? arrB : ['']);
    } else if (m.tipo === 'simple') {
      base.intentos = m.intentos?.length ? m.intentos : (m.valor != null ? [String(m.valor)] : ['']);
    } else if (m.tipo === 'asimetria' || m.tipo === 'relacion') {
      base.nombre_a = m.nombre_a || '';
      base.nombre_b = m.nombre_b || '';
      base.intentos_a = m.intentos_a?.length ? m.intentos_a : [''];
      base.intentos_b = m.intentos_b?.length ? m.intentos_b : [''];
    } else {
      base.intentos = m.intentos?.length ? m.intentos : [''];
    }
    return base;
  }

  addMedida() { this.form.update(f => ({ ...f, medidas: [...f.medidas, EMPTY_M()] })); }
  removeMedida(i: number) { this.form.update(f => ({ ...f, medidas: f.medidas.filter((_, j) => j !== i) })); }

  resetMedida(m: Medida) {
    const tipo = m.tipo;
    Object.assign(m, { nombre: m.nombre, unidad: m.unidad, tipo, rango: m.rango, mostrar_rango: m.mostrar_rango });
    if (tipo === 'asimetria' || tipo === 'relacion') {
      m.intentos = undefined; m.intentos_a = ['']; m.intentos_b = [''];
      m.nombre_a = ''; m.nombre_b = '';
    } else {
      m.intentos = ['']; m.intentos_a = undefined; m.intentos_b = undefined;
      m.nombre_a = undefined; m.nombre_b = undefined;
    }
    this.form.update(f => ({ ...f }));
  }

  toggleDir(m: Medida) {
    if (!m.rango) m.rango = {};
    m.rango.mayor_es_mejor = m.rango.mayor_es_mejor !== false ? false : true;
  }

  // ── Attempt helpers ─────────────────────────────────────────────────────────

  addIntento(m: Medida) { m.intentos = [...(m.intentos ?? ['']), '']; this.form.update(f => ({ ...f })); }
  rmIntento(m: Medida, i: number) { m.intentos = (m.intentos ?? []).filter((_, j) => j !== i); this.form.update(f => ({ ...f })); }
  addIntentoA(m: Medida) { m.intentos_a = [...(m.intentos_a ?? ['']), '']; this.form.update(f => ({ ...f })); }
  rmIntentoA(m: Medida, i: number) { m.intentos_a = (m.intentos_a ?? []).filter((_, j) => j !== i); this.form.update(f => ({ ...f })); }
  addIntentoB(m: Medida) { m.intentos_b = [...(m.intentos_b ?? ['']), '']; this.form.update(f => ({ ...f })); }
  rmIntentoB(m: Medida, i: number) { m.intentos_b = (m.intentos_b ?? []).filter((_, j) => j !== i); this.form.update(f => ({ ...f })); }

  // ── Save / Delete ────────────────────────────────────────────────────────────

  saveEval() {
    const f = this.form();
    if (!f.nombre.trim()) { this.formError.set('El nombre es obligatorio'); return; }
    if (!f.fecha) { this.formError.set('La fecha es obligatoria'); return; }
    this.saving.set(true); this.formError.set('');

    const imagenes = this.imagenesText.split('\n').map(s => s.trim()).filter(Boolean);
    const medidas = this._sanitizeMedidas(f.medidas);
    const id = this.editingId();

    const errMsg = (err: any) => {
      const d = err.error?.detail;
      if (!d) return `Error ${err.status || ''}: ${err.message || 'al guardar'}`;
      if (Array.isArray(d)) return d.map((e: any) => `[${(e.loc || []).slice(1).join('.')}] ${e.msg || JSON.stringify(e)}`).join('; ');
      return String(d);
    };

    if (id) {
      const update = { nombre: f.nombre, fecha: f.fecha, observaciones: f.observaciones || '', medidas, imagenes, patient_name: this.isGuest ? this.guestName : '' };
      this.api.updateEvaluation(id, this.patientId, update).subscribe({
        next: () => { this.saving.set(false); this.closeForm(); this.load(); },
        error: (err) => { this.formError.set(errMsg(err)); this.saving.set(false); }
      });
    } else {
      const payload = { patient_id: this.patientId, patient_name: this.isGuest ? this.guestName : '', nombre: f.nombre, fecha: f.fecha, observaciones: f.observaciones || '', medidas, imagenes };
      this.api.createEvaluation(payload).subscribe({
        next: () => { this.saving.set(false); this.closeForm(); this.load(); },
        error: (err) => { this.formError.set(errMsg(err)); this.saving.set(false); }
      });
    }
  }

  private _sanitizeMedidas(medidas: Medida[]): any[] {
    return medidas.map(m => {
      const base: any = { nombre: m.nombre || '', unidad: m.unidad || '', tipo: m.tipo };
      if (m.tipo === 'simple') {
        base.intentos = (m.intentos ?? ['']).map(v => v || '');
      } else if (m.tipo === 'asimetria' || m.tipo === 'relacion') {
        base.nombre_a = m.nombre_a || '';
        base.nombre_b = m.nombre_b || '';
        base.intentos_a = (m.intentos_a ?? ['']).map(v => v || '');
        base.intentos_b = (m.intentos_b ?? ['']).map(v => v || '');
      }
      if (m.rango?.limite != null || m.rango?.asimetria_max != null) {
        base.rango = {
          limite: m.rango?.limite != null ? Number(m.rango.limite) : null,
          mayor_es_mejor: m.rango?.mayor_es_mejor !== false,
          asimetria_max: m.rango?.asimetria_max != null ? Number(m.rango.asimetria_max) : null
        };
      }
      return base;
    });
  }

  deleteEval(id: string) {
    if (!confirm('¿Eliminar esta evaluación?')) return;
    this.api.deleteEvaluation(id, this.patientId).subscribe({ next: () => this.evals.update(ev => ev.filter(e => e.id !== id)) });
  }

  // ── Tipo helpers ─────────────────────────────────────────────────────────────

  isSimpleTipo(tipo: string): boolean { return tipo === 'simple' || tipo === 'triple'; }
  isBilateralTipo(tipo: string): boolean { return tipo === 'asimetria' || tipo === 'bilateral' || tipo === 'bilateral_triple'; }
  isRelacionTipo(tipo: string): boolean { return tipo === 'relacion'; }

  // ── Value helpers ────────────────────────────────────────────────────────────

  pn(s?: string | number): number { return parseFloat(String(s ?? '0')) || 0; }

  arrMax(arr?: string[]): number {
    if (!arr?.length) return 0;
    const vals = arr.map(v => this.pn(v)).filter(v => v !== 0);
    return vals.length ? Math.max(...vals) : 0;
  }

  bestSimple(m: Medida): number {
    if (m.intentos?.length) return this.arrMax(m.intentos);
    if (m.v1 || m.v2 || m.v3) return Math.max(this.pn(m.v1), this.pn(m.v2), this.pn(m.v3));
    return this.pn(m.valor);
  }

  bestA(m: Medida): number {
    if (m.intentos_a?.length) return this.arrMax(m.intentos_a);
    if (m.izq1 || m.izq2 || m.izq3) return Math.max(this.pn(m.izq1), this.pn(m.izq2), this.pn(m.izq3));
    return this.pn(m.valor_izq);
  }

  bestB(m: Medida): number {
    if (m.intentos_b?.length) return this.arrMax(m.intentos_b);
    if (m.der1 || m.der2 || m.der3) return Math.max(this.pn(m.der1), this.pn(m.der2), this.pn(m.der3));
    return this.pn(m.valor_der);
  }

  nameA(m: Medida): string { return m.nombre_a || m.nombre_izq || 'A'; }
  nameB(m: Medida): string { return m.nombre_b || m.nombre_der || 'B'; }

  hasValues(arr?: string[]): boolean { return !!(arr?.some(v => v)); }

  allAttempts(m: Medida): string[] {
    if (m.intentos?.length) return m.intentos.filter(v => v != null && v !== '');
    if (m.v1 || m.v2 || m.v3) return [m.v1, m.v2, m.v3].filter(v => !!v) as string[];
    if (m.valor) return [m.valor];
    return [];
  }

  calcAsim(m: Medida): number {
    const a = this.bestA(m), b = this.bestB(m);
    const mx = Math.max(a, b);
    return mx === 0 ? 0 : (1 - Math.min(a, b) / mx) * 100;
  }

  calcRelacion(m: Medida): number {
    const b = this.bestB(m);
    return b === 0 ? 0 : (this.bestA(m) / b) * 100;
  }

  badgeForVal(v: number, r?: any): boolean | null {
    if (!r) return null;
    if (r.limite != null) return r.mayor_es_mejor !== false ? v >= r.limite : v <= r.limite;
    if (r.bueno_min != null || r.bueno_max != null) {
      let ok = true;
      if (r.bueno_min != null && v < r.bueno_min) ok = false;
      if (r.bueno_max != null && v > r.bueno_max) ok = false;
      return ok;
    }
    return null;
  }

  badgeForAsim(v: number, r?: any): boolean | null {
    if (!r?.asimetria_max) return null;
    return v <= r.asimetria_max;
  }

  // ── SVG chart ────────────────────────────────────────────────────────────────

  chartSvg(m: Medida): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(this._buildSvg(m, 190, 108));
  }

  private _buildSvg(m: Medida, W: number, H: number): string {
    const pl = 10, pr = 10, pt = 20, pb = 26;
    const iW = W - pl - pr, iH = H - pt - pb;
    const cd = this._chartBars(m, iW, iH);
    if (!cd.bars.length) {
      return `<svg width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#f3f4f6" rx="6"/><text x="${W / 2}" y="${H / 2 + 4}" text-anchor="middle" font-size="11" fill="#9ca3af">Sin datos</text></svg>`;
    }
    let s = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`;
    s += `<rect width="${W}" height="${H}" fill="#f9fafb" rx="6"/>`;
    s += `<line x1="${pl}" y1="${pt + iH}" x2="${W - pr}" y2="${pt + iH}" stroke="#e5e7eb" stroke-width="1"/>`;
    for (const rl of cd.refLines) {
      const ry = pt + iH - rl.yPx;
      s += `<line x1="${pl}" y1="${ry}" x2="${W - pr}" y2="${ry}" stroke="${rl.color}" stroke-width="1" stroke-dasharray="4 3" opacity="0.8"/>`;
      s += `<text x="${W - pr - 2}" y="${ry - 2}" font-size="8" fill="${rl.color}" text-anchor="end">${rl.label}</text>`;
    }
    for (const b of cd.bars) {
      const bx = pl + b.xPx, by = pt + iH - b.hPx;
      s += `<rect x="${bx}" y="${by}" width="${b.wPx}" height="${b.hPx}" fill="${b.color}" rx="3"/>`;
      if (b.topLabel) s += `<text x="${bx + b.wPx / 2}" y="${by - 3}" font-size="9" fill="#374151" text-anchor="middle" font-weight="600">${b.topLabel}</text>`;
      if (b.botLabel) s += `<text x="${bx + b.wPx / 2}" y="${pt + iH + 14}" font-size="8" fill="#6b7280" text-anchor="middle">${b.botLabel}</text>`;
    }
    if (cd.footnote) s += `<text x="${W / 2}" y="${H - 5}" font-size="8" fill="#6b7280" text-anchor="middle">${cd.footnote}</text>`;
    return s + '</svg>';
  }

  private _chartBars(m: Medida, iW: number, iH: number) {
    const GOOD = '#16a34a', BAD = '#ef4444', NEU = '#818cf8', BLUE = '#3b82f6', ORG = '#f97316';
    const r = m.rango as any;

    const classify = (v: number) => {
      if (!r || r.limite == null) return NEU;
      return (r.mayor_es_mejor !== false ? v >= r.limite : v <= r.limite) ? GOOD : BAD;
    };

    const sc = (v: number, maxV: number) => Math.max((v / maxV) * iH, 2);

    const refLines: { yPx: number; label: string; color: string }[] = [];

    if (this.isSimpleTipo(m.tipo)) {
      const items = this.allAttempts(m);
      if (!items.length) return { bars: [], refLines, footnote: '' };
      const numVals = items.map(v => this.pn(v)).filter(v => v > 0);
      const allForScale = r?.limite != null ? [...numVals, Number(r.limite)] : numVals;
      const maxV = allForScale.length ? Math.max(...allForScale) * 1.25 : 10;
      if (r?.limite != null) refLines.push({ yPx: sc(Number(r.limite), maxV), label: `${r.mayor_es_mejor !== false ? '≥' : '≤'}${r.limite}`, color: GOOD });
      const n = items.length;
      const bw = Math.min(Math.floor(iW / (n * 1.8)), 42);
      const totalBW = n * bw;
      const gap = (iW - totalBW) / (n + 1);
      return {
        bars: items.map((v, i) => {
          const nv = this.pn(v);
          return { xPx: Math.floor(gap * (i + 1) + bw * i), wPx: bw, hPx: sc(nv, maxV), color: classify(nv), topLabel: nv ? `${nv}` : undefined, botLabel: n > 1 ? `T${i + 1}` : undefined };
        }),
        refLines,
        footnote: n > 1 ? `Mejor: ${this.bestSimple(m).toFixed(1)}` : ''
      };
    }

    // bilateral / asimetria / relacion
    const a = this.bestA(m), b = this.bestB(m);
    if (!a && !b) return { bars: [], refLines, footnote: '' };
    const allVals = [a, b].filter(v => v > 0);
    if (r?.limite != null && !this.isBilateralTipo(m.tipo)) allVals.push(Number(r.limite));
    const maxV = allVals.length ? Math.max(...allVals) * 1.25 : 10;
    if (r?.limite != null && !this.isBilateralTipo(m.tipo)) refLines.push({ yPx: sc(Number(r.limite), maxV), label: `${r.mayor_es_mejor !== false ? '≥' : '≤'}${r.limite}`, color: GOOD });
    const nA = this.nameA(m).slice(0, 7), nB = this.nameB(m).slice(0, 7);
    const bw2 = Math.floor(iW * 0.3), g = Math.floor((iW - 2 * bw2) / 3);
    let footnote = '';
    if (this.isBilateralTipo(m.tipo)) {
      const asim = this.calcAsim(m);
      const asimOk = r?.asimetria_max != null ? asim <= r.asimetria_max : null;
      footnote = `Asim: ${asim.toFixed(1)}%${asimOk === null ? '' : asimOk ? ' ✓' : ' ✗'}`;
    } else {
      footnote = `Ratio: ${this.calcRelacion(m).toFixed(1)}%`;
    }
    return {
      bars: [
        { xPx: g, wPx: bw2, hPx: sc(a, maxV), color: BLUE, topLabel: a ? a.toFixed(1) : undefined, botLabel: nA },
        { xPx: 2 * g + bw2, wPx: bw2, hPx: sc(b, maxV), color: ORG, topLabel: b ? b.toFixed(1) : undefined, botLabel: nB }
      ],
      refLines,
      footnote
    };
  }

  // ── PDF Export ───────────────────────────────────────────────────────────────

  exportPdf(ev: any) {
    const html = this._buildPdfHtml(ev);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = (ev.nombre || 'evaluacion').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    a.href = url;
    a.download = `${safeName}_${ev.fecha || 'sin_fecha'}.html`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  private _buildPdfHtml(ev: any): string {
    const medidas = (ev.medidas || []) as Medida[];
    const fecha = this.formatDate(ev.fecha);
    const analysis: string[] = [];

    let measSections = '';
    medidas.forEach((m, idx) => {
      const { tableHtml, analysisBullets } = this._pdfMedidaBlock(m);
      analysis.push(...analysisBullets);
      const chartSvg = this._buildSvg(m, 260, 130);
      measSections += `
        <div class="meas-block">
          <div class="meas-title">${idx + 1}. ${m.nombre}${m.unidad ? ` <span class="unit">(${m.unidad})</span>` : ''}</div>
          <div class="meas-row">
            <div class="meas-table-wrap">${tableHtml}</div>
            <div class="meas-chart">${chartSvg}</div>
          </div>
        </div>`;
    });

    const analysisSection = analysis.length
      ? `<div class="section-header">${medidas.length + 1}. Análisis e interpretación</div>
         <ul class="analysis-list">${analysis.map(b => `<li>${b}</li>`).join('')}</ul>`
      : '';

    const obsSection = ev.observaciones
      ? `<div class="obs-block"><strong>Observaciones:</strong> ${ev.observaciones}</div>` : '';

    const infoRows = `
      <tr><td class="lbl">Fecha de Evaluación</td><td colspan="3">${fecha}</td></tr>
      ${ev.patient_name ? `<tr><td class="lbl">Paciente</td><td colspan="3">${ev.patient_name}</td></tr>` : ''}
      ${ev.professional_name ? `<tr><td class="lbl">Profesional</td><td colspan="3">${ev.professional_name}</td></tr>` : ''}
    `;

    return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><title>${ev.nombre || 'Evaluación'}</title>
<style>${this._pdfStyles()}</style></head>
<body>
  <div class="page">
    <div class="report-header">
      <div>
        <h1>${(ev.nombre || 'EVALUACIÓN').toUpperCase()}</h1>
        <p class="report-sub">${fecha}</p>
      </div>
    </div>
    <table class="info-table"><tbody>${infoRows}</tbody></table>
    ${measSections}
    ${analysisSection}
    ${obsSection}
    <div class="footer">Reporte generado por SecretarIA</div>
  </div>
  <div class="print-bar">
    <span>Vista previa del reporte</span>
    <button class="print-btn" onclick="window.print()">Imprimir / Guardar PDF</button>
  </div>
  <script><\/script>
</body></html>`;
  }

  private _pdfMedidaBlock(m: Medida): { tableHtml: string; analysisBullets: string[] } {
    const bullets: string[] = [];
    const GREEN = '#16a34a', RED = '#dc2626', GRAY = '#374151';
    let tableHtml = '';

    if (this.isSimpleTipo(m.tipo)) {
      const attempts = this.allAttempts(m);
      const best = this.bestSimple(m);
      const badge = this.badgeForVal(best, m.rango);
      const badgeLabel = badge === null ? '' : badge
        ? `<span style="color:${GREEN};font-weight:700">✓ Bueno</span>`
        : `<span style="color:${RED};font-weight:700">✗ Malo</span>`;
      tableHtml = `<table class="data-table">
        <thead><tr><th>Medida</th>${attempts.length > 1 ? '<th>Intentos</th>' : ''}<th>Mejor</th>${badge !== null ? '<th>Clasif.</th>' : ''}</tr></thead>
        <tbody><tr>
          <td><strong>${m.nombre}</strong>${m.unidad ? ` (${m.unidad})` : ''}</td>
          ${attempts.length > 1 ? `<td style="font-size:11px;color:#6b7280">${attempts.map((a, i) => `T${i + 1}:${a}`).join(', ')}</td>` : ''}
          <td><strong>${best.toFixed(2)}</strong></td>
          ${badge !== null ? `<td>${badgeLabel}</td>` : ''}
        </tr></tbody></table>`;
      if (badge !== null) bullets.push(`<strong>${m.nombre}</strong>: ${best.toFixed(2)} ${m.unidad || ''} — ${badge ? 'dentro del rango óptimo.' : 'fuera del rango óptimo.'}`);

    } else if (this.isBilateralTipo(m.tipo) || this.isRelacionTipo(m.tipo)) {
      const nA = this.nameA(m), nB = this.nameB(m);
      const bA = this.bestA(m), bB = this.bestB(m);
      const attA: string[] = m.intentos_a?.filter((v): v is string => !!v) || (m.izq1 ? [m.izq1, m.izq2, m.izq3].filter((v): v is string => !!v) : []);
      const attB: string[] = m.intentos_b?.filter((v): v is string => !!v) || (m.der1 ? [m.der1, m.der2, m.der3].filter((v): v is string => !!v) : []);
      const hasAttempts = attA.length > 1 || attB.length > 1;
      const badgeA = this.badgeForVal(bA, m.rango);
      const badgeB = this.badgeForVal(bB, m.rango);
      const mkBadge = (v: boolean | null) => v === null ? '' : v
        ? `<span style="color:${GREEN};font-weight:700"> ✓</span>`
        : `<span style="color:${RED};font-weight:700"> ✗</span>`;

      let resultRow = '';
      if (this.isBilateralTipo(m.tipo)) {
        const asim = this.calcAsim(m);
        const asimOk = this.badgeForAsim(asim, m.rango);
        const asimColor = asimOk === null ? GRAY : asimOk ? GREEN : RED;
        resultRow = `<tr class="result-row"><td><em>Asimetría bilateral</em></td>
          ${hasAttempts ? '<td>—</td>' : ''}
          <td colspan="2" style="color:${asimColor};font-weight:700">${asim.toFixed(1)}%${mkBadge(asimOk)}</td></tr>`;
        if (asimOk !== null) bullets.push(`<strong>Asimetría ${m.nombre}</strong>: ${asim.toFixed(1)}% — ${asimOk ? 'dentro del límite aceptable.' : `déficit bilateral relevante (máx: ${m.rango?.asimetria_max}%).`}`);
      } else {
        const ratio = this.calcRelacion(m);
        const ratioOk = this.badgeForVal(ratio, m.rango);
        const ratioColor = ratioOk === null ? GRAY : ratioOk ? GREEN : RED;
        resultRow = `<tr class="result-row"><td><em>Relación ${nA}/${nB}</em></td>
          ${hasAttempts ? '<td>—</td>' : ''}
          <td colspan="2" style="color:${ratioColor};font-weight:700">${ratio.toFixed(1)}%${mkBadge(ratioOk)}</td></tr>`;
        if (ratioOk !== null) bullets.push(`<strong>Ratio ${nA}/${nB}</strong>: ${ratio.toFixed(1)}% — ${ratioOk ? 'dentro del rango óptimo.' : 'fuera del rango óptimo.'}`);
      }

      tableHtml = `<table class="data-table">
        <thead><tr><th>Variable</th>${hasAttempts ? '<th>Intentos</th>' : ''}<th>Mejor</th><th>Clasif.</th></tr></thead>
        <tbody>
          <tr>
            <td><span style="color:#3b82f6">●</span> <strong>${nA}</strong></td>
            ${hasAttempts ? `<td style="font-size:11px;color:#6b7280">${attA.map((a, i) => `T${i + 1}:${a}`).join(', ') || '—'}</td>` : ''}
            <td><strong>${bA.toFixed(2)}</strong></td>
            <td>${mkBadge(badgeA) || '—'}</td>
          </tr>
          <tr>
            <td><span style="color:#f97316">●</span> <strong>${nB}</strong></td>
            ${hasAttempts ? `<td style="font-size:11px;color:#6b7280">${attB.map((a, i) => `T${i + 1}:${a}`).join(', ') || '—'}</td>` : ''}
            <td><strong>${bB.toFixed(2)}</strong></td>
            <td>${mkBadge(badgeB) || '—'}</td>
          </tr>
          ${resultRow}
        </tbody></table>`;
    }

    return { tableHtml, analysisBullets: bullets };
  }

  private _pdfStyles(): string {
    return `
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #1a1a1a; background: white; }
      .page { max-width: 860px; margin: 0 auto; padding: 36px 40px; }
      .report-header { margin-bottom: 20px; border-bottom: 3px solid #16a34a; padding-bottom: 14px; }
      h1 { font-size: 26px; font-weight: 900; color: #16a34a; letter-spacing: 1px; margin-bottom: 4px; }
      .report-sub { font-size: 13px; color: #6b7280; font-style: italic; }
      .info-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 12px; }
      .info-table td { padding: 7px 10px; border: 1px solid #d1d5db; }
      .info-table .lbl { font-weight: 700; background: #f3f4f6; color: #374151; width: 170px; }
      .section-header { font-size: 14px; font-weight: 800; color: #16a34a; margin: 20px 0 10px; text-transform: uppercase; letter-spacing: 0.5px; border-left: 4px solid #16a34a; padding-left: 10px; }
      .meas-block { margin-bottom: 22px; break-inside: avoid; page-break-inside: avoid; }
      .meas-title { font-size: 13px; font-weight: 700; color: #111827; margin-bottom: 10px; }
      .meas-title .unit { font-weight: 400; color: #6b7280; }
      .meas-row { display: flex; gap: 20px; align-items: flex-start; }
      .meas-table-wrap { flex: 1; min-width: 0; }
      .meas-chart { width: 260px; flex-shrink: 0; }
      .data-table { width: 100%; border-collapse: collapse; font-size: 12px; }
      .data-table th { background: #16a34a; color: white; padding: 7px 10px; text-align: left; font-size: 11px; font-weight: 700; }
      .data-table td { padding: 7px 10px; border-bottom: 1px solid #e5e7eb; vertical-align: middle; }
      .data-table tr:last-child td { border-bottom: none; }
      .data-table .result-row td { background: #f0fdf4; font-weight: 600; border-top: 1px solid #d1fae5; }
      .analysis-list { list-style: disc; padding-left: 20px; margin-bottom: 16px; }
      .analysis-list li { padding: 4px 0; font-size: 12px; line-height: 1.5; color: #374151; }
      .obs-block { background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 12px 14px; margin-top: 16px; font-size: 12px; color: #78350f; }
      .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #9ca3af; text-align: center; font-style: italic; }
      .print-bar { position: fixed; top: 0; left: 0; right: 0; background: #16a34a; padding: 10px 20px; display: flex; align-items: center; justify-content: space-between; z-index: 999; box-shadow: 0 2px 8px rgba(0,0,0,0.2); }
      .print-bar span { color: white; font-size: 14px; font-weight: 500; }
      .print-btn { background: white; color: #16a34a; border: none; border-radius: 8px; padding: 8px 20px; font-size: 14px; font-weight: 700; cursor: pointer; }
      .print-btn:hover { background: #f0fdf4; }
      body { padding-top: 52px; }
      @media print {
        .print-bar { display: none; }
        body { padding-top: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .meas-block { break-inside: avoid; }
        .page { padding: 20px; }
      }
    `;
  }

  // ── Excel Export ─────────────────────────────────────────────────────────────

  async downloadEval(ev: any) {
    const mod = await import('exceljs');
    const ExcelJS = (mod as any).default ?? mod;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Evaluación');
    const green = { argb: 'FF16a34a' }, white = { argb: 'FFFFFFFF' };
    const grayBg = { argb: 'FFf3f4f6' }, grayBd = { argb: 'FFd1d5db' };
    const amberBg = { argb: 'FFfffbeb' }, amberBd = { argb: 'FFd97706' }, amberT = { argb: 'FF78350f' };
    const thin = (c: any) => ({ top: { style: 'thin' as const, color: c }, bottom: { style: 'thin' as const, color: c }, left: { style: 'thin' as const, color: c }, right: { style: 'thin' as const, color: c } });
    ws.columns = [{ width: 28 }, { width: 24 }, { width: 24 }, { width: 16 }, { width: 4 }, { width: 38 }];
    ws.mergeCells('A1:F1');
    Object.assign(ws.getCell('A1'), { value: ev.nombre, font: { bold: true, size: 15, color: white }, fill: { type: 'pattern', pattern: 'solid', fgColor: green }, alignment: { vertical: 'middle', horizontal: 'center' } });
    ws.getRow(1).height = 32;
    ws.mergeCells('A2:F2');
    Object.assign(ws.getCell('A2'), { value: this.formatDate(ev.fecha) + (ev.patient_name ? ` · ${ev.patient_name}` : ''), font: { italic: true, size: 11, color: { argb: 'FF6b7280' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFf9fafb' } }, alignment: { horizontal: 'center' } });
    ws.getRow(2).height = 18;
    let row = 4;
    const hRow = ws.getRow(row);
    ['MEDIDA', 'VALOR / A', 'B', 'RESULTADO', '', 'GRÁFICO'].forEach((h, i) => {
      const c = hRow.getCell(i + 1); c.value = h; c.font = { bold: true, size: 9, color: { argb: 'FF374151' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: grayBg }; c.alignment = { horizontal: 'center', vertical: 'middle' }; c.border = thin(grayBd);
    }); hRow.height = 22; row++;
    for (const m of (ev.medidas || []) as Medida[]) {
      const rowStart = row; const eRow = ws.getRow(row); eRow.height = 70;
      const ca = eRow.getCell(1); ca.value = m.nombre || ''; ca.font = { bold: true, size: 11, color: { argb: 'FF166534' } }; ca.alignment = { vertical: 'middle', wrapText: true }; ca.border = thin(grayBd);
      const [vc, vd, ve] = [eRow.getCell(2), eRow.getCell(3), eRow.getCell(4)];
      [vc, vd, ve].forEach(c => { c.font = { size: 11 }; c.alignment = { vertical: 'middle', horizontal: 'center' }; c.border = thin(grayBd); });
      eRow.getCell(5).border = thin(grayBd);
      if (this.isSimpleTipo(m.tipo)) {
        const best = this.bestSimple(m);
        const attempts = this.allAttempts(m);
        vc.value = attempts.length > 1 ? attempts.map((a, i) => `T${i + 1}:${a}`).join(' ') : `${best}`;
        vd.value = m.unidad || '';
        ve.value = this._badgeText(this.badgeForVal(best, m.rango));
      } else {
        const nA = this.nameA(m), nB = this.nameB(m);
        const bA = this.bestA(m), bB = this.bestB(m);
        vc.value = `${nA}: ${bA.toFixed(2)}`;
        vd.value = `${nB}: ${bB.toFixed(2)}`;
        if (this.isBilateralTipo(m.tipo)) ve.value = `Asim: ${this.calcAsim(m).toFixed(1)}%`;
        else ve.value = `Ratio: ${this.calcRelacion(m).toFixed(1)}%`;
      }
      try {
        const b64 = this._chartPng(m, 400, 100);
        const iid = wb.addImage({ base64: b64, extension: 'png' });
        ws.addImage(iid, { tl: { col: 5, row: rowStart - 1 }, br: { col: 6, row: rowStart }, editAs: 'twoCell' } as any);
      } catch { }
      row++;
    }
    if (ev.observaciones) { row++; ws.mergeCells(`A${row}:F${row}`); const oc = ws.getCell(`A${row}`); oc.value = `Observaciones: ${ev.observaciones}`; oc.font = { italic: true, size: 11, color: amberT }; oc.fill = { type: 'pattern', pattern: 'solid', fgColor: amberBg }; oc.border = thin(amberBd); oc.alignment = { wrapText: true, vertical: 'middle', indent: 1 }; ws.getRow(row).height = 28; row++; }
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url;
    a.download = `${(ev.nombre || 'evaluacion').replace(/[^a-z0-9áéíóúñ ]/gi, '_')}.xlsx`; a.click(); URL.revokeObjectURL(url);
  }

  private _badgeText(v: boolean | null): string { return v === null ? '' : v ? 'Bueno ✓' : 'Malo ✗'; }

  private _chartPng(m: Medida, W: number, H: number): string {
    const pl = 12, pr = 12, pt = 22, pb = 28, iW = W - pl - pr, iH = H - pt - pb;
    const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#f9fafb'; ctx.fillRect(0, 0, W, H);
    const cd = this._chartBars(m, iW, iH);
    ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pl, pt + iH); ctx.lineTo(W - pr, pt + iH); ctx.stroke();
    for (const rl of cd.refLines) { ctx.strokeStyle = rl.color; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(pl, pt + iH - rl.yPx); ctx.lineTo(W - pr, pt + iH - rl.yPx); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = rl.color; ctx.font = '8px Arial'; ctx.textAlign = 'right'; ctx.fillText(rl.label, W - pr - 2, pt + iH - rl.yPx - 2); }
    for (const b of cd.bars) { ctx.fillStyle = b.color; const bx = pl + b.xPx, by = pt + iH - b.hPx; ctx.fillRect(bx, by, b.wPx, b.hPx); if (b.topLabel) { ctx.fillStyle = '#374151'; ctx.font = 'bold 9px Arial'; ctx.textAlign = 'center'; ctx.fillText(b.topLabel, bx + b.wPx / 2, by - 3); } if (b.botLabel) { ctx.fillStyle = '#6b7280'; ctx.font = '9px Arial'; ctx.textAlign = 'center'; ctx.fillText(b.botLabel, bx + b.wPx / 2, pt + iH + 14); } }
    if (cd.footnote) { ctx.fillStyle = '#6b7280'; ctx.font = '8px Arial'; ctx.textAlign = 'center'; ctx.fillText(cd.footnote, W / 2, H - 6); }
    return canvas.toDataURL('image/png').split(',')[1];
  }



  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    try { return new Date(dateStr + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' }); }
    catch { return dateStr; }
  }
}

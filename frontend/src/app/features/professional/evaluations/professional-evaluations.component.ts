import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ApiService } from '../../../core/services/api.service';

type Tipo = 'simple' | 'triple' | 'bilateral' | 'bilateral_triple';

interface Rango {
  bueno_min?: number | null;
  bueno_max?: number | null;
  asimetria_max?: number | null;
}

interface Medida {
  nombre: string; unidad: string; tipo: Tipo;
  valor?: string;
  v1?: string; v2?: string; v3?: string;
  valor_izq?: string; valor_der?: string;
  izq1?: string; izq2?: string; izq3?: string;
  der1?: string; der2?: string; der3?: string;
  rango?: Rango; mostrar_rango?: boolean;
}

interface EvalForm {
  nombre: string; fecha: string; observaciones: string;
  medidas: Medida[]; imagenes: string[]; patient_name?: string;
}

const EMPTY_M = (): Medida => ({ nombre: '', unidad: '', tipo: 'simple', valor: '', mostrar_rango: false, rango: {} });
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
          <input [(ngModel)]="form().nombre" placeholder="Ej: Test de fuerza, 6 min walk..." />
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
                <option value="triple">Triple (3 intentos)</option>
                <option value="bilateral">Bilateral (Izq / Der)</option>
                <option value="bilateral_triple">Bilateral + Triple</option>
              </select>
              <input [(ngModel)]="m.unidad" placeholder="Unidad" class="unit-inp" />
              @if (form().medidas.length > 1) {
                <button class="btn-rm" (click)="removeMedida($index)" title="Eliminar">×</button>
              }
            </div>

            <div class="mrow-vals">
              @if (m.tipo === 'simple') {
                <input [(ngModel)]="m.valor" placeholder="Valor" type="number" class="val-inp" />
              }
              @if (m.tipo === 'triple') {
                <span class="side-lbl">T1</span>
                <input [(ngModel)]="m.v1" placeholder="0" type="number" class="val-inp sm" />
                <span class="side-lbl">T2</span>
                <input [(ngModel)]="m.v2" placeholder="0" type="number" class="val-inp sm" />
                <span class="side-lbl">T3</span>
                <input [(ngModel)]="m.v3" placeholder="0" type="number" class="val-inp sm" />
                @if (m.v1 || m.v2 || m.v3) {
                  <span class="computed-lbl">Prom: {{ calcProm(m.v1, m.v2, m.v3) | number:'1.1-2' }} {{ m.unidad }}</span>
                }
              }
              @if (m.tipo === 'bilateral') {
                <span class="side-lbl blue">Izq</span>
                <input [(ngModel)]="m.valor_izq" placeholder="0" type="number" class="val-inp sm" />
                <span class="side-lbl orange">Der</span>
                <input [(ngModel)]="m.valor_der" placeholder="0" type="number" class="val-inp sm" />
                @if (m.valor_izq || m.valor_der) {
                  <span class="computed-lbl">Asim: {{ calcAsim(m.valor_izq, m.valor_der) | number:'1.1-2' }} {{ m.unidad }}</span>
                }
              }
              @if (m.tipo === 'bilateral_triple') {
                <div class="bt-rows">
                  <div class="bt-row">
                    <span class="side-lbl blue">I</span>
                    <input [(ngModel)]="m.izq1" placeholder="1" type="number" class="val-inp xs" />
                    <input [(ngModel)]="m.izq2" placeholder="2" type="number" class="val-inp xs" />
                    <input [(ngModel)]="m.izq3" placeholder="3" type="number" class="val-inp xs" />
                    @if (m.izq1 || m.izq2 || m.izq3) {
                      <span class="computed-lbl">{{ calcProm(m.izq1, m.izq2, m.izq3) | number:'1.1-2' }}</span>
                    }
                  </div>
                  <div class="bt-row">
                    <span class="side-lbl orange">D</span>
                    <input [(ngModel)]="m.der1" placeholder="1" type="number" class="val-inp xs" />
                    <input [(ngModel)]="m.der2" placeholder="2" type="number" class="val-inp xs" />
                    <input [(ngModel)]="m.der3" placeholder="3" type="number" class="val-inp xs" />
                    @if (m.der1 || m.der2 || m.der3) {
                      <span class="computed-lbl">{{ calcProm(m.der1, m.der2, m.der3) | number:'1.1-2' }}</span>
                    }
                  </div>
                  @if ((m.izq1||m.izq2||m.izq3) && (m.der1||m.der2||m.der3)) {
                    <span class="computed-lbl">Asim: {{ calcAsimBT(m) | number:'1.1-2' }} {{ m.unidad }}</span>
                  }
                </div>
              }
            </div>

            <button class="range-toggle" (click)="m.mostrar_rango = !m.mostrar_rango">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 19.07a10 10 0 0 1 0-14.14"/></svg>
              {{ m.mostrar_rango ? 'Ocultar rangos' : '+ Configurar rangos' }}
            </button>

            @if (m.mostrar_rango) {
              <div class="range-row">
                <span class="rlbl">Bueno si ≥</span>
                <input [(ngModel)]="m.rango!.bueno_min" type="number" placeholder="—" class="rinp" />
                <span class="rlbl">Bueno si ≤</span>
                <input [(ngModel)]="m.rango!.bueno_max" type="number" placeholder="—" class="rinp" />
                @if (m.tipo === 'bilateral' || m.tipo === 'bilateral_triple') {
                  <span class="rlbl">Asim. máx.</span>
                  <input [(ngModel)]="m.rango!.asimetria_max" type="number" placeholder="—" class="rinp" />
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
                        <span class="tipo-chip">{{ tipoLabel(m.tipo) }}</span>
                      </div>

                      @if (m.tipo === 'simple') {
                        <div class="vals-block">
                          <span class="big-val">{{ m.valor }}</span>
                          @if (badgeForVal(pn(m.valor), m.rango) !== null) {
                            <span class="badge" [class.badge-good]="badgeForVal(pn(m.valor), m.rango)!" [class.badge-bad]="badgeForVal(pn(m.valor), m.rango) === false">
                              {{ badgeForVal(pn(m.valor), m.rango) ? 'Bueno' : 'Malo' }}
                            </span>
                          }
                        </div>
                      }

                      @if (m.tipo === 'triple') {
                        <div class="vals-block">
                          <div class="triple-row">
                            <span class="trial-chip">T1: {{ m.v1 }}</span>
                            <span class="trial-chip">T2: {{ m.v2 }}</span>
                            <span class="trial-chip">T3: {{ m.v3 }}</span>
                          </div>
                          <div class="prom-row">
                            <span class="prom-lbl">Promedio:</span>
                            <span class="big-val">{{ calcProm(m.v1, m.v2, m.v3) | number:'1.1-2' }}</span>
                            @if (badgeForVal(calcProm(m.v1, m.v2, m.v3), m.rango) !== null) {
                              <span class="badge" [class.badge-good]="badgeForVal(calcProm(m.v1, m.v2, m.v3), m.rango)!" [class.badge-bad]="badgeForVal(calcProm(m.v1, m.v2, m.v3), m.rango) === false">
                                {{ badgeForVal(calcProm(m.v1, m.v2, m.v3), m.rango) ? 'Bueno' : 'Malo' }}
                              </span>
                            }
                          </div>
                        </div>
                      }

                      @if (m.tipo === 'bilateral') {
                        <div class="vals-block">
                          <div class="side-row">
                            <span class="dot blue-dot"></span>
                            <span class="side-name">Izq</span>
                            <span class="side-num">{{ m.valor_izq }}</span>
                            @if (badgeForVal(pn(m.valor_izq), m.rango) !== null) {
                              <span class="badge sm" [class.badge-good]="badgeForVal(pn(m.valor_izq), m.rango)!" [class.badge-bad]="badgeForVal(pn(m.valor_izq), m.rango) === false">{{ badgeForVal(pn(m.valor_izq), m.rango) ? '✓' : '✗' }}</span>
                            }
                          </div>
                          <div class="side-row">
                            <span class="dot orange-dot"></span>
                            <span class="side-name">Der</span>
                            <span class="side-num">{{ m.valor_der }}</span>
                            @if (badgeForVal(pn(m.valor_der), m.rango) !== null) {
                              <span class="badge sm" [class.badge-good]="badgeForVal(pn(m.valor_der), m.rango)!" [class.badge-bad]="badgeForVal(pn(m.valor_der), m.rango) === false">{{ badgeForVal(pn(m.valor_der), m.rango) ? '✓' : '✗' }}</span>
                            }
                          </div>
                          <div class="asim-row">
                            <span class="asim-lbl">Asimetría:</span>
                            <span class="asim-num">{{ calcAsim(m.valor_izq, m.valor_der) | number:'1.1-2' }} {{ m.unidad }}</span>
                            @if (badgeForAsim(calcAsim(m.valor_izq, m.valor_der), m.rango) !== null) {
                              <span class="badge sm" [class.badge-good]="badgeForAsim(calcAsim(m.valor_izq, m.valor_der), m.rango)!" [class.badge-bad]="badgeForAsim(calcAsim(m.valor_izq, m.valor_der), m.rango) === false">{{ badgeForAsim(calcAsim(m.valor_izq, m.valor_der), m.rango) ? '✓' : '✗' }}</span>
                            }
                          </div>
                        </div>
                      }

                      @if (m.tipo === 'bilateral_triple') {
                        <div class="vals-block">
                          <div class="side-row">
                            <span class="dot blue-dot"></span>
                            <span class="side-name">Izq</span>
                            <span class="side-num">{{ calcProm(m.izq1, m.izq2, m.izq3) | number:'1.1-2' }}</span>
                            <span class="trials-mini">({{ m.izq1 }}/{{ m.izq2 }}/{{ m.izq3 }})</span>
                            @if (badgeForVal(calcProm(m.izq1, m.izq2, m.izq3), m.rango) !== null) {
                              <span class="badge sm" [class.badge-good]="badgeForVal(calcProm(m.izq1, m.izq2, m.izq3), m.rango)!" [class.badge-bad]="badgeForVal(calcProm(m.izq1, m.izq2, m.izq3), m.rango) === false">{{ badgeForVal(calcProm(m.izq1, m.izq2, m.izq3), m.rango) ? '✓' : '✗' }}</span>
                            }
                          </div>
                          <div class="side-row">
                            <span class="dot orange-dot"></span>
                            <span class="side-name">Der</span>
                            <span class="side-num">{{ calcProm(m.der1, m.der2, m.der3) | number:'1.1-2' }}</span>
                            <span class="trials-mini">({{ m.der1 }}/{{ m.der2 }}/{{ m.der3 }})</span>
                            @if (badgeForVal(calcProm(m.der1, m.der2, m.der3), m.rango) !== null) {
                              <span class="badge sm" [class.badge-good]="badgeForVal(calcProm(m.der1, m.der2, m.der3), m.rango)!" [class.badge-bad]="badgeForVal(calcProm(m.der1, m.der2, m.der3), m.rango) === false">{{ badgeForVal(calcProm(m.der1, m.der2, m.der3), m.rango) ? '✓' : '✗' }}</span>
                            }
                          </div>
                          <div class="asim-row">
                            <span class="asim-lbl">Asimetría:</span>
                            <span class="asim-num">{{ calcAsimBT(m) | number:'1.1-2' }} {{ m.unidad }}</span>
                            @if (badgeForAsim(calcAsimBT(m), m.rango) !== null) {
                              <span class="badge sm" [class.badge-good]="badgeForAsim(calcAsimBT(m), m.rango)!" [class.badge-bad]="badgeForAsim(calcAsimBT(m), m.rango) === false">{{ badgeForAsim(calcAsimBT(m), m.rango) ? '✓' : '✗' }}</span>
                            }
                          </div>
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

    /* ── Form ── */
    .form-card { background:white; border-radius:16px; padding:28px; margin-bottom:20px; box-shadow:0 1px 6px rgba(0,0,0,0.07); }
    .form-card h3 { font-size:17px; font-weight:700; color:#111827; margin:0 0 20px; }
    .fields-row-2 { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:14px; }
    .field { display:flex; flex-direction:column; gap:6px; }
    .mb14 { margin-bottom:14px; }
    label { font-size:13px; font-weight:500; color:#374151; }
    input, textarea, select { padding:10px 12px; border:1.5px solid #e5e7eb; border-radius:8px; font-size:14px; outline:none; font-family:inherit; resize:vertical; box-sizing:border-box; }
    input:focus, textarea:focus, select:focus { border-color:#16a34a; }

    /* ── Medidas section ── */
    .measures-section { margin-bottom:14px; }
    .measures-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; }
    .measures-header h4 { font-size:14px; font-weight:700; color:#374151; margin:0; }
    .btn-add-circle { width:32px; height:32px; border-radius:50%; background:#f0fdf4; color:#16a34a; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .btn-add-circle:hover { background:#16a34a; color:white; }

    .mcard-form { background:#f9fafb; border:1.5px solid #e5e7eb; border-radius:12px; padding:14px; margin-bottom:10px; display:flex; flex-direction:column; gap:10px; }
    .mrow-header { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
    .flex-grow { flex:1; min-width:120px; }
    .tipo-sel { min-width:160px; }
    .unit-inp { width:90px; }
    .btn-rm { width:32px; height:32px; border-radius:6px; border:none; background:#fee2e2; color:#ef4444; cursor:pointer; font-size:18px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .btn-rm:hover { background:#ef4444; color:white; }

    .mrow-vals { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
    .val-inp { width:100px; }
    .val-inp.sm { width:80px; }
    .val-inp.xs { width:62px; }
    .side-lbl { font-size:12px; font-weight:700; padding:3px 7px; border-radius:4px; background:#e5e7eb; color:#374151; }
    .side-lbl.blue { background:#dbeafe; color:#1d4ed8; }
    .side-lbl.orange { background:#ffedd5; color:#c2410c; }
    .computed-lbl { font-size:12px; color:#6b7280; background:#f3f4f6; padding:4px 8px; border-radius:6px; white-space:nowrap; }
    .bt-rows { display:flex; flex-direction:column; gap:6px; }
    .bt-row { display:flex; align-items:center; gap:6px; }

    .range-toggle { display:inline-flex; align-items:center; gap:5px; font-size:12px; color:#6366f1; cursor:pointer; border:none; background:none; padding:0; font-family:inherit; }
    .range-toggle:hover { color:#4f46e5; }
    .range-row { display:flex; align-items:center; gap:8px; flex-wrap:wrap; background:white; border:1px solid #e5e7eb; border-radius:8px; padding:10px; }
    .rlbl { font-size:12px; color:#6b7280; white-space:nowrap; }
    .rinp { width:72px; padding:6px 8px; font-size:13px; }

    .form-actions { display:flex; gap:10px; justify-content:flex-end; margin-top:8px; }
    .error-banner { background:#fef2f2; color:#dc2626; border:1px solid #fecaca; border-radius:8px; padding:10px 14px; font-size:14px; }

    /* ── Eval list ── */
    .evals-list { display:flex; flex-direction:column; gap:16px; }
    .eval-card { background:white; border-radius:16px; padding:22px; box-shadow:0 1px 6px rgba(0,0,0,0.06); }
    .eval-header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:16px; gap:10px; }
    .eval-card h3 { font-size:16px; font-weight:700; color:#111827; margin:0 0 6px; }
    .eval-meta { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
    .eval-date { font-size:12px; color:#9ca3af; }
    .prof-badge { padding:2px 8px; background:#f0fdf4; color:#16a34a; border-radius:20px; font-size:11px; font-weight:600; }
    .guest-badge { padding:2px 8px; background:#fef3c7; color:#92400e; border-radius:20px; font-size:11px; font-weight:600; }
    .eval-actions { display:flex; gap:8px; flex-shrink:0; }
    .btn-icon { width:32px; height:32px; border-radius:8px; border:1.5px solid #e5e7eb; background:white; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#6b7280; transition:all 0.15s; }
    .btn-icon:hover { border-color:#16a34a; color:#16a34a; }
    .btn-icon.danger:hover { border-color:#ef4444; color:#ef4444; }

    /* ── Medida view cards ── */
    .meds-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); gap:12px; margin-bottom:12px; }
    .mcard-view { background:#f9fafb; border:1px solid #e5e7eb; border-radius:12px; overflow:hidden; }
    .mcard-top { display:flex; gap:0; }
    .mcard-info { flex:1; padding:14px; display:flex; flex-direction:column; gap:10px; min-width:0; }
    .mcard-title-row { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
    .mcard-name { font-size:14px; font-weight:700; color:#111827; }
    .mcard-unit { font-size:12px; color:#9ca3af; }
    .tipo-chip { font-size:10px; padding:2px 6px; background:#ede9fe; color:#6d28d9; border-radius:4px; font-weight:600; margin-left:auto; white-space:nowrap; }
    .mcard-chart { width:210px; flex-shrink:0; display:flex; align-items:center; justify-content:center; background:#f3f4f6; padding:8px 4px; }

    .vals-block { display:flex; flex-direction:column; gap:6px; }
    .big-val { font-size:22px; font-weight:800; color:#16a34a; }
    .badge { display:inline-flex; align-items:center; padding:2px 8px; border-radius:12px; font-size:11px; font-weight:700; }
    .badge.sm { padding:1px 5px; font-size:10px; }
    .badge-good { background:#dcfce7; color:#166534; }
    .badge-bad { background:#fee2e2; color:#991b1b; }
    .triple-row { display:flex; gap:6px; flex-wrap:wrap; }
    .trial-chip { font-size:12px; background:#e0e7ff; color:#3730a3; border-radius:6px; padding:3px 8px; }
    .prom-row { display:flex; align-items:center; gap:8px; }
    .prom-lbl { font-size:12px; color:#6b7280; }
    .side-row { display:flex; align-items:center; gap:6px; }
    .dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
    .blue-dot { background:#3b82f6; }
    .orange-dot { background:#f97316; }
    .side-name { font-size:12px; font-weight:600; color:#374151; width:28px; }
    .side-num { font-size:15px; font-weight:700; color:#111827; }
    .trials-mini { font-size:11px; color:#9ca3af; }
    .asim-row { display:flex; align-items:center; gap:6px; padding-top:4px; border-top:1px solid #e5e7eb; margin-top:2px; }
    .asim-lbl { font-size:11px; color:#6b7280; }
    .asim-num { font-size:13px; font-weight:600; color:#374151; }

    .obs-box { background:#fffbeb; border-radius:10px; padding:12px 14px; margin-top:10px; }
    .obs-label { display:block; font-size:11px; font-weight:600; color:#92400e; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px; }
    .obs-box p { font-size:14px; color:#78350f; margin:0; line-height:1.5; }

    .images-row { display:flex; flex-wrap:wrap; gap:8px; margin-top:10px; }
    .img-link { display:inline-flex; align-items:center; gap:5px; padding:5px 10px; background:#f3f4f6; border-radius:8px; font-size:12px; color:#6366f1; text-decoration:none; }
    .img-link:hover { background:#ede9fe; }

    /* ── Shared ── */
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
      .mcard-chart { width:100%; }
      .header-left { flex-direction:column; gap:10px; }
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
    this.form.set(EMPTY_F());
    this.imagenesText = '';
    this.editingId.set(null);
    this.formError.set('');
    this.showForm.set(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  closeForm() { this.showForm.set(false); this.editingId.set(null); this.formError.set(''); }

  editEval(ev: any) {
    this.editingId.set(ev.id);
    this.form.set({
      nombre: ev.nombre || '',
      fecha: ev.fecha || new Date().toISOString().split('T')[0],
      observaciones: ev.observaciones || '',
      medidas: ev.medidas?.length ? ev.medidas.map((m: any) => ({ ...EMPTY_M(), ...m })) : [EMPTY_M()],
      imagenes: ev.imagenes || [],
      patient_name: ev.patient_name || ''
    });
    this.guestName = ev.patient_name || '';
    this.imagenesText = (ev.imagenes || []).join('\n');
    this.formError.set('');
    this.showForm.set(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  addMedida() { this.form.update(f => ({ ...f, medidas: [...f.medidas, EMPTY_M()] })); }
  removeMedida(i: number) { this.form.update(f => ({ ...f, medidas: f.medidas.filter((_, j) => j !== i) })); }
  resetMedida(m: Medida) { Object.assign(m, EMPTY_M(), { nombre: m.nombre, unidad: m.unidad, tipo: m.tipo, rango: m.rango, mostrar_rango: m.mostrar_rango }); }

  saveEval() {
    const f = this.form();
    if (!f.nombre.trim()) { this.formError.set('El nombre es obligatorio'); return; }
    if (!f.fecha) { this.formError.set('La fecha es obligatoria'); return; }
    this.saving.set(true);
    this.formError.set('');
    const imagenes = this.imagenesText.split('\n').map(s => s.trim()).filter(Boolean);
    const payload = { ...f, imagenes, patient_id: this.patientId, patient_name: this.isGuest ? this.guestName : '' };
    const id = this.editingId();
    const obs$ = id ? this.api.updateEvaluation(id, this.patientId, { ...f, imagenes }) : this.api.createEvaluation(payload);
    obs$.subscribe({
      next: () => { this.saving.set(false); this.closeForm(); this.load(); },
      error: (err) => { this.formError.set(err.error?.detail || 'Error al guardar'); this.saving.set(false); }
    });
  }

  deleteEval(id: string) {
    if (!confirm('¿Eliminar esta evaluación?')) return;
    this.api.deleteEvaluation(id, this.patientId).subscribe({
      next: () => this.evals.update(ev => ev.filter(e => e.id !== id))
    });
  }

  // ── Calculation helpers ──────────────────────────────────────────────────────

  pn(s?: string | number): number { return parseFloat(String(s ?? '0')) || 0; }

  calcProm(a?: string, b?: string, c?: string): number {
    const vals = [this.pn(a), this.pn(b), this.pn(c)].filter(v => v !== 0);
    return vals.length ? vals.reduce((x, y) => x + y, 0) / vals.length : 0;
  }

  calcAsim(izq?: string, der?: string): number { return Math.abs(this.pn(izq) - this.pn(der)); }

  calcAsimBT(m: Medida): number {
    return Math.abs(this.calcProm(m.izq1, m.izq2, m.izq3) - this.calcProm(m.der1, m.der2, m.der3));
  }

  badgeForVal(v: number, r?: Rango): boolean | null {
    if (!r || (r.bueno_min == null && r.bueno_max == null)) return null;
    let ok = true;
    if (r.bueno_min != null && v < r.bueno_min) ok = false;
    if (r.bueno_max != null && v > r.bueno_max) ok = false;
    return ok;
  }

  badgeForAsim(v: number, r?: Rango): boolean | null {
    if (!r?.asimetria_max) return null;
    return v <= r.asimetria_max;
  }

  tipoLabel(t?: Tipo): string {
    return { simple: 'Simple', triple: 'Triple', bilateral: 'Bilateral', bilateral_triple: 'Bil.+Triple' }[t || 'simple'] ?? t ?? '';
  }

  // ── Chart SVG ────────────────────────────────────────────────────────────────

  chartSvg(m: Medida): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(this._buildSvg(m, 210, 110));
  }

  private _buildSvg(m: Medida, W: number, H: number): string {
    const pl = 10, pr = 10, pt = 20, pb = 28;
    const iW = W - pl - pr, iH = H - pt - pb;
    const cd = this._chartBars(m, iW, iH);
    if (!cd.bars.length) return `<svg width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#f3f4f6" rx="6"/><text x="${W/2}" y="${H/2+4}" text-anchor="middle" font-size="11" fill="#9ca3af">Sin datos</text></svg>`;

    let s = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`;
    s += `<rect width="${W}" height="${H}" fill="#f9fafb" rx="6"/>`;
    // floor line
    s += `<line x1="${pl}" y1="${pt+iH}" x2="${W-pr}" y2="${pt+iH}" stroke="#e5e7eb" stroke-width="1"/>`;
    // ref lines
    for (const rl of cd.refLines) {
      const ry = pt + iH - rl.yPx;
      s += `<line x1="${pl}" y1="${ry}" x2="${W-pr}" y2="${ry}" stroke="${rl.color}" stroke-width="1" stroke-dasharray="4 3" opacity="0.7"/>`;
      s += `<text x="${W-pr-2}" y="${ry-2}" font-size="8" fill="${rl.color}" text-anchor="end">${rl.label}</text>`;
    }
    // bars
    for (const b of cd.bars) {
      const bx = pl + b.xPx, by = pt + iH - b.hPx;
      s += `<rect x="${bx}" y="${by}" width="${b.wPx}" height="${b.hPx}" fill="${b.color}" rx="3" opacity="0.85"/>`;
      if (b.topLabel) s += `<text x="${bx+b.wPx/2}" y="${by-3}" font-size="9" fill="#374151" text-anchor="middle" font-weight="600">${b.topLabel}</text>`;
      if (b.botLabel) s += `<text x="${bx+b.wPx/2}" y="${pt+iH+14}" font-size="9" fill="#6b7280" text-anchor="middle">${b.botLabel}</text>`;
    }
    // footnote
    if (cd.footnote) s += `<text x="${W/2}" y="${H-6}" font-size="8" fill="#6b7280" text-anchor="middle">${cd.footnote}</text>`;
    s += `</svg>`;
    return s;
  }

  private _chartBars(m: Medida, iW: number, iH: number): {
    bars: { xPx: number; wPx: number; hPx: number; color: string; topLabel?: string; botLabel?: string }[];
    refLines: { yPx: number; label: string; color: string }[];
    footnote?: string;
  } {
    const pn = this.pn.bind(this);
    const GOOD = '#16a34a', BAD = '#ef4444', NEU = '#818cf8';
    const BLUE = '#3b82f6', ORG = '#f97316';
    const BLUES = ['#93c5fd', '#60a5fa', '#3b82f6'];
    const ORGS  = ['#fed7aa', '#fb923c', '#f97316'];

    const classify = (v: number) => {
      const r = m.rango;
      if (!r || (r.bueno_min == null && r.bueno_max == null)) return NEU;
      let ok = true;
      if (r.bueno_min != null && v < r.bueno_min) ok = false;
      if (r.bueno_max != null && v > r.bueno_max) ok = false;
      return ok ? GOOD : BAD;
    };

    const allVals = [
      pn(m.valor), pn(m.v1), pn(m.v2), pn(m.v3),
      pn(m.valor_izq), pn(m.valor_der),
      pn(m.izq1), pn(m.izq2), pn(m.izq3),
      pn(m.der1), pn(m.der2), pn(m.der3),
      m.rango?.bueno_min ?? 0, m.rango?.bueno_max ?? 0
    ].filter(v => v > 0);
    const maxVal = allVals.length ? Math.max(...allVals) * 1.25 : 10;
    const sc = (v: number) => Math.max((v / maxVal) * iH, 2);

    const refLines: { yPx: number; label: string; color: string }[] = [];
    if (m.rango?.bueno_min) refLines.push({ yPx: sc(m.rango.bueno_min), label: `≥${m.rango.bueno_min}`, color: GOOD });
    if (m.rango?.bueno_max) refLines.push({ yPx: sc(m.rango.bueno_max), label: `≤${m.rango.bueno_max}`, color: '#f59e0b' });

    if (m.tipo === 'simple') {
      const v = pn(m.valor);
      return { bars: [{ xPx: iW/2-25, wPx: 50, hPx: sc(v), color: classify(v), topLabel: `${v}` }], refLines };
    }

    if (m.tipo === 'triple') {
      const vals = [pn(m.v1), pn(m.v2), pn(m.v3)];
      const prom = vals.reduce((a,b)=>a+b,0) / 3;
      const bw = Math.floor(iW / 5), gap = (iW - 3*bw) / 4;
      const bars = vals.map((v, i) => ({
        xPx: gap*(i+1)+bw*i, wPx: bw, hPx: sc(v),
        color: classify(v), topLabel: v ? `${v}` : undefined, botLabel: `T${i+1}`
      }));
      return { bars, refLines: [...refLines, { yPx: sc(prom), label: `̄x=${prom.toFixed(1)}`, color: '#374151' }],
        footnote: `Prom: ${prom.toFixed(1)} ${m.unidad}` };
    }

    if (m.tipo === 'bilateral') {
      const izq = pn(m.valor_izq), der = pn(m.valor_der);
      const asim = Math.abs(izq - der);
      const asimOk = m.rango?.asimetria_max != null ? asim <= m.rango.asimetria_max : null;
      const bw = Math.floor(iW * 0.28);
      const g1 = Math.floor(iW * 0.18), g2 = iW - g1*2 - bw*2 - g1;
      return {
        bars: [
          { xPx: g1, wPx: bw, hPx: sc(izq), color: BLUE, topLabel: `${izq}`, botLabel: 'Izq' },
          { xPx: g1+bw+g2, wPx: bw, hPx: sc(der), color: ORG, topLabel: `${der}`, botLabel: 'Der' }
        ],
        refLines,
        footnote: `Asim: ${asim.toFixed(1)} ${m.unidad}${asimOk === null ? '' : asimOk ? ' ✓' : ' ✗'}`
      };
    }

    if (m.tipo === 'bilateral_triple') {
      const iVals = [pn(m.izq1), pn(m.izq2), pn(m.izq3)];
      const dVals = [pn(m.der1), pn(m.der2), pn(m.der3)];
      const pIzq = this.calcProm(m.izq1, m.izq2, m.izq3);
      const pDer = this.calcProm(m.der1, m.der2, m.der3);
      const asim = Math.abs(pIzq - pDer);
      const bw = Math.floor(iW / 9), gap = 3, groupGap = Math.floor(iW * 0.08);
      const gW = 3*bw + 2*gap;
      const startI = Math.floor((iW - 2*gW - groupGap) / 2);
      const startD = startI + gW + groupGap;
      const bars = [
        ...iVals.map((v, i) => ({ xPx: startI+i*(bw+gap), wPx: bw, hPx: sc(v), color: BLUES[i], botLabel: i===1?'Izq':undefined })),
        ...dVals.map((v, i) => ({ xPx: startD+i*(bw+gap), wPx: bw, hPx: sc(v), color: ORGS[i],  botLabel: i===1?'Der':undefined }))
      ];
      return { bars, refLines, footnote: `I:${pIzq.toFixed(1)} D:${pDer.toFixed(1)} Asim:${asim.toFixed(1)}${m.unidad?` ${m.unidad}`:''}` };
    }

    return { bars: [], refLines: [] };
  }

  // ── Excel download ───────────────────────────────────────────────────────────

  async downloadEval(ev: any) {
    const mod = await import('exceljs');
    const ExcelJS = (mod as any).default ?? mod;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Evaluación');

    const green    = { argb: 'FF16a34a' };
    const greenDk  = { argb: 'FF166534' };
    const grayBg   = { argb: 'FFf3f4f6' };
    const grayBord = { argb: 'FFd1d5db' };
    const white    = { argb: 'FFFFFFFF' };
    const amberBg  = { argb: 'FFfffbeb' };
    const amberBord= { argb: 'FFd97706' };
    const amberTxt = { argb: 'FF78350f' };
    const thin = (c: any) => ({ top:{style:'thin' as const,color:c},bottom:{style:'thin' as const,color:c},left:{style:'thin' as const,color:c},right:{style:'thin' as const,color:c} });

    ws.columns = [{ width: 26 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 14 }, { width: 4 }, { width: 38 }];

    // Title
    ws.mergeCells('A1:G1');
    const t = ws.getCell('A1');
    t.value = ev.nombre; t.font = { bold:true, size:15, color:white };
    t.fill = { type:'pattern', pattern:'solid', fgColor:green };
    t.alignment = { vertical:'middle', horizontal:'center' }; ws.getRow(1).height = 32;

    // Date + patient
    ws.mergeCells('A2:G2');
    const d = ws.getCell('A2');
    const patName = ev.patient_name ? ` · ${ev.patient_name}` : '';
    d.value = this.formatDate(ev.fecha) + patName;
    d.font = { italic:true, size:11, color:{ argb:'FF6b7280' } };
    d.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FFf9fafb' } };
    d.alignment = { horizontal:'center' }; ws.getRow(2).height = 18;

    let row = 4;

    // Column headers
    const hRow = ws.getRow(row);
    ['MEDIDA','TIPO','VALOR / IZQUIERDO','DERECHO / T2','ASIMETRÍA / T3','','GRÁFICO'].forEach((h, i) => {
      const c = hRow.getCell(i+1); c.value = h;
      c.font = { bold:true, size:9, color:{ argb:'FF374151' } };
      c.fill = { type:'pattern', pattern:'solid', fgColor:grayBg };
      c.alignment = { horizontal:'center', vertical:'middle' }; c.border = thin(grayBord);
    }); hRow.height = 22; row++;

    for (const m of (ev.medidas || []) as Medida[]) {
      const rowStart = row;
      const eRow = ws.getRow(row);
      eRow.height = 70;

      // Column A: nombre
      const ca = eRow.getCell(1); ca.value = m.nombre || '';
      ca.font = { bold:true, size:11, color:greenDk }; ca.alignment = { vertical:'middle', wrapText:true };
      ca.border = thin(grayBord);

      // Column B: tipo
      const cb = eRow.getCell(2); cb.value = this.tipoLabel(m.tipo as Tipo);
      cb.font = { size:10, color:{ argb:'FF6d28d9' } }; cb.alignment = { vertical:'middle', horizontal:'center' };
      cb.border = thin(grayBord);

      // Columns C, D, E: values
      const valC = eRow.getCell(3), valD = eRow.getCell(4), valE = eRow.getCell(5);
      [valC, valD, valE].forEach(c => { c.font = { size:11 }; c.alignment = { vertical:'middle', horizontal:'center' }; c.border = thin(grayBord); });

      if (m.tipo === 'simple') {
        valC.value = this.pn(m.valor);
        valD.value = m.unidad || '';
        valE.value = this._badgeText(this.badgeForVal(this.pn(m.valor), m.rango as Rango));
      } else if (m.tipo === 'triple') {
        const prom = this.calcProm(m.v1, m.v2, m.v3);
        valC.value = `T1:${m.v1} T2:${m.v2} T3:${m.v3}`;
        valD.value = `Prom: ${prom.toFixed(2)} ${m.unidad||''}`;
        valE.value = this._badgeText(this.badgeForVal(prom, m.rango as Rango));
      } else if (m.tipo === 'bilateral') {
        const asim = this.calcAsim(m.valor_izq, m.valor_der);
        valC.value = `Izq: ${m.valor_izq} ${m.unidad||''}`;
        valD.value = `Der: ${m.valor_der} ${m.unidad||''}`;
        valE.value = `Asim: ${asim.toFixed(2)}`;
      } else if (m.tipo === 'bilateral_triple') {
        const pI = this.calcProm(m.izq1, m.izq2, m.izq3);
        const pD = this.calcProm(m.der1, m.der2, m.der3);
        valC.value = `Izq: ${pI.toFixed(2)} (${m.izq1}/${m.izq2}/${m.izq3})`;
        valD.value = `Der: ${pD.toFixed(2)} (${m.der1}/${m.der2}/${m.der3})`;
        valE.value = `Asim: ${this.calcAsimBT(m).toFixed(2)} ${m.unidad||''}`;
      }

      // Column F: spacer
      eRow.getCell(6).border = thin(grayBord);

      // Column G: chart image
      try {
        const chartBase64 = this._chartPng(m as Medida, 260, 90);
        const imgId = wb.addImage({ base64: chartBase64, extension: 'png' });
        ws.addImage(imgId, { tl: { col: 6, row: rowStart - 1 }, ext: { width: 260, height: 90 } } as any);
      } catch { /* skip chart if canvas fails */ }

      row++;
    }

    // Observations
    if (ev.observaciones) {
      row++;
      ws.mergeCells(`A${row}:G${row}`);
      const oc = ws.getCell(`A${row}`);
      oc.value = `Observaciones: ${ev.observaciones}`;
      oc.font = { italic:true, size:11, color:amberTxt };
      oc.fill = { type:'pattern', pattern:'solid', fgColor:amberBg };
      oc.border = thin(amberBord);
      oc.alignment = { wrapText:true, vertical:'middle', indent:1 }; ws.getRow(row).height = 28; row++;
    }

    // Drive images
    if (ev.imagenes?.length) {
      row++;
      ws.mergeCells(`A${row}:G${row}`);
      ws.getCell(`A${row}`).value = 'IMÁGENES';
      ws.getCell(`A${row}`).font = { bold:true, size:9, color:{ argb:'FF374151' } };
      ws.getCell(`A${row}`).fill = { type:'pattern', pattern:'solid', fgColor:grayBg };
      ws.getRow(row).height = 18; row++;

      for (const imgUrl of ev.imagenes) {
        try {
          const b64 = await this._tryLoadImageBase64(imgUrl);
          if (b64) {
            const ext = imgUrl.toLowerCase().includes('.png') ? 'png' : 'jpeg';
            const iId = wb.addImage({ base64: b64, extension: ext });
            ws.getRow(row).height = 150;
            ws.addImage(iId, { tl: { col: 0, row: row - 1 }, ext: { width: 300, height: 200 } } as any);
            row += 12;
          }
        } catch { /* skip */ }
      }
    }

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `${(ev.nombre||'evaluacion').replace(/[^a-z0-9áéíóúñ ]/gi,'_')}.xlsx`;
    a.click(); URL.revokeObjectURL(url);
  }

  private _badgeText(v: boolean | null): string {
    if (v === null) return '';
    return v ? 'Bueno ✓' : 'Malo ✗';
  }

  private _chartPng(m: Medida, W: number, H: number): string {
    const pl = 12, pr = 12, pt = 22, pb = 30;
    const iW = W - pl - pr, iH = H - pt - pb;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#f9fafb';
    ctx.beginPath(); ctx.roundRect(0, 0, W, H, 6); ctx.fill();

    const cd = this._chartBars(m, iW, iH);
    // floor
    ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 1; ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(pl, pt+iH); ctx.lineTo(W-pr, pt+iH); ctx.stroke();

    // ref lines
    for (const rl of cd.refLines) {
      ctx.strokeStyle = rl.color; ctx.setLineDash([4, 3]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(pl, pt+iH-rl.yPx); ctx.lineTo(W-pr, pt+iH-rl.yPx); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = rl.color; ctx.font = '8px Arial'; ctx.textAlign = 'right';
      ctx.fillText(rl.label, W-pr-2, pt+iH-rl.yPx-2);
    }

    // bars
    for (const b of cd.bars) {
      ctx.fillStyle = b.color;
      const bx = pl + b.xPx, by = pt + iH - b.hPx;
      ctx.beginPath(); ctx.roundRect(bx, by, b.wPx, b.hPx, 3); ctx.fill();
      ctx.globalAlpha = 0.85; ctx.fill(); ctx.globalAlpha = 1;
      if (b.topLabel) {
        ctx.fillStyle = '#374151'; ctx.font = 'bold 9px Arial'; ctx.textAlign = 'center';
        ctx.fillText(b.topLabel, bx+b.wPx/2, by-3);
      }
      if (b.botLabel) {
        ctx.fillStyle = '#6b7280'; ctx.font = '9px Arial'; ctx.textAlign = 'center';
        ctx.fillText(b.botLabel, bx+b.wPx/2, pt+iH+14);
      }
    }

    if (cd.footnote) {
      ctx.fillStyle = '#6b7280'; ctx.font = '8px Arial'; ctx.textAlign = 'center';
      ctx.fillText(cd.footnote, W/2, H-6);
    }

    return canvas.toDataURL('image/png').split(',')[1];
  }

  private async _tryLoadImageBase64(url: string): Promise<string | null> {
    try {
      const directUrl = this._toDriveUrl(url);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject();
        img.src = directUrl;
        setTimeout(() => reject(), 8000);
      });
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || 600;
      canvas.height = img.naturalHeight || 400;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const ext = url.toLowerCase().includes('.png') ? 'image/png' : 'image/jpeg';
      return canvas.toDataURL(ext).split(',')[1];
    } catch { return null; }
  }

  private _toDriveUrl(url: string): string {
    const m = url.match(/drive\.google\.com\/file\/d\/([^/?#]+)/);
    if (m) return `https://drive.google.com/thumbnail?id=${m[1]}&sz=w800`;
    const m2 = url.match(/[?&]id=([^&]+)/);
    if (m2) return `https://drive.google.com/thumbnail?id=${m2[1]}&sz=w800`;
    return url;
  }

  // ── Utility ──────────────────────────────────────────────────────────────────

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    try { return new Date(dateStr + 'T00:00:00').toLocaleDateString('es-AR', { day:'2-digit', month:'long', year:'numeric' }); }
    catch { return dateStr; }
  }
}

import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';

interface Exercise { nombre: string; enlace: string; reps_seg_mts: string; carga: string; }
interface Circuit  { nombre: string; rondas: string; ejercicios: Exercise[]; }
interface Routine  { id?: string; titulo: string; descripcion: string; circuitos: Circuit[]; observaciones: string; }

const EMPTY_EX  = (): Exercise => ({ nombre: '', enlace: '', reps_seg_mts: '', carga: '' });
const EMPTY_CIR = (): Circuit  => ({ nombre: '', rondas: '', ejercicios: [EMPTY_EX()] });
const EMPTY_ROU = (): Routine  => ({ titulo: '', descripcion: '', circuitos: [EMPTY_CIR()], observaciones: '' });

@Component({
  selector: 'app-manage-routines',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="page">
      <!-- ── Header ─────────────────────────────────────── -->
      <div class="page-header">
        <div class="header-left">
          <a [routerLink]="['/professional/patients', patientId]" class="btn-back">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
            Volver
          </a>
          <div>
            <h1>Rutinas de ejercicios</h1>
            <p class="subtitle">Gestioná los planes asignados al paciente</p>
          </div>
        </div>
        @if (!showForm() || editing()) {
          <button class="btn-new" (click)="openNew()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Nueva rutina
          </button>
        }
      </div>

      @if (loading()) {
        <div class="loading-text">Cargando rutinas...</div>
      } @else {

        <!-- ── Formulario nueva rutina ──────────────────── -->
        @if (showForm() && !editing()) {
          <div class="routine-card is-editing">
            <ng-container *ngTemplateOutlet="editCard"></ng-container>
          </div>
        }

        <!-- ── Estado vacío ────────────────────────────── -->
        @if (routines().length === 0 && !showForm()) {
          <div class="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" stroke-width="1.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            <p>No hay rutinas asignadas todavía</p>
            <button class="btn-new" (click)="openNew()">Crear primera rutina</button>
          </div>
        }

        <!-- ── Lista de rutinas ─────────────────────────── -->
        <div class="routines-list">
          @for (r of routines(); track r.id) {

            @if (editing() === r.id && showForm()) {
              <!-- Modo edición inline -->
              <div class="routine-card is-editing">
                <ng-container *ngTemplateOutlet="editCard"></ng-container>
              </div>

            } @else {
              <!-- Modo lectura -->
              <div class="routine-card">
                <div class="card-topbar">
                  <h3 class="card-title">{{ r.titulo }}</h3>
                  <div class="topbar-actions">
                    <button class="btn-icon" (click)="openEdit(r)" title="Editar">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button class="btn-icon danger" (click)="confirmDelete(r)" title="Eliminar">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                    </button>
                  </div>
                </div>

                @if (r.descripcion) { <p class="card-desc">{{ r.descripcion }}</p> }

                @for (circ of r.circuitos; track $index) {
                  <div class="bloque-read">
                    <div class="bloque-read-header">
                      <span class="bloque-label">{{ circ.nombre || ('bloque ' + ($index + 1)) }}</span>
                      @if (circ.rondas) { <span class="rondas-badge">{{ circ.rondas }} rondas</span> }
                    </div>
                    <div class="ex-table">
                      <div class="ex-head read">
                        <span>EJERCICIO</span><span>ENLACE</span><span>REP/SEG/MTS</span><span>CARGA</span>
                      </div>
                      @for (ex of circ.ejercicios; track $index) {
                        <div class="ex-row-read">
                          <span>{{ ex.nombre }}</span>
                          <span>
                            @if (ex.enlace || ex.descripcion) {
                              <a [href]="ex.enlace || ex.descripcion" target="_blank" class="link-ex">Ver video</a>
                            }
                          </span>
                          <span>{{ ex.reps_seg_mts }}</span>
                          <span>{{ ex.carga }}</span>
                        </div>
                      }
                    </div>
                  </div>
                }

                @if (r.observaciones) {
                  <div class="obs-box">
                    <span class="obs-label">Observaciones</span>
                    <p>{{ r.observaciones }}</p>
                  </div>
                }
              </div>
            }
          }
        </div>
      }

      <!-- ── Modal eliminar ──────────────────────────── -->
      @if (deletingRoutine()) {
        <div class="modal-overlay" (click)="deletingRoutine.set(null)">
          <div class="modal" (click)="$event.stopPropagation()">
            <h3>¿Eliminar rutina?</h3>
            <p>Se eliminará <strong>{{ deletingRoutine()!.titulo }}</strong> permanentemente.</p>
            <div class="modal-actions">
              <button class="btn-cancel-sm" (click)="deletingRoutine.set(null)">Cancelar</button>
              <button class="btn-danger" (click)="deleteRoutine()">Eliminar</button>
            </div>
          </div>
        </div>
      }
    </div>

    <!-- ── Template de edición (reutilizado por nueva y editar) ── -->
    <ng-template #editCard>
      <div class="card-topbar">
        <input class="title-input" [(ngModel)]="form().titulo" placeholder="Nombre del plan..." />
        <div class="topbar-actions">
          <button class="btn-cancel-sm" (click)="closeForm()">Cancelar</button>
          <button class="btn-save" (click)="saveRoutine()" [disabled]="saving()">
            {{ saving() ? 'Guardando...' : (editing() ? 'Guardar cambios' : 'Crear rutina') }}
          </button>
        </div>
      </div>

      @for (circ of form().circuitos; track circ; let ci = $index) {
        <div class="bloque-edit">
          <!-- Nombre del bloque estilo título + controles de bloque -->
          <div class="bloque-edit-header">
            <input class="bloque-title-inp" [(ngModel)]="circ.nombre" placeholder="Nombre del bloque..." />
            <input class="circ-rondas-inp" [(ngModel)]="circ.rondas" placeholder="Rondas" />
            <button class="btn-blk-ctrl add" (click)="addCircuitAfter(ci)" title="Agregar bloque">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
            </button>
            <button class="btn-blk-ctrl del" [class.invisible]="form().circuitos.length === 1" (click)="removeCircuit(ci)" title="Eliminar bloque">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            </button>
          </div>

          <div class="ex-table">
            <div class="ex-head edit">
              <span>EJERCICIO</span><span>ENLACE</span><span>REP/SEG/MTS</span><span>CARGA</span><span></span>
            </div>
            @for (ex of circ.ejercicios; track ex; let ei = $index) {
              <div class="ex-row-edit">
                <input [(ngModel)]="ex.nombre" placeholder="Ejercicio *" />
                <input [(ngModel)]="ex.enlace" placeholder="https://..." />
                <input [(ngModel)]="ex.reps_seg_mts" placeholder="Ej: 3x10" />
                <input [(ngModel)]="ex.carga" placeholder="Ej: 70%" />
                <button class="btn-del-ex" [class.invisible]="circ.ejercicios.length === 1" (click)="removeExercise(ci, ei)" title="Eliminar fila">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                </button>
              </div>
            }
            <!-- Fila de agregar ejercicio -->
            <div class="ex-add-row" (click)="addExercise(ci)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
              <span>Agregar ejercicio</span>
            </div>
          </div>
        </div>
      }

      <div class="obs-edit">
        <label>Observaciones (opcional)</label>
        <textarea [(ngModel)]="form().observaciones" rows="2" placeholder="Notas adicionales..."></textarea>
      </div>

      @if (formError()) { <div class="error-banner">{{ formError() }}</div> }
    </ng-template>
  `,
  styles: [`
    .page { max-width: 960px; }
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; gap: 12px; }
    .header-left { display: flex; align-items: flex-start; gap: 14px; }
    .btn-back { display: inline-flex; align-items: center; gap: 6px; padding: 8px 12px; background: white; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 14px; color: #374151; text-decoration: none; white-space: nowrap; }
    h1 { font-size: 22px; font-weight: 700; color: #111827; margin: 0 0 4px; }
    .subtitle { color: #6b7280; font-size: 14px; margin: 0; }

    /* ── Cards ── */
    .routines-list { display: flex; flex-direction: column; gap: 16px; }
    .routine-card { background: white; border-radius: 16px; padding: 22px 24px; box-shadow: 0 1px 8px rgba(0,0,0,0.07); }
    .routine-card.is-editing { border: 2px solid #c7d2fe; }

    /* ── Top bar ── */
    .card-topbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 18px; flex-wrap: wrap; }
    .card-title { font-size: 16px; font-weight: 700; color: #111827; margin: 0; }
    .card-desc { font-size: 13px; color: #6b7280; margin: -8px 0 16px; }
    .title-input {
      flex: 1; min-width: 160px; font-size: 18px; font-weight: 700; color: #111827;
      border: none; border-bottom: 2px solid #e5e7eb; outline: none; padding: 4px 0;
      background: transparent; font-family: inherit;
    }
    .title-input:focus { border-bottom-color: #4f46e5; }
    .title-input::placeholder { color: #c4c9d4; font-weight: 400; font-size: 16px; }
    .topbar-actions { display: flex; gap: 8px; align-items: center; flex-shrink: 0; }
    .btn-icon { width: 34px; height: 34px; border-radius: 8px; border: 1.5px solid #e5e7eb; background: white; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #6b7280; transition: all 0.15s; }
    .btn-icon:hover { border-color: #4f46e5; color: #4f46e5; }
    .btn-icon.danger:hover { border-color: #ef4444; color: #ef4444; }

    /* ── Bloque labels ── */
    .bloque-label { font-size: 11px; font-weight: 800; color: #4f46e5; text-transform: uppercase; letter-spacing: 0.8px; white-space: nowrap; }
    .rondas-badge { background: #eef2ff; color: #4f46e5; border-radius: 20px; padding: 2px 10px; font-size: 11px; font-weight: 600; }

    /* ── Bloque read ── */
    .bloque-read { margin-bottom: 16px; }
    .bloque-read-header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }

    /* ── Bloque edit ── */
    .bloque-edit { margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid #f3f4f6; }
    .bloque-edit:last-of-type { border-bottom: none; margin-bottom: 8px; }
    .bloque-edit-header { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; flex-wrap: wrap; }
    .bloque-title-inp {
      flex: 1; min-width: 120px; font-size: 15px; font-weight: 700; color: #111827;
      border: none; border-bottom: 2px solid #e5e7eb; outline: none;
      padding: 4px 2px; background: transparent; font-family: inherit;
    }
    .bloque-title-inp:focus { border-bottom-color: #4f46e5; }
    .bloque-title-inp::placeholder { color: #c4c9d4; font-weight: 400; }
    .circ-rondas-inp { width: 80px; padding: 5px 8px; border: 1.5px solid #e5e7eb; border-radius: 8px; font-size: 13px; outline: none; font-family: inherit; }
    .circ-rondas-inp:focus { border-color: #4f46e5; }
    .btn-blk-ctrl { width: 30px; height: 30px; border-radius: 50%; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.15s; }
    .btn-blk-ctrl.add { background: #eef2ff; color: #4f46e5; }
    .btn-blk-ctrl.add:hover { background: #4f46e5; color: white; }
    .btn-blk-ctrl.del { background: #fef2f2; color: #ef4444; }
    .btn-blk-ctrl.del:hover { background: #ef4444; color: white; }
    .btn-blk-ctrl.invisible { visibility: hidden; }

    /* ── Exercise table ── */
    .ex-table { border: 1px solid #e9eaec; border-radius: 10px; overflow: hidden; margin-bottom: 2px; }
    .ex-head { display: grid; background: #f8f9fa; padding: 8px 12px; gap: 8px; }
    .ex-head.read  { grid-template-columns: 2fr 2fr 1.5fr 1.5fr; }
    .ex-head.edit  { grid-template-columns: 2fr 2fr 1.5fr 1.5fr 36px; }
    .ex-head span  { font-size: 10px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; }

    /* Read rows */
    .ex-row-read { display: grid; grid-template-columns: 2fr 2fr 1.5fr 1.5fr; padding: 9px 12px; gap: 8px; border-top: 1px solid #f0f0f0; background: white; align-items: center; }
    .ex-row-read span { font-size: 13px; color: #374151; }
    .link-ex { color: #4f46e5; font-size: 12px; font-weight: 600; text-decoration: none; }
    .link-ex:hover { text-decoration: underline; }

    /* Edit rows */
    .ex-row-edit { display: grid; grid-template-columns: 2fr 2fr 1.5fr 1.5fr 36px; padding: 6px 8px; gap: 6px; border-top: 1px solid #f0f0f0; background: white; align-items: center; }
    .ex-row-edit input { width: 100%; padding: 6px 8px; border: 1.5px solid #e5e7eb; border-radius: 6px; font-size: 13px; outline: none; box-sizing: border-box; font-family: inherit; }
    .ex-row-edit input:focus { border-color: #4f46e5; }
    /* Botón tacho por fila de ejercicio */
    .btn-del-ex { width: 28px; height: 28px; border-radius: 6px; border: none; background: transparent; color: #d1d5db; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.15s; padding: 0; }
    .btn-del-ex:hover { background: #fef2f2; color: #ef4444; }
    .btn-del-ex.invisible { visibility: hidden; }

    /* Fila de agregar ejercicio (dentro de la tabla) */
    .ex-add-row {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 12px; border-top: 1px solid #f0f0f0;
      cursor: pointer; color: #6b7280; font-size: 13px;
      background: #fafafa; transition: background 0.15s;
    }
    .ex-add-row:hover { background: #eef2ff; color: #4f46e5; }
    .ex-add-row:hover svg { stroke: #4f46e5; }

    /* Observaciones */
    .obs-edit { margin-top: 4px; }
    .obs-edit label { display: block; font-size: 12px; font-weight: 600; color: #6b7280; margin-bottom: 6px; }
    .obs-edit textarea { width: 100%; padding: 10px 12px; border: 1.5px solid #e5e7eb; border-radius: 8px; font-size: 14px; outline: none; font-family: inherit; resize: vertical; box-sizing: border-box; }
    .obs-edit textarea:focus { border-color: #4f46e5; }
    .obs-box { background: #fffbeb; border-radius: 10px; padding: 12px 16px; margin-top: 12px; }
    .obs-label { display: block; font-size: 11px; font-weight: 700; color: #92400e; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .obs-box p { font-size: 13px; color: #78350f; margin: 0; line-height: 1.6; }

    /* Buttons */
    .btn-new { display: flex; align-items: center; gap: 8px; padding: 10px 18px; background: #4f46e5; color: white; border: none; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; white-space: nowrap; }
    .btn-new:hover { background: #4338ca; }
    .btn-save { padding: 8px 18px; background: #4f46e5; color: white; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap; }
    .btn-save:hover:not(:disabled) { background: #4338ca; }
    .btn-save:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-cancel-sm { padding: 8px 14px; background: #f3f4f6; color: #374151; border: none; border-radius: 8px; font-size: 13px; cursor: pointer; white-space: nowrap; }
    .btn-cancel-sm:hover { background: #e5e7eb; }
    .btn-danger { padding: 10px 20px; background: #ef4444; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
    .error-banner { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 8px; padding: 10px 14px; font-size: 14px; margin-top: 12px; }

    /* Modal */
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 200; }
    .modal { background: white; border-radius: 16px; padding: 28px; max-width: 400px; width: 90%; }
    .modal h3 { font-size: 18px; font-weight: 700; color: #111827; margin: 0 0 10px; }
    .modal p { font-size: 14px; color: #6b7280; margin: 0 0 20px; }
    .modal-actions { display: flex; gap: 10px; justify-content: flex-end; }

    .loading-text { padding: 32px; text-align: center; color: #9ca3af; }
    .empty-state { text-align: center; padding: 56px; display: flex; flex-direction: column; align-items: center; gap: 12px; color: #9ca3af; }
    .empty-state p { font-size: 15px; margin: 0; }

    @media (max-width: 640px) {
      .ex-head.edit  { grid-template-columns: 1.5fr 36px; }
      .ex-head.edit span:not(:first-child):not(:last-child) { display: none; }
      .ex-row-edit   { grid-template-columns: 1.5fr 36px; }
      .ex-row-edit input:not(:first-child) { display: none; }
      .ex-head.read  { grid-template-columns: 1.5fr 1.5fr; }
      .ex-head.read span:nth-child(n+3) { display: none; }
      .ex-row-read   { grid-template-columns: 1.5fr 1.5fr; }
      .ex-row-read span:nth-child(n+3) { display: none; }
      .header-left { flex-direction: column; gap: 10px; }
    }
  `]
})
export class ManageRoutinesComponent implements OnInit {
  private api   = inject(ApiService);
  private route = inject(ActivatedRoute);

  patientId      = this.route.snapshot.params['patientId'];
  routines       = signal<any[]>([]);
  loading        = signal(true);
  showForm       = signal(false);
  saving         = signal(false);
  editing        = signal<string | null>(null);
  deletingRoutine = signal<any>(null);
  formError      = signal('');
  form           = signal<Routine>(EMPTY_ROU());

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.api.getRoutines(this.patientId).subscribe({
      next: (data) => { this.routines.set(data); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  openNew() {
    this.form.set(EMPTY_ROU());
    this.editing.set(null);
    this.formError.set('');
    this.showForm.set(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  openEdit(r: any) {
    this.form.set({
      titulo: r.titulo || '',
      descripcion: r.descripcion || '',
      circuitos: r.circuitos?.length
        ? r.circuitos.map((c: any) => ({
            nombre: c.nombre || '',
            rondas: c.rondas || '',
            ejercicios: c.ejercicios?.length
              ? c.ejercicios.map((e: any) => ({
                  nombre: e.nombre || '',
                  enlace: e.enlace || e.descripcion || '',
                  reps_seg_mts: e.reps_seg_mts || '',
                  carga: e.carga || ''
                }))
              : [EMPTY_EX()]
          }))
        : [EMPTY_CIR()],
      observaciones: r.observaciones || ''
    });
    this.editing.set(r.id);
    this.formError.set('');
    this.showForm.set(true);
  }

  closeForm() { this.showForm.set(false); this.editing.set(null); this.formError.set(''); }

  addCircuit()            { this.form.update(f => ({ ...f, circuitos: [...f.circuitos, EMPTY_CIR()] })); }
  addCircuitAfter(ci: number) {
    this.form.update(f => {
      const circuitos = [...f.circuitos];
      circuitos.splice(ci + 1, 0, EMPTY_CIR());
      return { ...f, circuitos };
    });
  }
  removeCircuit(i: number){ this.form.update(f => ({ ...f, circuitos: f.circuitos.filter((_, j) => j !== i) })); }

  addExercise(ci: number) {
    this.form.update(f => ({
      ...f,
      circuitos: f.circuitos.map((c, i) => i === ci ? { ...c, ejercicios: [...c.ejercicios, EMPTY_EX()] } : c)
    }));
  }

  removeExercise(ci: number, ei: number) {
    this.form.update(f => ({
      ...f,
      circuitos: f.circuitos.map((c, i) =>
        i === ci ? { ...c, ejercicios: c.ejercicios.filter((_: any, j: number) => j !== ei) } : c
      )
    }));
  }

  saveRoutine() {
    const f = this.form();
    if (!f.titulo.trim()) { this.formError.set('El título es obligatorio'); return; }
    for (const c of f.circuitos) {
      if (c.ejercicios.some(e => !e.nombre.trim())) {
        this.formError.set('Todos los ejercicios deben tener nombre'); return;
      }
    }
    this.saving.set(true);
    this.formError.set('');
    const editId = this.editing();
    const req$ = editId
      ? this.api.updateRoutine(editId, this.patientId, f)
      : this.api.createRoutine({ ...f, patient_id: this.patientId });
    req$.subscribe({
      next: () => { this.saving.set(false); this.closeForm(); this.load(); },
      error: (err) => { this.formError.set(err.error?.detail || 'Error al guardar'); this.saving.set(false); }
    });
  }

  confirmDelete(r: any) { this.deletingRoutine.set(r); }

  deleteRoutine() {
    const r = this.deletingRoutine();
    if (!r) return;
    this.api.deleteRoutine(r.id, this.patientId).subscribe({
      next: () => { this.deletingRoutine.set(null); this.load(); },
      error: () => this.deletingRoutine.set(null)
    });
  }
}

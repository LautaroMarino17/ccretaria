import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';

interface Exercise {
  nombre: string;
  enlace: string;
  reps_seg_mts: string;
  carga: string;
}

interface Circuit {
  nombre: string;
  rondas: string;
  ejercicios: Exercise[];
}

interface Routine {
  id?: string;
  titulo: string;
  descripcion: string;
  circuitos: Circuit[];
  observaciones: string;
}

const EMPTY_EXERCISE = (): Exercise => ({ nombre: '', enlace: '', reps_seg_mts: '', carga: '' });
const EMPTY_CIRCUIT = (): Circuit => ({ nombre: '', rondas: '', ejercicios: [EMPTY_EXERCISE()] });
const EMPTY_ROUTINE = (): Routine => ({ titulo: '', descripcion: '', circuitos: [EMPTY_CIRCUIT()], observaciones: '' });

@Component({
  selector: 'app-manage-routines',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="page">
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
        <button class="btn-primary" (click)="openForm()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nueva rutina
        </button>
      </div>

      @if (showForm()) {
        <div class="form-card">
          <h3>{{ editing() ? 'Editar rutina' : 'Nueva rutina' }}</h3>

          <div class="field">
            <label>Título *</label>
            <input [(ngModel)]="form().titulo" placeholder="Ej: Plan de rehabilitación semana 1" />
          </div>
          <div class="field">
            <label>Descripción general</label>
            <textarea [(ngModel)]="form().descripcion" rows="2" placeholder="Objetivo de la rutina..."></textarea>
          </div>

          <div class="circuits-section">
            @for (circ of form().circuitos; track circ; let ci = $index) {
              <div class="circuit-block">
                <div class="circuit-header">
                  <div class="circuit-num">Bloque {{ ci + 1 }}</div>
                  <div class="circuit-title-row">
                    <div class="field-inline">
                      <label>Nombre del bloque/circuito</label>
                      <input [(ngModel)]="circ.nombre" placeholder="Ej: Foam Roller, Bloque 1, MOV Integrados..." />
                    </div>
                    <div class="field-inline short">
                      <label>Rondas / Series</label>
                      <input [(ngModel)]="circ.rondas" placeholder="Ej: 3" />
                    </div>
                  </div>
                  @if (form().circuitos.length > 1) {
                    <button class="btn-remove-circuit" (click)="removeCircuit(ci)" title="Eliminar bloque">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  }
                </div>

                <!-- Tabla de ejercicios del circuito -->
                <div class="exercises-table">
                  <div class="table-head">
                    <span>Ejercicio</span>
                    <span>Enlace (video)</span>
                    <span>Rep / Seg / Mts</span>
                    <span>Carga %</span>
                    <span></span>
                  </div>
                  @for (ex of circ.ejercicios; track ex; let ei = $index) {
                    <div class="table-row">
                      <input [(ngModel)]="ex.nombre" placeholder="Nombre *" />
                      <input [(ngModel)]="ex.enlace" placeholder="https://..." />
                      <input [(ngModel)]="ex.reps_seg_mts" placeholder="Ej: 3x5&quot; / 30&quot;" />
                      <input [(ngModel)]="ex.carga" placeholder="Ej: 70% / 25KG" />
                      @if (circ.ejercicios.length > 1) {
                        <button class="btn-remove-row" (click)="removeExercise(ci, ei)" title="Eliminar ejercicio">×</button>
                      } @else {
                        <span></span>
                      }
                    </div>
                  }
                </div>
                <button class="btn-add-exercise" (click)="addExercise(ci)">+ Agregar ejercicio</button>
              </div>
            }
          </div>

          <button class="btn-add-circuit" (click)="addCircuit()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Agregar bloque/circuito
          </button>

          <div class="field" style="margin-top:16px">
            <label>Observaciones finales</label>
            <textarea [(ngModel)]="form().observaciones" rows="3" placeholder="Indicaciones adicionales, notas del profesional..."></textarea>
          </div>

          @if (formError()) { <div class="error-banner">{{ formError() }}</div> }

          <div class="form-actions">
            <button class="btn-secondary" (click)="closeForm()">Cancelar</button>
            <button class="btn-primary" (click)="saveRoutine()" [disabled]="saving()">
              {{ saving() ? 'Guardando...' : (editing() ? 'Guardar cambios' : 'Crear rutina') }}
            </button>
          </div>
        </div>
      }

      @if (loading()) {
        <div class="loading-text">Cargando rutinas...</div>
      } @else if (routines().length === 0 && !showForm()) {
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" stroke-width="1.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          <p>No hay rutinas asignadas</p>
          <button class="btn-primary" (click)="openForm()">Crear primera rutina</button>
        </div>
      } @else {
        <div class="routines-list">
          @for (r of routines(); track r.id) {
            <div class="routine-card">
              <div class="routine-header">
                <div>
                  <h3>{{ r.titulo }}</h3>
                  @if (r.descripcion) { <p class="routine-desc">{{ r.descripcion }}</p> }
                </div>
                <div class="routine-actions">
                  <button class="btn-icon" (click)="editRoutine(r)" title="Editar">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button class="btn-icon danger" (click)="confirmDelete(r)" title="Eliminar">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                  </button>
                </div>
              </div>

              @for (circ of r.circuitos; track $index) {
                <div class="circuit-preview">
                  <div class="circuit-preview-header">
                    <span class="circuit-label">{{ circ.nombre || 'Bloque ' + ($index + 1) }}</span>
                    @if (circ.rondas) { <span class="rondas-badge">{{ circ.rondas }} rondas</span> }
                  </div>
                  <div class="preview-table">
                    <div class="preview-head">
                      <span>Ejercicio</span><span>Enlace</span><span>Rep/Seg/Mts</span><span>Carga</span>
                    </div>
                    @for (ex of circ.ejercicios; track $index) {
                      <div class="preview-row">
                        <span>{{ ex.nombre }}</span>
                        <span class="text-muted">
                          @if (ex.enlace) {
                            <a [href]="ex.enlace" target="_blank" rel="noopener" class="link-video">Ver video</a>
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
        </div>
      }

      @if (deletingRoutine()) {
        <div class="modal-overlay" (click)="deletingRoutine.set(null)">
          <div class="modal" (click)="$event.stopPropagation()">
            <h3>¿Eliminar rutina?</h3>
            <p>Se eliminará <strong>{{ deletingRoutine()!.titulo }}</strong> permanentemente.</p>
            <div class="modal-actions">
              <button class="btn-secondary" (click)="deletingRoutine.set(null)">Cancelar</button>
              <button class="btn-danger" (click)="deleteRoutine()">Eliminar</button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .page { max-width: 960px; }
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; gap: 12px; }
    .header-left { display: flex; align-items: flex-start; gap: 14px; }
    .btn-back { display: inline-flex; align-items: center; gap: 6px; padding: 8px 12px; background: white; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 14px; color: #374151; text-decoration: none; white-space: nowrap; margin-top: 2px; }
    h1 { font-size: 22px; font-weight: 700; color: #111827; margin: 0 0 4px; }
    .subtitle { color: #6b7280; font-size: 14px; margin: 0; }

    .form-card { background: white; border-radius: 16px; padding: 28px; margin-bottom: 20px; box-shadow: 0 1px 6px rgba(0,0,0,0.07); }
    .form-card h3 { font-size: 17px; font-weight: 700; color: #111827; margin: 0 0 20px; }
    .field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
    label { font-size: 13px; font-weight: 500; color: #374151; }
    input, textarea { padding: 10px 12px; border: 1.5px solid #e5e7eb; border-radius: 8px; font-size: 14px; outline: none; font-family: inherit; resize: vertical; width: 100%; box-sizing: border-box; }
    input:focus, textarea:focus { border-color: #4f46e5; }

    .circuits-section { display: flex; flex-direction: column; gap: 16px; margin-bottom: 12px; }
    .circuit-block { border: 1.5px solid #e5e7eb; border-radius: 14px; padding: 18px; background: #fafafa; }
    .circuit-header { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 14px; flex-wrap: wrap; }
    .circuit-num { background: #4f46e5; color: white; border-radius: 8px; padding: 4px 12px; font-size: 12px; font-weight: 700; white-space: nowrap; flex-shrink: 0; margin-top: 20px; }
    .circuit-title-row { flex: 1; display: flex; gap: 10px; flex-wrap: wrap; }
    .field-inline { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 160px; }
    .field-inline.short { max-width: 140px; flex: 0 0 140px; }
    .field-inline label { font-size: 12px; font-weight: 500; color: #6b7280; }
    .btn-remove-circuit { background: none; border: none; cursor: pointer; color: #ef4444; padding: 4px; margin-top: 18px; flex-shrink: 0; }

    .exercises-table { border-radius: 10px; overflow: hidden; border: 1px solid #e5e7eb; margin-bottom: 10px; }
    .table-head { display: grid; grid-template-columns: 2fr 2fr 1.5fr 1.5fr 32px; background: #f3f4f6; padding: 8px 10px; gap: 8px; }
    .table-head span { font-size: 11px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.4px; }
    .table-row { display: grid; grid-template-columns: 2fr 2fr 1.5fr 1.5fr 32px; padding: 6px 10px; gap: 8px; border-top: 1px solid #e5e7eb; align-items: center; background: white; }
    .table-row input { padding: 6px 8px; font-size: 13px; }
    .btn-remove-row { background: none; border: none; cursor: pointer; color: #ef4444; font-size: 18px; padding: 0; display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; }
    .btn-add-exercise { background: #eef2ff; color: #4f46e5; border: none; border-radius: 8px; padding: 6px 14px; font-size: 12px; font-weight: 600; cursor: pointer; margin-top: 4px; }

    .btn-add-circuit { display: flex; align-items: center; gap: 8px; background: white; border: 1.5px dashed #c7d2fe; color: #4f46e5; border-radius: 10px; padding: 10px 18px; font-size: 14px; font-weight: 600; cursor: pointer; width: 100%; justify-content: center; margin-top: 4px; }
    .btn-add-circuit:hover { background: #eef2ff; }

    .routines-list { display: flex; flex-direction: column; gap: 16px; }
    .routine-card { background: white; border-radius: 16px; padding: 22px; box-shadow: 0 1px 6px rgba(0,0,0,0.06); }
    .routine-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; }
    .routine-card h3 { font-size: 16px; font-weight: 700; color: #111827; margin: 0 0 4px; }
    .routine-desc { font-size: 13px; color: #6b7280; margin: 0; }
    .routine-actions { display: flex; gap: 8px; }
    .btn-icon { width: 34px; height: 34px; border-radius: 8px; border: 1.5px solid #e5e7eb; background: white; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #6b7280; transition: all 0.15s; }
    .btn-icon:hover { border-color: #4f46e5; color: #4f46e5; }
    .btn-icon.danger:hover { border-color: #ef4444; color: #ef4444; }

    .circuit-preview { margin-bottom: 14px; }
    .circuit-preview-header { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
    .circuit-label { font-size: 13px; font-weight: 700; color: #374151; }
    .rondas-badge { background: #eef2ff; color: #4f46e5; border-radius: 20px; padding: 2px 10px; font-size: 11px; font-weight: 600; }
    .preview-table { border-radius: 8px; overflow: hidden; border: 1px solid #e5e7eb; }
    .preview-head { display: grid; grid-template-columns: 2fr 2fr 1.5fr 1.5fr; padding: 6px 12px; background: #f9fafb; gap: 8px; }
    .preview-head span { font-size: 10px; font-weight: 700; color: #9ca3af; text-transform: uppercase; }
    .preview-row { display: grid; grid-template-columns: 2fr 2fr 1.5fr 1.5fr; padding: 8px 12px; border-top: 1px solid #f3f4f6; gap: 8px; }
    .preview-row span { font-size: 13px; color: #374151; }
    .text-muted { color: #9ca3af !important; }
    .link-video { color: #4f46e5; font-size: 12px; font-weight: 600; text-decoration: none; }
    .link-video:hover { text-decoration: underline; }

    .obs-box { background: #fffbeb; border-radius: 10px; padding: 12px 16px; margin-top: 12px; }
    .obs-label { display: block; font-size: 11px; font-weight: 700; color: #92400e; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .obs-box p { font-size: 13px; color: #78350f; margin: 0; line-height: 1.6; }

    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 200; }
    .modal { background: white; border-radius: 16px; padding: 28px; max-width: 400px; width: 90%; }
    .modal h3 { font-size: 18px; font-weight: 700; color: #111827; margin: 0 0 10px; }
    .modal p { font-size: 14px; color: #6b7280; margin: 0 0 20px; }
    .modal-actions { display: flex; gap: 10px; justify-content: flex-end; }
    .btn-danger { padding: 10px 20px; background: #ef4444; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }

    .btn-primary { display: flex; align-items: center; gap: 8px; padding: 10px 18px; background: #4f46e5; color: white; border: none; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-secondary { padding: 10px 18px; background: #f3f4f6; color: #374151; border: none; border-radius: 10px; font-size: 14px; cursor: pointer; }
    .error-banner { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 8px; padding: 10px 14px; font-size: 14px; margin-bottom: 14px; }
    .form-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 8px; }
    .loading-text { padding: 32px; text-align: center; color: #9ca3af; }
    .empty-state { text-align: center; padding: 56px; display: flex; flex-direction: column; align-items: center; gap: 12px; color: #9ca3af; }
    .empty-state p { font-size: 15px; margin: 0; }

    @media (max-width: 640px) {
      .table-head, .table-row { grid-template-columns: 1fr 1fr; }
      .table-head span:nth-child(n+3), .table-row input:nth-child(n+3) { display: none; }
      .preview-head, .preview-row { grid-template-columns: 1fr 1fr; }
      .header-left { flex-direction: column; gap: 10px; }
    }
  `]
})
export class ManageRoutinesComponent implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);

  patientId = this.route.snapshot.params['patientId'];
  routines = signal<any[]>([]);
  loading = signal(true);
  showForm = signal(false);
  saving = signal(false);
  editing = signal<string | null>(null);
  deletingRoutine = signal<any>(null);
  formError = signal('');
  form = signal<Routine>(EMPTY_ROUTINE());

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.api.getRoutines(this.patientId).subscribe({
      next: (data) => { this.routines.set(data); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  openForm() {
    this.form.set(EMPTY_ROUTINE());
    this.editing.set(null);
    this.formError.set('');
    this.showForm.set(true);
  }

  editRoutine(r: any) {
    this.form.set({
      titulo: r.titulo || '',
      descripcion: r.descripcion || '',
      circuitos: r.circuitos?.length ? r.circuitos.map((c: any) => ({
        nombre: c.nombre || '',
        rondas: c.rondas || '',
        ejercicios: c.ejercicios?.length ? c.ejercicios.map((e: any) => ({
          nombre: e.nombre || '',
          enlace: e.enlace || e.descripcion || '',
          reps_seg_mts: e.reps_seg_mts || '',
          carga: e.carga || ''
        })) : [EMPTY_EXERCISE()]
      })) : [EMPTY_CIRCUIT()],
      observaciones: r.observaciones || ''
    });
    this.editing.set(r.id);
    this.formError.set('');
    this.showForm.set(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  closeForm() { this.showForm.set(false); this.editing.set(null); this.formError.set(''); }

  addCircuit() {
    this.form.update(f => ({ ...f, circuitos: [...f.circuitos, EMPTY_CIRCUIT()] }));
  }

  removeCircuit(index: number) {
    this.form.update(f => ({ ...f, circuitos: f.circuitos.filter((_, i) => i !== index) }));
  }

  addExercise(circuitIndex: number) {
    this.form.update(f => {
      const circuitos = f.circuitos.map((c, i) =>
        i === circuitIndex ? { ...c, ejercicios: [...c.ejercicios, EMPTY_EXERCISE()] } : c
      );
      return { ...f, circuitos };
    });
  }

  removeExercise(circuitIndex: number, exIndex: number) {
    this.form.update(f => {
      const circuitos = f.circuitos.map((c, i) =>
        i === circuitIndex ? { ...c, ejercicios: c.ejercicios.filter((_: any, j: number) => j !== exIndex) } : c
      );
      return { ...f, circuitos };
    });
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
    const obs$ = editId
      ? this.api.updateRoutine(editId, this.patientId, f)
      : this.api.createRoutine({ ...f, patient_id: this.patientId });
    obs$.subscribe({
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

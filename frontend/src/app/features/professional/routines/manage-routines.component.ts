import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';

interface Exercise {
  nombre: string;
  descripcion: string;
  series: string;
  repeticiones: string;
  duracion: string;
  frecuencia: string;
}

interface Routine {
  id?: string;
  titulo: string;
  descripcion: string;
  ejercicios: Exercise[];
  observaciones: string;
}

const EMPTY_EXERCISE = (): Exercise => ({
  nombre: '', descripcion: '', series: '', repeticiones: '', duracion: '', frecuencia: ''
});

const EMPTY_ROUTINE = (): Routine => ({
  titulo: '', descripcion: '', ejercicios: [EMPTY_EXERCISE()], observaciones: ''
});

@Component({
  selector: 'app-manage-routines',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="page">
      <div class="page-header">
        <div class="header-left">
          <a [routerLink]="['/professional/patients', patientId]" class="btn-back">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Volver
          </a>
          <div>
            <h1>Rutinas de ejercicios</h1>
            <p class="subtitle">Gestioná los planes asignados al paciente</p>
          </div>
        </div>
        <button class="btn-primary" (click)="openForm()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Nueva rutina
        </button>
      </div>

      <!-- Formulario crear / editar -->
      @if (showForm()) {
        <div class="form-card">
          <h3>{{ editing() ? 'Editar rutina' : 'Nueva rutina' }}</h3>

          <div class="field">
            <label>Título *</label>
            <input [(ngModel)]="form().titulo" placeholder="Ej: Rutina de fortalecimiento de rodilla" />
          </div>
          <div class="field">
            <label>Descripción general</label>
            <textarea [(ngModel)]="form().descripcion" rows="2"
              placeholder="Breve descripción del objetivo de la rutina..."></textarea>
          </div>

          <div class="exercises-section">
            <div class="exercises-header">
              <h4>Ejercicios</h4>
              <button class="btn-add-exercise" (click)="addExercise()">+ Agregar ejercicio</button>
            </div>

            @for (ex of form().ejercicios; track $index) {
              <div class="exercise-card">
                <div class="exercise-num">{{ $index + 1 }}</div>
                <div class="exercise-fields">
                  <div class="field">
                    <label>Nombre *</label>
                    <input [(ngModel)]="ex.nombre" placeholder="Ej: Sentadilla" />
                  </div>
                  <div class="field">
                    <label>Descripción</label>
                    <input [(ngModel)]="ex.descripcion" placeholder="Cómo realizarlo..." />
                  </div>
                  <div class="fields-row">
                    <div class="field">
                      <label>Series</label>
                      <input [(ngModel)]="ex.series" placeholder="3" />
                    </div>
                    <div class="field">
                      <label>Repeticiones</label>
                      <input [(ngModel)]="ex.repeticiones" placeholder="12" />
                    </div>
                    <div class="field">
                      <label>Duración</label>
                      <input [(ngModel)]="ex.duracion" placeholder="30 seg" />
                    </div>
                    <div class="field">
                      <label>Frecuencia</label>
                      <input [(ngModel)]="ex.frecuencia" placeholder="3 veces/semana" />
                    </div>
                  </div>
                </div>
                @if (form().ejercicios.length > 1) {
                  <button class="btn-remove" (click)="removeExercise($index)">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                }
              </div>
            }
          </div>

          <div class="field">
            <label>Observaciones</label>
            <textarea [(ngModel)]="form().observaciones" rows="2"
              placeholder="Indicaciones adicionales..."></textarea>
          </div>

          @if (formError()) {
            <div class="error-banner">{{ formError() }}</div>
          }

          <div class="form-actions">
            <button class="btn-secondary" (click)="closeForm()">Cancelar</button>
            <button class="btn-primary" (click)="saveRoutine()" [disabled]="saving()">
              {{ saving() ? 'Guardando...' : (editing() ? 'Guardar cambios' : 'Crear rutina') }}
            </button>
          </div>
        </div>
      }

      <!-- Lista de rutinas -->
      @if (loading()) {
        <div class="loading-text">Cargando rutinas...</div>
      } @else if (routines().length === 0 && !showForm()) {
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" stroke-width="1.5">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
          </svg>
          <p>No hay rutinas asignadas a este paciente</p>
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
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                  <button class="btn-icon danger" (click)="confirmDelete(r)" title="Eliminar">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                      <path d="M10 11v6"/><path d="M14 11v6"/>
                      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                    </svg>
                  </button>
                </div>
              </div>

              <div class="exercises-count">
                {{ r.ejercicios?.length || 0 }} ejercicio(s)
              </div>

              <!-- Preview de ejercicios -->
              @if (r.ejercicios?.length > 0) {
                <div class="exercises-preview">
                  @for (ex of r.ejercicios; track $index) {
                    <div class="exercise-pill">
                      <span class="ex-name">{{ ex.nombre }}</span>
                      <span class="ex-meta">
                        @if (ex.series && ex.repeticiones) { {{ ex.series }}x{{ ex.repeticiones }} }
                        @else if (ex.duracion) { {{ ex.duracion }} }
                      </span>
                    </div>
                  }
                </div>
              }

              @if (r.observaciones) {
                <p class="routine-obs">{{ r.observaciones }}</p>
              }
            </div>
          }
        </div>
      }

      <!-- Confirm delete modal -->
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
    .page { max-width: 860px; }
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; gap: 12px; }
    .header-left { display: flex; align-items: flex-start; gap: 14px; }
    .btn-back {
      display: inline-flex; align-items: center; gap: 6px; padding: 8px 12px;
      background: white; border: 1px solid #e5e7eb; border-radius: 8px;
      font-size: 14px; color: #374151; text-decoration: none; white-space: nowrap; margin-top: 2px;
    }
    h1 { font-size: 22px; font-weight: 700; color: #111827; margin: 0 0 4px; }
    .subtitle { color: #6b7280; font-size: 14px; margin: 0; }

    /* Form */
    .form-card { background: white; border-radius: 16px; padding: 28px; margin-bottom: 20px; box-shadow: 0 1px 6px rgba(0,0,0,0.07); }
    .form-card h3 { font-size: 17px; font-weight: 700; color: #111827; margin: 0 0 20px; }
    .field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
    label { font-size: 13px; font-weight: 500; color: #374151; }
    input, textarea, select {
      padding: 10px 12px; border: 1.5px solid #e5e7eb; border-radius: 8px;
      font-size: 14px; outline: none; font-family: inherit; resize: vertical;
    }
    input:focus, textarea:focus { border-color: #4f46e5; }

    /* Exercises */
    .exercises-section { margin: 4px 0 14px; }
    .exercises-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
    .exercises-header h4 { font-size: 14px; font-weight: 700; color: #374151; margin: 0; }
    .btn-add-exercise { background: #eef2ff; color: #4f46e5; border: none; border-radius: 8px; padding: 6px 14px; font-size: 13px; font-weight: 600; cursor: pointer; }
    .exercise-card {
      display: flex; gap: 12px; background: #f9fafb; border-radius: 12px;
      padding: 14px; margin-bottom: 10px; position: relative;
    }
    .exercise-num {
      width: 28px; height: 28px; background: #4f46e5; color: white;
      border-radius: 50%; display: flex; align-items: center; justify-content: center;
      font-size: 13px; font-weight: 700; flex-shrink: 0; margin-top: 2px;
    }
    .exercise-fields { flex: 1; }
    .fields-row { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 10px; }
    .btn-remove {
      position: absolute; top: 10px; right: 10px;
      background: none; border: none; cursor: pointer; color: #ef4444; padding: 4px;
    }

    /* Routine list */
    .routines-list { display: flex; flex-direction: column; gap: 14px; }
    .routine-card { background: white; border-radius: 16px; padding: 22px; box-shadow: 0 1px 6px rgba(0,0,0,0.06); }
    .routine-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 10px; }
    .routine-card h3 { font-size: 16px; font-weight: 700; color: #111827; margin: 0 0 4px; }
    .routine-desc { font-size: 13px; color: #6b7280; margin: 0; }
    .routine-actions { display: flex; gap: 8px; }
    .btn-icon {
      width: 34px; height: 34px; border-radius: 8px; border: 1.5px solid #e5e7eb;
      background: white; cursor: pointer; display: flex; align-items: center; justify-content: center;
      color: #6b7280; transition: all 0.15s;
    }
    .btn-icon:hover { border-color: #4f46e5; color: #4f46e5; }
    .btn-icon.danger:hover { border-color: #ef4444; color: #ef4444; }
    .exercises-count { font-size: 12px; color: #9ca3af; margin-bottom: 10px; }
    .exercises-preview { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; }
    .exercise-pill {
      display: flex; align-items: center; gap: 8px; background: #f3f4f6;
      border-radius: 8px; padding: 6px 12px;
    }
    .ex-name { font-size: 13px; font-weight: 500; color: #374151; }
    .ex-meta { font-size: 12px; color: #9ca3af; }
    .routine-obs { font-size: 13px; color: #9ca3af; margin: 8px 0 0; font-style: italic; }

    /* Modal */
    .modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.4);
      display: flex; align-items: center; justify-content: center; z-index: 200;
    }
    .modal { background: white; border-radius: 16px; padding: 28px; max-width: 400px; width: 90%; }
    .modal h3 { font-size: 18px; font-weight: 700; color: #111827; margin: 0 0 10px; }
    .modal p { font-size: 14px; color: #6b7280; margin: 0 0 20px; }
    .modal-actions { display: flex; gap: 10px; justify-content: flex-end; }
    .btn-danger { padding: 10px 20px; background: #ef4444; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }

    /* Shared */
    .btn-primary {
      display: flex; align-items: center; gap: 8px; padding: 10px 18px;
      background: #4f46e5; color: white; border: none; border-radius: 10px;
      font-size: 14px; font-weight: 600; cursor: pointer;
    }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-secondary { padding: 10px 18px; background: #f3f4f6; color: #374151; border: none; border-radius: 10px; font-size: 14px; cursor: pointer; }
    .error-banner { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 8px; padding: 10px 14px; font-size: 14px; margin-bottom: 14px; }
    .form-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 8px; }
    .loading-text { padding: 32px; text-align: center; color: #9ca3af; }
    .empty-state { text-align: center; padding: 56px; display: flex; flex-direction: column; align-items: center; gap: 12px; color: #9ca3af; }
    .empty-state p { font-size: 15px; margin: 0; }

    @media (max-width: 640px) {
      .fields-row { grid-template-columns: 1fr 1fr; }
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
      ejercicios: r.ejercicios?.length ? r.ejercicios : [EMPTY_EXERCISE()],
      observaciones: r.observaciones || ''
    });
    this.editing.set(r.id);
    this.formError.set('');
    this.showForm.set(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  closeForm() {
    this.showForm.set(false);
    this.editing.set(null);
    this.formError.set('');
  }

  addExercise() {
    this.form.update(f => ({ ...f, ejercicios: [...f.ejercicios, EMPTY_EXERCISE()] }));
  }

  removeExercise(index: number) {
    this.form.update(f => ({ ...f, ejercicios: f.ejercicios.filter((_, i) => i !== index) }));
  }

  saveRoutine() {
    const f = this.form();
    if (!f.titulo.trim()) { this.formError.set('El título es obligatorio'); return; }
    if (f.ejercicios.some(e => !e.nombre.trim())) { this.formError.set('Todos los ejercicios deben tener nombre'); return; }

    this.saving.set(true);
    this.formError.set('');

    const editId = this.editing();
    const obs$ = editId
      ? this.api.updateRoutine(editId, this.patientId, f)
      : this.api.createRoutine({ ...f, patient_id: this.patientId });

    obs$.subscribe({
      next: () => { this.saving.set(false); this.closeForm(); this.load(); },
      error: (err) => {
        this.formError.set(err.error?.detail || 'Error al guardar la rutina');
        this.saving.set(false);
      }
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

import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';

interface Medida {
  nombre: string;
  valor: string;
  unidad: string;
}

interface EvalForm {
  nombre: string;
  fecha: string;
  observaciones: string;
  medidas: Medida[];
  imagenes: string[];
}

const EMPTY_MEDIDA = (): Medida => ({ nombre: '', valor: '', unidad: '' });
const EMPTY_FORM = (): EvalForm => ({
  nombre: '',
  fecha: new Date().toISOString().split('T')[0],
  observaciones: '',
  medidas: [EMPTY_MEDIDA()],
  imagenes: []
});

@Component({
  selector: 'app-professional-evaluations',
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
            <h1>Evaluaciones</h1>
            <p class="subtitle">Testeos y mediciones del paciente</p>
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
          <div class="fields-row-2">
            <div class="field">
              <label>Nombre de la evaluación *</label>
              <input [(ngModel)]="form().nombre" placeholder="Ej: Test de Barthel, 6 min walk..." />
            </div>
            <div class="field">
              <label>Fecha *</label>
              <input type="date" [(ngModel)]="form().fecha" />
            </div>
          </div>

          <div class="measures-section">
            <div class="measures-header">
              <h4>Medidas / Valores</h4>
              <button class="btn-add-circle" (click)="addMedida()" title="Agregar medida">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
            </div>
            @for (m of form().medidas; track $index) {
              <div class="measure-row">
                <input [(ngModel)]="m.nombre" placeholder="Nombre (ej: Velocidad)" class="measure-input" />
                <input [(ngModel)]="m.valor" placeholder="Valor (ej: 1.2)" class="measure-input short" />
                <input [(ngModel)]="m.unidad" placeholder="Unidad (ej: m/s)" class="measure-input short" />
                @if (form().medidas.length > 1) {
                  <button class="btn-remove-m" (click)="removeMedida($index)" title="Eliminar medida">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                  </button>
                }
              </div>
            }
          </div>

          <div class="field">
            <label>Observaciones</label>
            <textarea [(ngModel)]="form().observaciones" rows="3" placeholder="Notas adicionales sobre la evaluación..."></textarea>
          </div>

          <div class="field">
            <label>Imágenes (URLs, una por línea)</label>
            <textarea [(ngModel)]="imagenesText" rows="2" placeholder="https://imagen1.com&#10;https://imagen2.com"></textarea>
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
                  <span class="eval-date">{{ formatDate(ev.fecha) }}</span>
                  @if (ev.professional_name) { <span class="prof-badge">{{ ev.professional_name }}</span> }
                </div>
                <div class="eval-actions">
                  <button class="btn-icon" (click)="editEval(ev)" title="Editar">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button class="btn-icon danger" (click)="deleteEval(ev.id)" title="Eliminar">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                  </button>
                </div>
              </div>

              @if (ev.medidas?.length > 0) {
                <div class="measures-table">
                  <div class="measure-head">
                    <span>Medida</span><span>Valor</span><span>Unidad</span>
                  </div>
                  @for (m of ev.medidas; track $index) {
                    <div class="measure-row-view">
                      <span class="m-name">{{ m.nombre }}</span>
                      <span class="m-val">{{ m.valor }}</span>
                      <span class="m-unit">{{ m.unidad }}</span>
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
                    <img [src]="img" class="eval-img" alt="Imagen evaluación" />
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
    .page { max-width: 860px; }
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; gap: 12px; flex-wrap: wrap; }
    .header-left { display: flex; align-items: flex-start; gap: 14px; }
    .btn-back { display: inline-flex; align-items: center; gap: 6px; padding: 8px 12px; background: white; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 14px; color: #374151; text-decoration: none; white-space: nowrap; margin-top: 2px; }
    h1 { font-size: 22px; font-weight: 700; color: #111827; margin: 0 0 4px; }
    .subtitle { color: #6b7280; font-size: 14px; margin: 0; }

    .form-card { background: white; border-radius: 16px; padding: 28px; margin-bottom: 20px; box-shadow: 0 1px 6px rgba(0,0,0,0.07); }
    .form-card h3 { font-size: 17px; font-weight: 700; color: #111827; margin: 0 0 20px; }
    .fields-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; }
    .field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
    label { font-size: 13px; font-weight: 500; color: #374151; }
    input, textarea, select { padding: 10px 12px; border: 1.5px solid #e5e7eb; border-radius: 8px; font-size: 14px; outline: none; font-family: inherit; resize: vertical; }
    input:focus, textarea:focus { border-color: #16a34a; }

    .measures-section { margin-bottom: 14px; }
    .measures-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
    .measures-header h4 { font-size: 14px; font-weight: 700; color: #374151; margin: 0; }
    .btn-add { background: #f0fdf4; color: #16a34a; border: none; border-radius: 8px; padding: 6px 14px; font-size: 13px; font-weight: 600; cursor: pointer; }
    .btn-add-circle { width: 32px; height: 32px; border-radius: 50%; background: #f0fdf4; color: #16a34a; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.15s; }
    .btn-add-circle:hover { background: #16a34a; color: white; }
    .measure-row { display: grid; grid-template-columns: 1fr 120px 100px auto; gap: 8px; align-items: center; margin-bottom: 8px; }
    .measure-input { margin: 0; }
    .btn-remove-m { background: transparent; border: none; cursor: pointer; color: #d1d5db; padding: 4px; display: flex; align-items: center; justify-content: center; border-radius: 6px; transition: all 0.15s; }
    .btn-remove-m:hover { background: #fef2f2; color: #ef4444; }

    .evals-list { display: flex; flex-direction: column; gap: 16px; }
    .eval-card { background: white; border-radius: 16px; padding: 22px; box-shadow: 0 1px 6px rgba(0,0,0,0.06); }
    .eval-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 14px; gap: 10px; }
    .eval-card h3 { font-size: 16px; font-weight: 700; color: #111827; margin: 0 0 4px; }
    .eval-date { font-size: 12px; color: #9ca3af; margin-right: 8px; }
    .prof-badge { padding: 2px 8px; background: #f0fdf4; color: #16a34a; border-radius: 20px; font-size: 11px; font-weight: 600; }
    .eval-actions { display: flex; gap: 8px; flex-shrink: 0; }
    .btn-icon { width: 32px; height: 32px; border-radius: 8px; border: 1.5px solid #e5e7eb; background: white; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #6b7280; transition: all 0.15s; }
    .btn-icon:hover { border-color: #16a34a; color: #16a34a; }
    .btn-icon.danger:hover { border-color: #ef4444; color: #ef4444; }

    .measures-table { background: #f9fafb; border-radius: 10px; overflow: hidden; margin-bottom: 12px; }
    .measure-head { display: grid; grid-template-columns: 1fr 120px 100px; padding: 8px 12px; background: #f3f4f6; font-size: 11px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; }
    .measure-row-view { display: grid; grid-template-columns: 1fr 120px 100px; padding: 8px 12px; border-top: 1px solid #e5e7eb; }
    .m-name { font-size: 14px; color: #374151; font-weight: 500; }
    .m-val { font-size: 14px; color: #16a34a; font-weight: 700; }
    .m-unit { font-size: 13px; color: #9ca3af; }

    .obs-box { background: #fffbeb; border-radius: 10px; padding: 12px 14px; margin-top: 10px; }
    .obs-label { display: block; font-size: 11px; font-weight: 600; color: #92400e; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .obs-box p { font-size: 14px; color: #78350f; margin: 0; line-height: 1.5; }

    .images-row { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; }
    .eval-img { height: 120px; width: auto; border-radius: 8px; border: 1px solid #e5e7eb; object-fit: cover; }

    .btn-primary { display: flex; align-items: center; gap: 8px; padding: 10px 18px; background: #16a34a; color: white; border: none; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-secondary { padding: 10px 18px; background: #f3f4f6; color: #374151; border: none; border-radius: 10px; font-size: 14px; cursor: pointer; }
    .form-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 8px; }
    .error-banner { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 8px; padding: 10px 14px; font-size: 14px; }
    .loading-text { padding: 32px; text-align: center; color: #9ca3af; }
    .empty-state { text-align: center; padding: 56px; display: flex; flex-direction: column; align-items: center; gap: 12px; color: #9ca3af; }
    .empty-state p { font-size: 15px; margin: 0; }

    @media (max-width: 640px) {
      .fields-row-2 { grid-template-columns: 1fr; }
      .measure-row { grid-template-columns: 1fr 90px 80px auto; }
      .header-left { flex-direction: column; gap: 10px; }
    }
    @media (max-width: 480px) {
      .measure-row { grid-template-columns: 1fr; }
      .btn-remove-m { margin-left: auto; }
    }
  `]
})
export class ProfessionalEvaluationsComponent implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);

  patientId = this.route.snapshot.params['patientId'];
  evals = signal<any[]>([]);
  loading = signal(true);
  showForm = signal(false);
  saving = signal(false);
  editingId = signal<string | null>(null);
  formError = signal('');
  form = signal<EvalForm>(EMPTY_FORM());
  imagenesText = '';

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.api.getEvaluations(this.patientId).subscribe({
      next: (data) => { this.evals.set(data); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  openForm() {
    this.form.set(EMPTY_FORM());
    this.imagenesText = '';
    this.editingId.set(null);
    this.formError.set('');
    this.showForm.set(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  closeForm() {
    this.showForm.set(false);
    this.editingId.set(null);
    this.formError.set('');
  }

  editEval(ev: any) {
    this.editingId.set(ev.id);
    this.form.set({
      nombre: ev.nombre || '',
      fecha: ev.fecha || new Date().toISOString().split('T')[0],
      observaciones: ev.observaciones || '',
      medidas: ev.medidas?.length ? ev.medidas.map((m: any) => ({ ...m })) : [EMPTY_MEDIDA()],
      imagenes: ev.imagenes || []
    });
    this.imagenesText = (ev.imagenes || []).join('\n');
    this.formError.set('');
    this.showForm.set(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  addMedida() {
    this.form.update(f => ({ ...f, medidas: [...f.medidas, EMPTY_MEDIDA()] }));
  }

  removeMedida(index: number) {
    this.form.update(f => ({ ...f, medidas: f.medidas.filter((_, i) => i !== index) }));
  }

  saveEval() {
    const f = this.form();
    if (!f.nombre.trim()) { this.formError.set('El nombre es obligatorio'); return; }
    if (!f.fecha) { this.formError.set('La fecha es obligatoria'); return; }

    this.saving.set(true);
    this.formError.set('');

    const imagenes = this.imagenesText.split('\n').map(s => s.trim()).filter(Boolean);
    const payload = { ...f, imagenes, patient_id: this.patientId };

    const id = this.editingId();
    const obs$ = id
      ? this.api.updateEvaluation(id, this.patientId, { ...f, imagenes })
      : this.api.createEvaluation(payload);

    obs$.subscribe({
      next: () => { this.saving.set(false); this.closeForm(); this.load(); },
      error: (err) => {
        this.formError.set(err.error?.detail || 'Error al guardar');
        this.saving.set(false);
      }
    });
  }

  deleteEval(id: string) {
    if (!confirm('¿Eliminar esta evaluación?')) return;
    this.api.deleteEvaluation(id, this.patientId).subscribe({
      next: () => this.evals.update(ev => ev.filter(e => e.id !== id))
    });
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    try {
      return new Date(dateStr + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });
    } catch { return dateStr; }
  }
}

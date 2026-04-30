import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-professional-histories',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="page">
      <div class="page-header">
        <div><h1>Historias clínicas</h1><p class="subtitle">Todas las consultas de tus pacientes</p></div>
      </div>

      <div class="search-bar">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input [(ngModel)]="search" placeholder="Buscar por paciente, motivo o diagnóstico..." />
      </div>

      @if (loading()) {
        <div class="loading-text">Cargando...</div>
      } @else if (filtered().length === 0) {
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          <p>{{ search ? 'Sin resultados' : 'No hay historias clínicas registradas' }}</p>
        </div>
      } @else {
        <div class="history-list">
          @for (h of filtered(); track h.id) {
            <div class="history-card" [class.expanded]="expanded() === h.id">
              <div class="history-summary" (click)="toggle(h.id)">
                <div class="history-left">
                  <span class="history-date">{{ formatDate(h.fecha) }}</span>
                  <a class="patient-link" [routerLink]="['/professional/patients', h.patient_id]" (click)="$event.stopPropagation()">{{ h.patient_name }}</a>
                  <h3>{{ h.motivo_consulta || 'Consulta sin título' }}</h3>
                  @if (h.diagnostico) { <p class="history-dx">Dx: {{ h.diagnostico }}</p> }
                </div>
                <div class="history-actions" (click)="$event.stopPropagation()">
                  <button class="btn-icon-sm" (click)="downloadHistory(h)" title="Descargar">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  </button>
                  <button class="btn-icon-sm" (click)="printHistory(h)" title="Imprimir">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                  </button>
                  <button class="btn-icon-sm" (click)="openEdit(h)" title="Editar">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <svg class="chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                </div>
              </div>

              @if (expanded() === h.id) {
                <div class="history-detail">
                  <!-- Datos personales del paciente -->
                  <div class="patient-data-card">
                    <div class="patient-data-row">
                      <span class="pd-label">Paciente</span>
                      <span class="pd-val">{{ h.patient_name }}</span>
                    </div>
                    @if (h.patient_info?.dni) {
                      <div class="patient-data-row">
                        <span class="pd-label">DNI</span>
                        <span class="pd-val">{{ h.patient_info.dni }}</span>
                      </div>
                    }
                    @if (h.patient_info?.fecha_nacimiento) {
                      <div class="patient-data-row">
                        <span class="pd-label">Fecha de nac.</span>
                        <span class="pd-val">{{ h.patient_info.fecha_nacimiento }}</span>
                      </div>
                    }
                    @if (h.patient_info?.sexo) {
                      <div class="patient-data-row">
                        <span class="pd-label">Sexo</span>
                        <span class="pd-val">{{ h.patient_info.sexo }}</span>
                      </div>
                    }
                    @if (h.patient_info?.obra_social) {
                      <div class="patient-data-row">
                        <span class="pd-label">Obra social</span>
                        <span class="pd-val">{{ h.patient_info.obra_social }}{{ h.patient_info.nro_afiliado ? ' · Nro: ' + h.patient_info.nro_afiliado : '' }}</span>
                      </div>
                    }
                    @if (h.patient_info?.telefono) {
                      <div class="patient-data-row">
                        <span class="pd-label">Teléfono</span>
                        <span class="pd-val">{{ h.patient_info.telefono }}</span>
                      </div>
                    }
                    <div class="patient-data-row">
                      <span class="pd-label">Fecha de consulta</span>
                      <span class="pd-val pd-date">{{ formatDate(h.fecha) }}</span>
                    </div>
                  </div>
                  @if (h.antecedentes_sintomas) { <div class="detail-section"><label>Antecedentes y síntomas</label><p>{{ h.antecedentes_sintomas }}</p></div> }
                  @if (h.examen_fisico) { <div class="detail-section"><label>Exploración física</label><p>{{ h.examen_fisico }}</p></div> }
                  @if (h.signos_vitales) {
                    <div class="detail-section">
                      <label>Signos vitales</label>
                      <div class="signos-row">
                        @if (h.signos_vitales.tension_arterial) { <span class="signo-tag">T.A.: {{ h.signos_vitales.tension_arterial }}</span> }
                        @if (h.signos_vitales.frecuencia_cardiaca) { <span class="signo-tag">FC: {{ h.signos_vitales.frecuencia_cardiaca }}</span> }
                        @if (h.signos_vitales.temperatura) { <span class="signo-tag">Temp: {{ h.signos_vitales.temperatura }}</span> }
                        @if (h.signos_vitales.peso) { <span class="signo-tag">Peso: {{ h.signos_vitales.peso }}</span> }
                        @if (h.signos_vitales.talla) { <span class="signo-tag">Talla: {{ h.signos_vitales.talla }}</span> }
                        @if (h.signos_vitales.saturacion) { <span class="signo-tag">SatO2: {{ h.signos_vitales.saturacion }}</span> }
                      </div>
                    </div>
                  }
                  <!-- Plantillas -->
                  <div class="detail-section">
                    <label>Plantillas</label>
                    <div class="feet-display">
                      <div class="foot-item-sm">
                        <svg viewBox="25 5 75 100" width="44" height="59">
                          <g transform="scale(-1,1) translate(-129,0)">
                            <path [class.foot-yes]="h.plantillas" class="foot-path-sm" d="M 46.857 24.686 C 44.114 49.829 56.229 44.343 39.543 71.771 C 38.171 72.229 40.686 91.429 39.314 82.057 C 41 96 62 96 66 84 C 70 72 82 62 86 46 C 90 30 70 10 51.886 19.886 Z"/>
                          </g>
                        </svg>
                        <span class="foot-lbl">I</span>
                      </div>
                      <div class="foot-item-sm">
                        <svg viewBox="25 5 75 100" width="44" height="59">
                          <path [class.foot-yes]="h.plantillas" class="foot-path-sm" d="M 46.857 24.686 C 44.114 49.829 56.229 44.343 39.543 71.771 C 38.171 72.229 40.686 91.429 39.314 82.057 C 41 96 62 96 66 84 C 70 72 82 62 86 46 C 90 30 70 10 51.886 19.886 Z"/>
                        </svg>
                        <span class="foot-lbl">D</span>
                      </div>
                      <span class="plantilla-tag" [class.yes]="h.plantillas">
                        {{ h.plantillas ? 'Plantillas: Sí' : 'Plantillas: No' }}
                      </span>
                    </div>
                  </div>
                  @if (h.plan_terapeutico) { <div class="detail-section"><label>Indicaciones / Plan terapéutico</label><p>{{ h.plan_terapeutico }}</p></div> }
                  @if (h.estudios_complementarios) { <div class="detail-section"><label>Estudios complementarios</label><p>{{ h.estudios_complementarios }}</p></div> }
                  @if (h.laboratorio) { <div class="detail-section"><label>Laboratorio</label><p>{{ h.laboratorio }}</p></div> }
                  @if (h.medicacion) { <div class="detail-section"><label>Medicación</label><p>{{ h.medicacion }}</p></div> }
                  @if (h.observaciones) { <div class="detail-section"><label>Comentarios</label><p>{{ h.observaciones }}</p></div> }
                  @if (h.imagenes?.length > 0) {
                    <div class="detail-section">
                      <label>Imágenes</label>
                      <div class="archivos-list">
                        @for (img of h.imagenes; track $index) {
                          <a [href]="img.url" target="_blank" class="estudio-link">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                            {{ img.nombre || img.url }}
                          </a>
                        }
                      </div>
                    </div>
                  }
                  @if (h.estudios?.length > 0) {
                    <div class="detail-section">
                      <label>Estudios / Informes</label>
                      <div class="archivos-list">
                        @for (est of h.estudios; track $index) {
                          <a [href]="est.url" target="_blank" class="estudio-link">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                            {{ est.nombre || est.url }}
                          </a>
                        }
                      </div>
                    </div>
                  }
                </div>
              }
            </div>
          }
        </div>
      }
    </div>

    <!-- Modal editar historia -->
    @if (editingHistory()) {
      <div class="modal-overlay" (click)="editingHistory.set(null)">
        <div class="modal" (click)="$event.stopPropagation()">
          <h3>Editar historia clínica</h3>
          <div class="edit-fields">
            <div class="edit-field"><label>Motivo de consulta</label><textarea [(ngModel)]="editForm.motivo_consulta" rows="2"></textarea></div>
            <div class="edit-field"><label>Diagnóstico</label><textarea [(ngModel)]="editForm.diagnostico" rows="2"></textarea></div>
            <div class="edit-field"><label>Antecedentes y síntomas</label><textarea [(ngModel)]="editForm.antecedentes_sintomas" rows="4"></textarea></div>
            <div class="edit-field"><label>Exploración física</label><textarea [(ngModel)]="editForm.examen_fisico" rows="3"></textarea></div>
            <div class="edit-field"><label>Indicaciones / Plan terapéutico</label><textarea [(ngModel)]="editForm.plan_terapeutico" rows="3"></textarea></div>
            <div class="edit-field"><label>Estudios complementarios</label><textarea [(ngModel)]="editForm.estudios_complementarios" rows="2"></textarea></div>
            <div class="edit-field"><label>Laboratorio</label><textarea [(ngModel)]="editForm.laboratorio" rows="2"></textarea></div>
            <div class="edit-field"><label>Medicación</label><textarea [(ngModel)]="editForm.medicacion" rows="2"></textarea></div>
            <div class="edit-field"><label>Comentarios</label><textarea [(ngModel)]="editForm.observaciones" rows="2"></textarea></div>
            <div class="edit-field">
              <label>Plantillas</label>
              <div class="plantilla-toggle" (click)="editForm.plantillas = !editForm.plantillas">
                <svg viewBox="25 5 75 100" width="32" height="43"><g transform="scale(-1,1) translate(-129,0)"><path [class.foot-yes]="editForm.plantillas" class="foot-path-sm" d="M 46.857 24.686 C 44.114 49.829 56.229 44.343 39.543 71.771 C 38.171 72.229 40.686 91.429 39.314 82.057 C 41 96 62 96 66 84 C 70 72 82 62 86 46 C 90 30 70 10 51.886 19.886 Z"/></g></svg>
                <svg viewBox="25 5 75 100" width="32" height="43"><path [class.foot-yes]="editForm.plantillas" class="foot-path-sm" d="M 46.857 24.686 C 44.114 49.829 56.229 44.343 39.543 71.771 C 38.171 72.229 40.686 91.429 39.314 82.057 C 41 96 62 96 66 84 C 70 72 82 62 86 46 C 90 30 70 10 51.886 19.886 Z"/></svg>
                <span class="plantilla-tag" [class.yes]="editForm.plantillas">{{ editForm.plantillas ? 'Plantillas: Sí' : 'Plantillas: No' }}</span>
              </div>
            </div>
            <div class="edit-field">
              <label>Imágenes</label>
              @for (img of editForm.imagenes; track $index) {
                <div class="link-row">
                  <input [(ngModel)]="img.nombre" placeholder="Nombre" class="link-name" />
                  <input [(ngModel)]="img.url" placeholder="https://..." class="link-url" />
                  <button type="button" class="btn-rm" (click)="editForm.imagenes.splice($index, 1)">✕</button>
                </div>
              }
              <button type="button" class="btn-add-link" (click)="editForm.imagenes.push({url:'',nombre:''})">+ Agregar imagen</button>
            </div>
            <div class="edit-field">
              <label>Estudios / Informes</label>
              @for (est of editForm.estudios; track $index) {
                <div class="link-row">
                  <input [(ngModel)]="est.nombre" placeholder="Nombre" class="link-name" />
                  <input [(ngModel)]="est.url" placeholder="https://..." class="link-url" />
                  <button type="button" class="btn-rm" (click)="editForm.estudios.splice($index, 1)">✕</button>
                </div>
              }
              <button type="button" class="btn-add-link" (click)="editForm.estudios.push({url:'',nombre:''})">+ Agregar estudio</button>
            </div>
          </div>
          @if (editError()) { <div class="error-banner">{{ editError() }}</div> }
          <div class="modal-actions">
            <button class="btn-secondary" (click)="editingHistory.set(null)">Cancelar</button>
            <button class="btn-save" (click)="saveEdit()" [disabled]="saving()">{{ saving() ? 'Guardando...' : 'Guardar cambios' }}</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .page { max-width: 900px; }
    .page-header { margin-bottom: 20px; }
    h1 { font-size: 22px; font-weight: 700; color: #111827; margin: 0 0 4px; }
    .subtitle { color: #6b7280; font-size: 14px; margin: 0; }

    .search-bar { display: flex; align-items: center; gap: 10px; background: white; border: 1.5px solid #e5e7eb; border-radius: 12px; padding: 10px 14px; margin-bottom: 20px; }
    .search-bar input { border: none; outline: none; font-size: 14px; flex: 1; font-family: inherit; }

    .history-list { display: flex; flex-direction: column; gap: 8px; }
    .history-card { background: white; border-radius: 14px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.05); border: 1.5px solid #e5e7eb; transition: border-color 0.15s; }
    .history-card.expanded { border-color: #4f46e5; }
    .history-summary { display: flex; align-items: flex-start; justify-content: space-between; padding: 16px 18px; cursor: pointer; gap: 10px; }
    .history-summary:hover { background: #fafafa; }
    .history-left { flex: 1; }
    .history-date { font-size: 12px; color: #9ca3af; font-weight: 500; display: block; margin-bottom: 2px; }
    .patient-link { display: inline-block; font-size: 12px; font-weight: 700; color: #4f46e5; text-decoration: none; margin-bottom: 4px; }
    .patient-link:hover { text-decoration: underline; }
    .history-summary h3 { font-size: 15px; font-weight: 600; color: #111827; margin: 0 0 4px; }
    .history-dx { font-size: 13px; color: #6b7280; margin: 0; }
    .history-actions { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
    .btn-icon-sm { width: 28px; height: 28px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #6b7280; transition: all 0.15s; }
    .btn-icon-sm:hover { border-color: #4f46e5; color: #4f46e5; background: #eef2ff; }
    .chevron { color: #9ca3af; transition: transform 0.2s; margin-left: 4px; flex-shrink: 0; }
    .history-card.expanded .chevron { transform: rotate(180deg); }

    .history-detail { padding: 16px 18px 18px; border-top: 1px solid #f3f4f6; display: flex; flex-direction: column; gap: 14px; animation: slideDown 0.15s ease; }
    .patient-data-card { background: #f8faff; border: 1px solid #e0e7ff; border-radius: 10px; padding: 12px 16px; display: flex; flex-wrap: wrap; gap: 6px 24px; }
    .patient-data-row { display: flex; align-items: baseline; gap: 6px; min-width: 160px; }
    .pd-label { font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.4px; white-space: nowrap; }
    .pd-val { font-size: 14px; color: #111827; font-weight: 500; }
    .pd-date { color: #4f46e5; font-weight: 600; }
    @keyframes slideDown { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
    .detail-section label { display: block; font-size: 12px; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
    .detail-section p { font-size: 14px; color: #374151; margin: 0; line-height: 1.6; }
    .signos-row { display: flex; flex-wrap: wrap; gap: 8px; }
    .signo-tag { background: #f3f4f6; color: #374151; padding: 4px 10px; border-radius: 6px; font-size: 13px; }
    .history-img { max-width: 100%; max-height: 300px; border-radius: 8px; border: 1px solid #e5e7eb; margin-top: 4px; }
    .estudio-link { display: inline-flex; align-items: center; gap: 6px; color: #4f46e5; font-size: 13px; text-decoration: none; font-weight: 500; }
    .estudio-link:hover { text-decoration: underline; }

    .loading-text { padding: 32px; text-align: center; color: #9ca3af; }
    .empty-state { text-align: center; padding: 56px; display: flex; flex-direction: column; align-items: center; gap: 12px; color: #9ca3af; }
    .empty-state p { font-size: 15px; margin: 0; }

    /* Modal */
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 200; padding: 16px; }
    .modal { background: white; border-radius: 16px; padding: 28px; max-width: 700px; width: 100%; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.2); }
    .modal h3 { font-size: 18px; font-weight: 700; color: #111827; margin: 0 0 16px; }
    .modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px; }
    .btn-secondary { padding: 8px 16px; background: #f3f4f6; border: none; border-radius: 8px; font-size: 14px; cursor: pointer; color: #374151; }
    .btn-save { padding: 8px 16px; background: #4f46e5; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
    .btn-save:disabled { opacity: 0.6; cursor: not-allowed; }
    .edit-fields { display: flex; flex-direction: column; gap: 12px; }
    .edit-field { display: flex; flex-direction: column; gap: 4px; }
    .edit-field label { font-size: 12px; font-weight: 600; color: #6b7280; }
    .edit-field input, .edit-field textarea { padding: 8px 10px; border: 1.5px solid #e5e7eb; border-radius: 8px; font-size: 14px; outline: none; font-family: inherit; resize: vertical; }
    .edit-field input:focus, .edit-field textarea:focus { border-color: #4f46e5; }
    .edit-field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    /* Feet display */
    .feet-display { display: flex; align-items: flex-end; gap: 12px; flex-wrap: wrap; }
    .foot-item-sm { display: flex; flex-direction: column; align-items: center; gap: 2px; }
    .foot-lbl { font-size: 9px; font-weight: 700; color: #9ca3af; letter-spacing: 1px; }
    .foot-path-sm { fill: #d1d5db; stroke: #9ca3af; stroke-width: 1.5; }
    .foot-yes { fill: #818cf8; stroke: #4338ca; }
    .foot-zone-sm { fill: rgba(55,48,163,0.5); }
    .plantilla-tag { font-size: 12px; font-weight: 600; color: #9ca3af; align-self: center; }
    .plantilla-tag.yes { color: #4f46e5; }
    .plantilla-toggle { display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 6px 8px; border-radius: 8px; transition: background 0.2s; }
    .plantilla-toggle:hover { background: #f0f4ff; }

    .archivos-list { display: flex; flex-direction: column; gap: 6px; }
    .link-row { display: flex; gap: 8px; align-items: center; margin-bottom: 6px; }
    .link-name { flex: 1; min-width: 0; }
    .link-url { flex: 2; min-width: 0; }
    .btn-rm { padding: 4px 8px; background: #fef2f2; color: #dc2626; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; flex-shrink: 0; }
    .btn-add-link { padding: 5px 12px; background: #eef2ff; color: #4f46e5; border: none; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; margin-top: 2px; }
    .error-banner { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 8px; padding: 10px 14px; font-size: 13px; margin-top: 10px; }

    @media (max-width: 640px) {
      .edit-field-row { grid-template-columns: 1fr; }
    }
  `]
})
export class ProfessionalHistoriesComponent implements OnInit {
  private api = inject(ApiService);

  histories = signal<any[]>([]);
  loading = signal(true);
  expanded = signal<string | null>(null);
  editingHistory = signal<string | null>(null);
  saving = signal(false);
  editError = signal('');
  search = '';
  editForm: any = {};
  private editPatientId = '';

  get filtered() {
    return () => {
      const q = this.search.toLowerCase();
      return this.histories().filter(h =>
        !q ||
        (h.patient_name || '').toLowerCase().includes(q) ||
        (h.motivo_consulta || '').toLowerCase().includes(q) ||
        (h.diagnostico || '').toLowerCase().includes(q)
      );
    };
  }

  ngOnInit() {
    this.api.getAllClinicalHistories().subscribe({
      next: (data) => { this.histories.set(data); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  toggle(id: string) {
    this.expanded.set(this.expanded() === id ? null : id);
  }

  openEdit(h: any) {
    this.editingHistory.set(h.id);
    this.editPatientId = h.patient_id;
    this.editError.set('');
    this.editForm = {
      motivo_consulta: h.motivo_consulta || '',
      diagnostico: h.diagnostico || '',
      antecedentes_sintomas: h.antecedentes_sintomas || '',
      examen_fisico: h.examen_fisico || '',
      plan_terapeutico: h.plan_terapeutico || '',
      estudios_complementarios: h.estudios_complementarios || '',
      laboratorio: h.laboratorio || '',
      medicacion: h.medicacion || '',
      observaciones: h.observaciones || '',
      plantillas: h.plantillas || false,
      imagenes: (h.imagenes || []).map((i: any) => ({ url: i.url || '', nombre: i.nombre || '' })),
      estudios: (h.estudios || []).map((e: any) => ({ url: e.url || '', nombre: e.nombre || '' }))
    };
  }

  saveEdit() {
    const id = this.editingHistory();
    if (!id) return;
    this.saving.set(true);
    this.editError.set('');
    const payload: any = {};
    for (const [k, v] of Object.entries(this.editForm)) {
      if (v !== '') payload[k] = v;
    }
    this.api.updateClinicalHistory(id, this.editPatientId, payload).subscribe({
      next: () => {
        this.histories.update(hs => hs.map(h => h.id === id ? { ...h, ...this.editForm } : h));
        this.editingHistory.set(null);
        this.saving.set(false);
      },
      error: (err) => {
        this.editError.set(err.error?.detail || 'Error al guardar');
        this.saving.set(false);
      }
    });
  }

  private buildHistoryHtml(h: any): string {
    const date = this.formatDate(h.fecha);
    const sv = h.signos_vitales;
    const signosHtml = sv ? `<div class="section"><label>Signos vitales</label><p>
      ${sv.tension_arterial ? `TA: ${sv.tension_arterial}` : ''}
      ${sv.frecuencia_cardiaca ? ` · FC: ${sv.frecuencia_cardiaca}` : ''}
      ${sv.temperatura ? ` · Temp: ${sv.temperatura}` : ''}
      ${sv.peso ? ` · Peso: ${sv.peso}` : ''}
      ${sv.saturacion ? ` · SatO2: ${sv.saturacion}` : ''}</p></div>` : '';
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Historia clínica - ${h.patient_name}</title>
      <style>body{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;color:#111}h1{font-size:22px;margin-bottom:4px}
      .sub{color:#666;font-size:14px;margin-bottom:24px}.section{margin-bottom:16px}.section label{font-size:11px;font-weight:700;color:#666;text-transform:uppercase;display:block;margin-bottom:4px}
      .section p{margin:0;line-height:1.6;font-size:14px}hr{border:none;border-top:1px solid #eee;margin:16px 0}@media print{body{margin:20px}}</style></head>
      <body>
      <h1>${h.patient_name}</h1>
      <div class="sub">Fecha de consulta: ${date}${h.professional_name ? ` · Prof: ${h.professional_name}` : ''}</div>
      <hr>
      ${h.motivo_consulta ? `<div class="section"><label>Motivo de consulta</label><p>${h.motivo_consulta}</p></div>` : ''}
      ${h.antecedentes_sintomas ? `<div class="section"><label>Antecedentes y síntomas</label><p>${h.antecedentes_sintomas}</p></div>` : ''}
      ${h.examen_fisico ? `<div class="section"><label>Exploración física</label><p>${h.examen_fisico}</p></div>` : ''}
      ${signosHtml}
      ${h.diagnostico ? `<div class="section"><label>Diagnóstico</label><p>${h.diagnostico}</p></div>` : ''}
      ${h.plan_terapeutico ? `<div class="section"><label>Indicaciones / Plan terapéutico</label><p>${h.plan_terapeutico}</p></div>` : ''}
      ${h.estudios_complementarios ? `<div class="section"><label>Estudios complementarios</label><p>${h.estudios_complementarios}</p></div>` : ''}
      ${h.laboratorio ? `<div class="section"><label>Laboratorio</label><p>${h.laboratorio}</p></div>` : ''}
      ${h.medicacion ? `<div class="section"><label>Medicación</label><p>${h.medicacion}</p></div>` : ''}
      ${h.observaciones ? `<div class="section"><label>Comentarios</label><p>${h.observaciones}</p></div>` : ''}
      <div class="section"><label>Plantillas</label><p>${h.plantillas ? 'Sí' : 'No'}</p></div>
      </body></html>`;
  }

  downloadHistory(h: any) {
    const html = this.buildHistoryHtml(h);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = (h.patient_name || 'paciente').replace(/\s+/g, '_').toLowerCase();
    const date = this.formatDate(h.fecha).replace(/\s/g, '-');
    a.href = url;
    a.download = `historia_${safeName}_${date}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  printHistory(h: any) {
    const html = this.buildHistoryHtml(h);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (win) win.addEventListener('load', () => { win.print(); URL.revokeObjectURL(url); });
  }

  formatDate(date: any): string {
    if (!date) return '';
    try {
      const d = date.seconds ? new Date(date.seconds * 1000) : new Date(date);
      return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return ''; }
  }
}

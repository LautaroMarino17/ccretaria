import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { MANIOBRA_SECTIONS, ALL_JOINTS, emptyManiobras } from '../../../core/models/clinical-history.model';

function emptyForm() {
  return {
    motivo_consulta: '', diagnostico: '', antecedentes_sintomas: '',
    examen_fisico: '', exploracion_estatica: '', exploracion_dinamica: '',
    maniobras: emptyManiobras(),
    plan_terapeutico: '', estudios_complementarios: '',
    laboratorio: '', medicacion: '', observaciones: '',
    plantillas: false, descripcion_pedografia: '',
    signos_vitales: { tension_arterial: '', frecuencia_cardiaca: '', temperatura: '', peso: '', talla: '', saturacion: '' },
    imagenes: [] as { url: string; nombre: string }[],
    estudios: [] as { url: string; nombre: string }[],
  };
}

@Component({
  selector: 'app-patient-clinical-histories',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="page">
      <div class="page-header">
        <a [routerLink]="['/professional/patients', patientId]" class="btn-back">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
          Volver al paciente
        </a>
        <div class="header-row">
          <div>
            <h1>Historias clínicas</h1>
            <p class="subtitle">{{ patientName() }}</p>
          </div>
          <button class="btn-primary" (click)="openNew()">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Nueva historia
          </button>
        </div>
      </div>

      @if (loading()) {
        <div class="loading-text">Cargando...</div>
      } @else if (histories().length === 0) {
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          <p>No hay historias clínicas registradas aún</p>
          <button class="btn-primary" (click)="openNew()">Crear primera historia</button>
        </div>
      } @else {
        <div class="history-list">
          @for (h of histories(); track h.id) {
            <div class="history-card" [class.expanded]="expanded() === h.id">
              <div class="history-summary" (click)="toggleExpand(h.id)">
                <div class="history-left">
                  <span class="history-date">{{ formatDate(h.fecha?.seconds ? h.fecha.toDate() : h.fecha) }}</span>
                  <p class="history-motivo">{{ h.motivo_consulta || 'Sin motivo registrado' }}</p>
                  @if (h.diagnostico) { <p class="history-dx">Dx: {{ h.diagnostico }}</p> }
                  @if (h.professional_name) { <p class="history-prof">{{ h.professional_name }}</p> }
                </div>
                <div class="history-actions" (click)="$event.stopPropagation()">
                  <button class="btn-icon-sm" (click)="printHistory(h)" title="Imprimir">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                  </button>
                  <button class="btn-icon-sm" (click)="openEdit(h)" title="Editar">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button class="btn-icon-sm danger" (click)="deleteHistory(h.id)" title="Eliminar">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                  </button>
                  <svg class="chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                </div>
              </div>

              @if (expanded() === h.id) {
                <div class="history-detail">
                  <div class="medical-form">
                    <div class="mf-header">
                      <span class="mf-title">HISTORIA CLÍNICA</span>
                      <span class="mf-date">{{ formatDate(h.fecha?.seconds ? h.fecha.toDate() : h.fecha) }}{{ h.professional_name ? ' · ' + h.professional_name : '' }}</span>
                    </div>
                    <div class="mf-patient-row">
                      <div class="mf-patient-field wide"><span class="mf-plabel">Paciente</span><span class="mf-pval">{{ h.nombre_paciente || patientName() }}</span></div>
                      @if (h.signos_vitales?.tension_arterial) { <div class="mf-patient-field"><span class="mf-plabel">T.A.</span><span class="mf-pval">{{ h.signos_vitales.tension_arterial }}</span></div> }
                      @if (h.signos_vitales?.frecuencia_cardiaca) { <div class="mf-patient-field"><span class="mf-plabel">FC</span><span class="mf-pval">{{ h.signos_vitales.frecuencia_cardiaca }}</span></div> }
                      @if (h.signos_vitales?.temperatura) { <div class="mf-patient-field"><span class="mf-plabel">Temp.</span><span class="mf-pval">{{ h.signos_vitales.temperatura }}</span></div> }
                      @if (h.signos_vitales?.peso) { <div class="mf-patient-field"><span class="mf-plabel">Peso</span><span class="mf-pval">{{ h.signos_vitales.peso }}</span></div> }
                      @if (h.signos_vitales?.talla) { <div class="mf-patient-field"><span class="mf-plabel">Talla</span><span class="mf-pval">{{ h.signos_vitales.talla }}</span></div> }
                      @if (h.signos_vitales?.saturacion) { <div class="mf-patient-field"><span class="mf-plabel">SatO2</span><span class="mf-pval">{{ h.signos_vitales.saturacion }}</span></div> }
                    </div>
                    @if (h.motivo_consulta) { <div class="mf-section"><span class="mf-label">Motivo de consulta</span><p class="mf-text">{{ h.motivo_consulta }}</p></div> }
                    @if (h.antecedentes_sintomas) { <div class="mf-section"><span class="mf-label">Antecedentes y síntomas</span><p class="mf-text">{{ h.antecedentes_sintomas }}</p></div> }
                    @if (h.exploracion_estatica) { <div class="mf-section"><span class="mf-label">Exploración estática</span><p class="mf-text">{{ h.exploracion_estatica }}</p></div> }
                    @if (h.exploracion_dinamica) { <div class="mf-section"><span class="mf-label">Inspección dinámica</span><p class="mf-text">{{ h.exploracion_dinamica }}</p></div> }
                    @if (hasManiobras(h)) {
                      <div class="mf-section">
                        <span class="mf-label">Maniobras semiológicas</span>
                        <table class="mf-man-table">
                          <thead><tr><th>Articulación</th><th>Comentario</th></tr></thead>
                          <tbody>
                            @for (section of maniobra_sections; track section.label) {
                              @if (section.joints.length > 1) {
                                @if (sectionHasManiobras(h, section.joints)) {
                                  <tr class="mf-man-section"><td colspan="2">{{ section.label }}</td></tr>
                                  @for (joint of section.joints; track joint) {
                                    @if (h.maniobras?.[joint]?.comentario) {
                                      <tr><td class="mf-man-joint">{{ joint }}</td><td class="mf-man-com">{{ h.maniobras[joint].comentario }}</td></tr>
                                    }
                                  }
                                }
                              } @else {
                                @if (h.maniobras?.[section.joints[0]]?.comentario) {
                                  <tr><td class="mf-man-joint">{{ section.label }}</td><td class="mf-man-com">{{ h.maniobras[section.joints[0]].comentario }}</td></tr>
                                }
                              }
                            }
                          </tbody>
                        </table>
                      </div>
                    }
                    @if (h.diagnostico) { <div class="mf-section"><span class="mf-label">Diagnóstico</span><p class="mf-text">{{ h.diagnostico }}</p></div> }
                    <div class="mf-section mf-plantillas-row">
                      <span class="mf-label">Plantillas</span>
                      <div class="mf-plantillas-body">
                        <div class="mf-feet">
                          <div class="mf-foot-item"><svg viewBox="25 5 75 100" width="44" height="58"><g transform="scale(-1,1) translate(-129,0)"><path [class.foot-yes]="h.plantillas" class="foot-path" d="M 46.857 24.686 C 44.114 49.829 56.229 44.343 39.543 71.771 C 38.171 72.229 40.686 91.429 39.314 82.057 C 41 96 62 96 66 84 C 70 72 82 62 86 46 C 90 30 70 10 51.886 19.886 Z"/></g></svg><span class="foot-side">I</span></div>
                          <div class="mf-foot-item"><svg viewBox="25 5 75 100" width="44" height="58"><path [class.foot-yes]="h.plantillas" class="foot-path" d="M 46.857 24.686 C 44.114 49.829 56.229 44.343 39.543 71.771 C 38.171 72.229 40.686 91.429 39.314 82.057 C 41 96 62 96 66 84 C 70 72 82 62 86 46 C 90 30 70 10 51.886 19.886 Z"/></svg><span class="foot-side">D</span></div>
                        </div>
                        <div class="plantilla-status" [class.active]="h.plantillas">{{ h.plantillas ? 'Plantillas: Sí' : 'Plantillas: No' }}</div>
                      </div>
                      @if (h.plantillas && h.descripcion_pedografia) { <p class="mf-text" style="margin-top:6px">{{ h.descripcion_pedografia }}</p> }
                    </div>
                    @if (h.plan_terapeutico) { <div class="mf-section"><span class="mf-label">Plan terapéutico</span><p class="mf-text">{{ h.plan_terapeutico }}</p></div> }
                    @if (h.estudios_complementarios || h.laboratorio) {
                      <div class="mf-section mf-row">
                        @if (h.estudios_complementarios) { <div class="mf-col"><span class="mf-label">Estudios complementarios</span><p class="mf-text">{{ h.estudios_complementarios }}</p></div> }
                        @if (h.laboratorio) { <div class="mf-col"><span class="mf-label">Laboratorio</span><p class="mf-text">{{ h.laboratorio }}</p></div> }
                      </div>
                    }
                    @if (h.medicacion) { <div class="mf-section"><span class="mf-label">Medicación</span><p class="mf-text">{{ h.medicacion }}</p></div> }
                    @if (h.observaciones) { <div class="mf-section mf-last"><span class="mf-label">Observaciones</span><p class="mf-text">{{ h.observaciones }}</p></div> }
                  </div>
                  @if (h.imagenes?.length > 0 || h.estudios?.length > 0) {
                    <div class="attachments-row">
                      @if (h.imagenes?.length > 0) {
                        <div><span class="att-label">Imágenes</span>
                          @for (img of h.imagenes; track $index) {
                            <a [href]="img.url" target="_blank" class="file-link"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>{{ img.nombre || img.url }}</a>
                          }
                        </div>
                      }
                      @if (h.estudios?.length > 0) {
                        <div><span class="att-label">Estudios</span>
                          @for (est of h.estudios; track $index) {
                            <a [href]="est.url" target="_blank" class="file-link"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>{{ est.nombre || est.url }}</a>
                          }
                        </div>
                      }
                    </div>
                  }
                </div>
              }
            </div>
          }
        </div>
      }
    </div>

    <!-- ── Modal nueva / editar historia ── -->
    @if (showModal()) {
      <div class="modal-overlay" (click)="closeModal()">
        <div class="modal-lg" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>{{ editingId() ? 'Editar historia clínica' : 'Nueva historia clínica' }}</h2>
            <button class="btn-modal-close" (click)="closeModal()">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          <div class="modal-body">
            <div class="medical-form">
              <div class="mf-header">
                <span class="mf-title">HISTORIA CLÍNICA</span>
                <span class="mf-date">{{ today() }}</span>
              </div>
              <div class="mf-patient-row">
                <div class="mf-patient-field"><span class="mf-plabel">T.A.</span><input class="mf-pinput" [(ngModel)]="form.signos_vitales.tension_arterial" placeholder="—" /></div>
                <div class="mf-patient-field"><span class="mf-plabel">FC</span><input class="mf-pinput" [(ngModel)]="form.signos_vitales.frecuencia_cardiaca" placeholder="—" /></div>
                <div class="mf-patient-field"><span class="mf-plabel">Temp.</span><input class="mf-pinput" [(ngModel)]="form.signos_vitales.temperatura" placeholder="—" /></div>
                <div class="mf-patient-field"><span class="mf-plabel">Peso</span><input class="mf-pinput" [(ngModel)]="form.signos_vitales.peso" placeholder="—" /></div>
                <div class="mf-patient-field"><span class="mf-plabel">Talla</span><input class="mf-pinput" [(ngModel)]="form.signos_vitales.talla" placeholder="—" /></div>
                <div class="mf-patient-field"><span class="mf-plabel">SatO2</span><input class="mf-pinput" [(ngModel)]="form.signos_vitales.saturacion" placeholder="—" /></div>
              </div>
              <div class="mf-section"><span class="mf-label">Motivo de consulta</span><textarea class="mf-textarea" [(ngModel)]="form.motivo_consulta" rows="2" placeholder="—"></textarea></div>
              <div class="mf-section"><span class="mf-label">Antecedentes y síntomas</span><textarea class="mf-textarea" [(ngModel)]="form.antecedentes_sintomas" rows="4" placeholder="—"></textarea></div>
              <div class="mf-section"><span class="mf-label">Exploración estática</span><textarea class="mf-textarea" [(ngModel)]="form.exploracion_estatica" rows="3" placeholder="—"></textarea></div>
              <div class="mf-section"><span class="mf-label">Inspección dinámica</span><textarea class="mf-textarea" [(ngModel)]="form.exploracion_dinamica" rows="3" placeholder="—"></textarea></div>
              <div class="mf-section">
                <span class="mf-label">Maniobras semiológicas</span>
                <table class="mf-man-table mf-man-edit">
                  <thead><tr><th>Articulación</th><th>Comentario</th></tr></thead>
                  <tbody>
                    @for (section of maniobra_sections; track section.label) {
                      @if (section.joints.length > 1) {
                        <tr class="mf-man-section"><td colspan="2">{{ section.label }}</td></tr>
                        @for (joint of section.joints; track joint) {
                          <tr><td class="mf-man-joint">{{ joint }}</td><td><input class="mf-man-input" [(ngModel)]="form.maniobras[joint].comentario" placeholder="—" /></td></tr>
                        }
                      } @else {
                        <tr><td class="mf-man-joint">{{ section.label }}</td><td><input class="mf-man-input" [(ngModel)]="form.maniobras[section.joints[0]].comentario" placeholder="—" /></td></tr>
                      }
                    }
                  </tbody>
                </table>
              </div>
              <div class="mf-section"><span class="mf-label">Diagnóstico</span><textarea class="mf-textarea" [(ngModel)]="form.diagnostico" rows="2" placeholder="—"></textarea></div>
              <div class="mf-section mf-plantillas-row">
                <span class="mf-label">Plantillas</span>
                <div class="mf-plantillas-body">
                  <div class="mf-feet" (click)="form.plantillas = !form.plantillas" style="cursor:pointer">
                    <div class="mf-foot-item"><svg viewBox="25 5 75 100" width="44" height="58"><g transform="scale(-1,1) translate(-129,0)"><path [class.foot-yes]="form.plantillas" class="foot-path" d="M 46.857 24.686 C 44.114 49.829 56.229 44.343 39.543 71.771 C 38.171 72.229 40.686 91.429 39.314 82.057 C 41 96 62 96 66 84 C 70 72 82 62 86 46 C 90 30 70 10 51.886 19.886 Z"/></g></svg><span class="foot-side">I</span></div>
                    <div class="mf-foot-item"><svg viewBox="25 5 75 100" width="44" height="58"><path [class.foot-yes]="form.plantillas" class="foot-path" d="M 46.857 24.686 C 44.114 49.829 56.229 44.343 39.543 71.771 C 38.171 72.229 40.686 91.429 39.314 82.057 C 41 96 62 96 66 84 C 70 72 82 62 86 46 C 90 30 70 10 51.886 19.886 Z"/></svg><span class="foot-side">D</span></div>
                  </div>
                  <div class="plantilla-status" [class.active]="form.plantillas">{{ form.plantillas ? 'Plantillas: Sí' : 'Plantillas: No' }}</div>
                  <span class="feet-hint">Clic en los pies para indicar</span>
                </div>
              </div>
              @if (form.plantillas) {
                <div class="mf-section"><span class="mf-label">Descripción de plantilla</span><textarea class="mf-textarea" [(ngModel)]="form.descripcion_pedografia" rows="2" placeholder="—"></textarea></div>
              }
              <div class="mf-section"><span class="mf-label">Plan terapéutico / Indicaciones</span><textarea class="mf-textarea" [(ngModel)]="form.plan_terapeutico" rows="3" placeholder="—"></textarea></div>
              <div class="mf-section mf-row">
                <div class="mf-col"><span class="mf-label">Estudios complementarios</span><textarea class="mf-textarea" [(ngModel)]="form.estudios_complementarios" rows="2" placeholder="—"></textarea></div>
                <div class="mf-col"><span class="mf-label">Laboratorio</span><textarea class="mf-textarea" [(ngModel)]="form.laboratorio" rows="2" placeholder="—"></textarea></div>
              </div>
              <div class="mf-section"><span class="mf-label">Medicación</span><textarea class="mf-textarea" [(ngModel)]="form.medicacion" rows="2" placeholder="—"></textarea></div>
              <div class="mf-section mf-last"><span class="mf-label">Observaciones</span><textarea class="mf-textarea" [(ngModel)]="form.observaciones" rows="2" placeholder="—"></textarea></div>
            </div>
            <div class="section-title" style="margin-top:16px">Archivos</div>
            <div class="field">
              <label>Imágenes</label>
              @for (img of form.imagenes; track $index) {
                <div class="link-row">
                  <input [(ngModel)]="img.nombre" placeholder="Nombre (ej: RX rodilla)" class="link-name" />
                  <input [(ngModel)]="img.url" placeholder="https://..." class="link-url" />
                  <button type="button" class="btn-rm" (click)="form.imagenes.splice($index, 1)">✕</button>
                </div>
              }
              <button type="button" class="btn-add-link" (click)="form.imagenes.push({url:'',nombre:''})">+ Agregar imagen</button>
            </div>
            <div class="field">
              <label>Estudios / Informes</label>
              @for (est of form.estudios; track $index) {
                <div class="link-row">
                  <input [(ngModel)]="est.nombre" placeholder="Nombre" class="link-name" />
                  <input [(ngModel)]="est.url" placeholder="https://..." class="link-url" />
                  <button type="button" class="btn-rm" (click)="form.estudios.splice($index, 1)">✕</button>
                </div>
              }
              <button type="button" class="btn-add-link" (click)="form.estudios.push({url:'',nombre:''})">+ Agregar estudio</button>
            </div>
          </div>

          @if (formError()) { <div class="error-banner">{{ formError() }}</div> }
          <div class="modal-footer">
            <button class="btn-secondary" (click)="closeModal()">Cancelar</button>
            <button class="btn-primary" (click)="save()" [disabled]="saving()">{{ saving() ? 'Guardando...' : (editingId() ? 'Guardar cambios' : 'Crear historia') }}</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .page { max-width: 900px; }
    .page-header { margin-bottom: 24px; }
    .btn-back { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; background: white; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 14px; color: #374151; text-decoration: none; margin-bottom: 16px; }
    .header-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
    h1 { font-size: 22px; font-weight: 700; color: #111827; margin: 0 0 4px; }
    .subtitle { color: #6b7280; font-size: 14px; margin: 0; }
    .btn-primary { display: flex; align-items: center; gap: 7px; padding: 10px 18px; background: #16a34a; color: white; border: none; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; flex-shrink: 0; }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .loading-text { padding: 40px; text-align: center; color: #9ca3af; }
    .empty-state { text-align: center; padding: 56px; display: flex; flex-direction: column; align-items: center; gap: 12px; color: #9ca3af; }
    .empty-state p { font-size: 15px; margin: 0; }

    /* History list */
    .history-list { display: flex; flex-direction: column; gap: 8px; }
    .history-card { background: white; border-radius: 14px; border: 1.5px solid #e5e7eb; overflow: hidden; transition: border-color 0.15s; box-shadow: 0 1px 4px rgba(0,0,0,0.04); }
    .history-card.expanded { border-color: #16a34a; }
    .history-summary { display: flex; align-items: flex-start; justify-content: space-between; padding: 14px 16px; cursor: pointer; gap: 10px; }
    .history-summary:hover { background: #f9fafb; }
    .history-left { flex: 1; }
    .history-date { font-size: 11px; color: #9ca3af; display: block; margin-bottom: 2px; }
    .history-motivo { font-size: 14px; color: #374151; margin: 0 0 2px; font-weight: 500; }
    .history-dx { font-size: 13px; color: #6b7280; margin: 0 0 2px; }
    .history-prof { font-size: 11px; color: #16a34a; margin: 0; font-weight: 600; }
    .history-actions { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
    .btn-icon-sm { width: 28px; height: 28px; background: white; border: 1px solid #e5e7eb; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #6b7280; }
    .btn-icon-sm:hover { border-color: #16a34a; color: #16a34a; }
    .btn-icon-sm.danger:hover { border-color: #dc2626; color: #dc2626; }
    .chevron { color: #9ca3af; transition: transform 0.2s; margin-left: 4px; flex-shrink: 0; }
    .history-card.expanded .chevron { transform: rotate(180deg); }

    /* Detail expanded */
    .history-detail { padding: 14px 16px 16px; border-top: 1px solid #e5e7eb; display: flex; flex-direction: column; gap: 12px; animation: slideDown 0.15s ease; }
    @keyframes slideDown { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
    .ds label { display: block; font-size: 11px; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .ds p { font-size: 14px; color: #374151; margin: 0; line-height: 1.6; }
    .signos-row { display: flex; flex-wrap: wrap; gap: 6px; }
    .signo-tag { background: white; border: 1px solid #e5e7eb; color: #374151; padding: 3px 8px; border-radius: 6px; font-size: 12px; }

    /* Maniobras */
    .maniobras-table { background: #f9fafb; border-radius: 8px; overflow: hidden; }
    .man-head { display: grid; grid-template-columns: 160px 1fr; padding: 7px 10px; background: #f3f4f6; font-size: 10px; font-weight: 700; color: #9ca3af; text-transform: uppercase; }
    .man-section-row { padding: 5px 10px; background: #eff6ff; font-size: 10px; font-weight: 700; color: #3b82f6; text-transform: uppercase; letter-spacing: 0.6px; border-top: 1px solid #dbeafe; }
    .man-section-row span { display: block; }
    .man-row { display: grid; grid-template-columns: 160px 1fr; padding: 7px 10px; border-top: 1px solid #e5e7eb; align-items: center; }
    .man-joint { font-size: 12px; color: #374151; font-weight: 600; }
    .man-com { font-size: 13px; color: #6b7280; }
    .man-section-divider { padding: 5px 10px; background: #eff6ff; font-size: 10px; font-weight: 700; color: #3b82f6; text-transform: uppercase; letter-spacing: 0.6px; border-top: 1px solid #dbeafe; }

    /* Plantillas */
    .feet-display { display: flex; align-items: center; gap: 12px; }
    .foot-item { display: flex; flex-direction: column; align-items: center; gap: 2px; }
    .foot-path { fill: #e5e7eb; stroke: #9ca3af; stroke-width: 1; transition: fill 0.2s, stroke 0.2s; }
    .foot-path.foot-yes { fill: #a5b4fc; stroke: #16a34a; }
    .foot-lbl { font-size: 10px; color: #9ca3af; font-weight: 600; }
    .plantilla-tag { padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; background: #f3f4f6; color: #9ca3af; }
    .plantilla-tag.yes { background: #f0fdf4; color: #16a34a; }
    .plantilla-toggle { display: flex; align-items: center; gap: 12px; cursor: pointer; padding: 8px; border-radius: 8px; border: 1.5px dashed #e5e7eb; user-select: none; }
    .plantilla-toggle:hover { background: #f9fafb; }
    .pedo-box { background: #f0fdf4; border-radius: 8px; padding: 10px 12px; margin-top: 8px; }
    .pedo-label { display: block; font-size: 10px; font-weight: 700; color: #166534; text-transform: uppercase; margin-bottom: 3px; }
    .pedo-box p { font-size: 13px; color: #166534; margin: 0; }

    .links-list { display: flex; flex-direction: column; gap: 4px; }
    .file-link { display: inline-flex; align-items: center; gap: 6px; color: #16a34a; font-size: 13px; text-decoration: none; font-weight: 500; }
    .file-link:hover { text-decoration: underline; }

    /* Modal */
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: flex-start; justify-content: center; z-index: 100; padding: 16px; overflow-y: auto; }
    .modal-lg { background: white; border-radius: 16px; width: 100%; max-width: 720px; margin: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.2); }
    .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px 0; }
    .modal-header h2 { font-size: 18px; font-weight: 700; color: #111827; margin: 0; }
    .btn-modal-close { width: 32px; height: 32px; border-radius: 8px; border: none; background: #f3f4f6; color: #6b7280; cursor: pointer; display: flex; align-items: center; justify-content: center; }
    .btn-modal-close:hover { background: #e5e7eb; }
    .modal-body { padding: 20px 24px; display: flex; flex-direction: column; gap: 10px; max-height: 75vh; overflow-y: auto; }
    .modal-footer { display: flex; gap: 10px; justify-content: flex-end; padding: 16px 24px; border-top: 1px solid #e5e7eb; }
    .btn-secondary { padding: 10px 18px; background: #f3f4f6; color: #374151; border: none; border-radius: 10px; font-size: 14px; cursor: pointer; }

    .section-title { font-size: 11px; font-weight: 700; color: #16a34a; text-transform: uppercase; letter-spacing: 0.8px; padding: 6px 0 2px; border-bottom: 1.5px solid #f0fdf4; margin-top: 4px; }
    .field { display: flex; flex-direction: column; gap: 4px; }
    .field label { font-size: 12px; font-weight: 600; color: #6b7280; }
    .field input, .field textarea { padding: 8px 10px; border: 1.5px solid #e5e7eb; border-radius: 8px; font-size: 14px; outline: none; font-family: inherit; resize: vertical; }
    .field input:focus, .field textarea:focus { border-color: #16a34a; }
    .mt-8 { margin-top: 8px; }

    /* Maniobras form */
    .maniobras-form { border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; }
    .man-form-head { display: grid; grid-template-columns: 160px 1fr; padding: 8px 10px; background: #f3f4f6; font-size: 10px; font-weight: 700; color: #9ca3af; text-transform: uppercase; }
    .man-form-row { display: grid; grid-template-columns: 160px 1fr; padding: 5px 10px; border-top: 1px solid #f0f0f0; align-items: center; gap: 6px; }
    .man-input.wide { width: 100%; }
    .man-form-row:hover { background: #fafafa; }
    .man-joint-label { font-size: 12px; font-weight: 600; color: #374151; }
    .man-input { padding: 4px 8px; border: 1.5px solid #e5e7eb; border-radius: 6px; font-size: 13px; outline: none; font-family: inherit; }
    .man-input:focus { border-color: #16a34a; }

    /* Signos vitales form */
    .signos-inputs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .signos-inputs input { padding: 8px 10px; border: 1.5px solid #e5e7eb; border-radius: 8px; font-size: 13px; outline: none; font-family: inherit; }
    .signos-inputs input:focus { border-color: #16a34a; }

    /* Links */
    .link-row { display: flex; gap: 8px; align-items: center; margin-bottom: 6px; }
    .link-name { flex: 1; min-width: 0; padding: 6px 8px; border: 1.5px solid #e5e7eb; border-radius: 6px; font-size: 13px; outline: none; }
    .link-url { flex: 2; min-width: 0; padding: 6px 8px; border: 1.5px solid #e5e7eb; border-radius: 6px; font-size: 13px; outline: none; }
    .link-name:focus, .link-url:focus { border-color: #16a34a; }
    .btn-rm { padding: 4px 8px; background: #fef2f2; color: #dc2626; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; flex-shrink: 0; }
    .btn-add-link { padding: 5px 10px; background: #f0fdf4; color: #16a34a; border: none; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; }

    .error-banner { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 8px; padding: 10px 14px; font-size: 13px; margin: 0 24px; }

    @media (max-width: 640px) {
      .signos-inputs { grid-template-columns: 1fr 1fr; }
      .man-form-row { grid-template-columns: 1fr; }
      .man-joint-label { font-weight: 700; color: #16a34a; }
      .man-head { display: none; }
      .man-row { grid-template-columns: 1fr; gap: 2px; }
      .man-head { display: none; }
    }

    /* ── Medical form (shared with record-history) ── */
    .medical-form { background: white; border: 1.5px solid #c9cdd4; border-radius: 6px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.07); font-family: Georgia, 'Times New Roman', serif; }
    .mf-header { display: flex; justify-content: space-between; align-items: center; background: #f8f9fa; border-bottom: 1.5px solid #c9cdd4; padding: 10px 20px; }
    .mf-title { font-size: 13px; font-weight: 700; color: #374151; letter-spacing: 0.8px; font-family: Arial, sans-serif; }
    .mf-date { font-size: 12px; color: #6b7280; font-family: Arial, sans-serif; }
    .mf-patient-row { display: flex; flex-wrap: wrap; gap: 0; border-bottom: 1.5px solid #c9cdd4; }
    .mf-patient-field { display: flex; flex-direction: column; padding: 8px 14px; border-right: 1px solid #e5e7eb; min-width: 80px; }
    .mf-patient-field.wide { flex: 1; min-width: 200px; }
    .mf-patient-field:last-child { border-right: none; }
    .mf-plabel { font-size: 10px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.4px; font-family: Arial, sans-serif; margin-bottom: 3px; }
    .mf-pval { font-size: 13px; color: #111827; font-family: Georgia, serif; }
    .mf-pinput { border: none; outline: none; font-size: 13px; color: #111827; background: transparent; font-family: Georgia, serif; width: 100%; border-bottom: 1px dotted #9ca3af; padding: 2px 0; }
    .mf-pinput:focus { border-bottom-color: #16a34a; }
    .mf-section { padding: 10px 20px; border-bottom: 1px solid #e9eaec; }
    .mf-section.mf-last { border-bottom: none; }
    .mf-section.mf-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0; padding: 0; }
    .mf-col { padding: 10px 20px; }
    .mf-col:first-child { border-right: 1px solid #e9eaec; }
    .mf-label { display: block; font-size: 12px; font-weight: 700; color: #374151; font-family: Arial, sans-serif; margin-bottom: 4px; }
    .mf-text { font-size: 14px; color: #111827; margin: 0; line-height: 1.9; font-family: Georgia, serif; white-space: pre-wrap; }
    .mf-textarea { width: 100%; border: none; outline: none; resize: none; background: transparent; font-family: Georgia, 'Times New Roman', serif; font-size: 14px; color: #111827; line-height: 1.9; background-image: repeating-linear-gradient(transparent, transparent calc(1.9em - 1px), #e5e7eb calc(1.9em - 1px), #e5e7eb 1.9em); padding: 0; margin-top: 2px; box-sizing: border-box; }
    .mf-textarea:focus { background-image: repeating-linear-gradient(transparent, transparent calc(1.9em - 1px), #a5b4fc calc(1.9em - 1px), #a5b4fc 1.9em); }
    /* Plantillas in mf */
    .mf-plantillas-row { display: flex; flex-direction: column; gap: 6px; }
    .mf-plantillas-body { display: flex; flex-direction: row; align-items: flex-end; gap: 14px; }
    .mf-feet { display: flex; gap: 12px; align-items: flex-end; }
    .mf-foot-item { display: flex; flex-direction: column; align-items: center; gap: 2px; }
    .foot-side { font-size: 10px; font-weight: 700; color: #9ca3af; letter-spacing: 1px; font-family: Arial, sans-serif; }
    .foot-path { fill: #d1d5db; stroke: #9ca3af; stroke-width: 1.5; transition: fill 0.35s, stroke 0.35s; }
    .foot-yes { fill: #818cf8; stroke: #15803d; }
    .plantilla-status { font-size: 13px; font-weight: 600; color: #9ca3af; font-family: Arial, sans-serif; }
    .plantilla-status.active { color: #16a34a; }
    .feet-hint { font-size: 11px; color: #d1d5db; font-family: Arial, sans-serif; }
    /* Maniobras table in mf */
    .mf-man-table { width: 100%; border-collapse: collapse; font-family: Arial, sans-serif; font-size: 12px; margin-top: 6px; }
    .mf-man-table thead th { background: #f3f4f6; font-weight: 700; color: #374151; padding: 5px 10px; border: 1px solid #e5e7eb; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.4px; }
    .mf-man-table td { border: 1px solid #e9eaec; padding: 3px 8px; vertical-align: middle; }
    .mf-man-section td { background: #eff6ff; font-weight: 700; font-size: 11px; color: #3b82f6; text-transform: uppercase; letter-spacing: 0.6px; padding: 4px 10px; }
    .mf-man-joint { width: 130px; color: #374151; font-size: 12px; }
    .mf-man-com { font-size: 13px; color: #374151; }
    .mf-man-input { border: none; outline: none; width: 100%; background: transparent; font-family: Georgia, serif; font-size: 13px; color: #111827; border-bottom: 1px dotted #9ca3af; padding: 1px 2px; }
    .mf-man-input:focus { border-bottom-color: #16a34a; }
    /* Attachments */
    .attachments-row { display: flex; flex-direction: column; gap: 8px; padding: 12px 16px; border-top: 1px solid #e5e7eb; }
    .att-label { display: block; font-size: 10px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; font-family: Arial, sans-serif; }
    .history-detail { padding: 16px; border-top: 1px solid #e5e7eb; animation: slideDown 0.15s ease; }
  `]
})
export class PatientClinicalHistoriesComponent implements OnInit {
  private api   = inject(ApiService);
  private route = inject(ActivatedRoute);

  patientId   = this.route.snapshot.params['patientId'];
  histories   = signal<any[]>([]);
  loading     = signal(true);
  expanded    = signal<string | null>(null);
  showModal   = signal(false);
  editingId   = signal<string | null>(null);
  saving      = signal(false);
  formError   = signal('');
  patientName = signal('');

  maniobra_sections = MANIOBRA_SECTIONS;
  form: ReturnType<typeof emptyForm> = emptyForm();

  ngOnInit() {
    this.api.getPatient(this.patientId).subscribe({
      next: (p: any) => this.patientName.set(`${p.apellido}, ${p.nombre}`)
    });
    this.load();
  }

  load() {
    this.loading.set(true);
    this.api.getClinicalHistories(this.patientId).subscribe({
      next: (data) => { this.histories.set(data); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  toggleExpand(id: string) {
    this.expanded.set(this.expanded() === id ? null : id);
  }

  openNew() {
    this.form = emptyForm();
    this.editingId.set(null);
    this.formError.set('');
    this.showModal.set(true);
  }

  openEdit(h: any) {
    this.form = {
      motivo_consulta: h.motivo_consulta || '',
      diagnostico: h.diagnostico || '',
      antecedentes_sintomas: h.antecedentes_sintomas || '',
      examen_fisico: h.examen_fisico || '',
      exploracion_estatica: h.exploracion_estatica || '',
      exploracion_dinamica: h.exploracion_dinamica || '',
      maniobras: { ...emptyManiobras(), ...(h.maniobras || {}) },
      plan_terapeutico: h.plan_terapeutico || '',
      estudios_complementarios: h.estudios_complementarios || '',
      laboratorio: h.laboratorio || '',
      medicacion: h.medicacion || '',
      observaciones: h.observaciones || '',
      plantillas: h.plantillas || false,
      descripcion_pedografia: h.descripcion_pedografia || '',
      signos_vitales: { tension_arterial: '', frecuencia_cardiaca: '', temperatura: '', peso: '', talla: '', saturacion: '', ...(h.signos_vitales || {}) },
      imagenes: (h.imagenes || []).map((i: any) => ({ url: i.url || '', nombre: i.nombre || '' })),
      estudios: (h.estudios || []).map((e: any) => ({ url: e.url || '', nombre: e.nombre || '' })),
    };
    this.editingId.set(h.id);
    this.formError.set('');
    this.showModal.set(true);
  }

  closeModal() { this.showModal.set(false); this.editingId.set(null); }

  save() {
    this.saving.set(true);
    this.formError.set('');
    const payload = { ...this.form, patient_id: this.patientId };
    const id = this.editingId();
    const req$ = id
      ? this.api.updateClinicalHistory(id, this.patientId, this.form)
      : this.api.saveClinicalHistory(payload);
    req$.subscribe({
      next: () => { this.saving.set(false); this.closeModal(); this.load(); },
      error: (err: any) => {
        this.formError.set(err.error?.detail || 'Error al guardar');
        this.saving.set(false);
      }
    });
  }

  deleteHistory(id: string) {
    if (!confirm('¿Eliminar esta historia clínica?')) return;
    this.api.deleteClinicalHistory(id, this.patientId).subscribe({
      next: () => this.histories.update(hs => hs.filter(h => h.id !== id))
    });
  }

  hasManiobras(h: any): boolean {
    if (!h.maniobras) return false;
    return ALL_JOINTS.some(j => h.maniobras[j]?.comentario);
  }

  sectionHasManiobras(h: any, joints: string[]): boolean {
    if (!h.maniobras) return false;
    return joints.some(j => h.maniobras[j]?.comentario);
  }

  printHistory(h: any) {
    const name = this.patientName();
    const date = this.formatDate(h.fecha?.seconds ? h.fecha.toDate() : h.fecha);
    const sv = h.signos_vitales;
    const signosLine = sv ? [
      sv.tension_arterial ? `TA: ${sv.tension_arterial}` : '',
      sv.frecuencia_cardiaca ? `FC: ${sv.frecuencia_cardiaca}` : '',
      sv.temperatura ? `Temp: ${sv.temperatura}` : '',
      sv.peso ? `Peso: ${sv.peso}` : '',
      sv.talla ? `Talla: ${sv.talla}` : '',
      sv.saturacion ? `SatO2: ${sv.saturacion}` : '',
    ].filter(Boolean).join(' · ') : '';
    const maniobrasRows = h.maniobras
      ? ALL_JOINTS.filter(j => h.maniobras[j]?.medicion || h.maniobras[j]?.comentario)
          .map(j => `<tr><td>${j}</td><td>${h.maniobras[j].medicion || ''}</td><td>${h.maniobras[j].comentario || ''}</td></tr>`)
          .join('')
      : '';
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>HC - ${name}</title>
      <style>body{font-family:Arial,sans-serif;max-width:800px;margin:32px auto;color:#111;font-size:13px}
      h1{font-size:20px;margin:0 0 2px}h2{font-size:13px;font-weight:700;color:#16a34a;margin:16px 0 4px;text-transform:uppercase}
      .sub{color:#666;font-size:12px;margin:0 0 16px}hr{border:none;border-top:1px solid #eee;margin:12px 0}
      p{margin:0 0 8px;line-height:1.5}
      table{width:100%;border-collapse:collapse;margin-bottom:8px}th{background:#f3f4f6;font-size:11px;text-align:left;padding:5px 8px}td{padding:5px 8px;border-top:1px solid #e5e7eb;font-size:12px}
      @media print{body{margin:16px}}</style></head>
      <body>
      <h1>${name}</h1>
      <div class="sub">Fecha de consulta: ${date}${h.professional_name ? ` · Prof: ${h.professional_name}` : ''}</div>
      <hr>
      ${h.motivo_consulta ? `<h2>Motivo de consulta</h2><p>${h.motivo_consulta}</p>` : ''}
      ${h.diagnostico ? `<h2>Diagnóstico</h2><p>${h.diagnostico}</p>` : ''}
      ${h.antecedentes_sintomas ? `<h2>Antecedentes y síntomas</h2><p>${h.antecedentes_sintomas}</p>` : ''}
      ${h.examen_fisico ? `<h2>Exploración física general</h2><p>${h.examen_fisico}</p>` : ''}
      ${h.exploracion_estatica ? `<h2>Exploración estática</h2><p>${h.exploracion_estatica}</p>` : ''}
      ${h.exploracion_dinamica ? `<h2>Inspección dinámica</h2><p>${h.exploracion_dinamica}</p>` : ''}
      ${maniobrasRows ? `<h2>Maniobras semiológicas</h2><table><thead><tr><th>Segmento</th><th>Medición</th><th>Comentario</th></tr></thead><tbody>${maniobrasRows}</tbody></table>` : ''}
      ${signosLine ? `<h2>Signos vitales</h2><p>${signosLine}</p>` : ''}
      ${h.plan_terapeutico ? `<h2>Plan terapéutico</h2><p>${h.plan_terapeutico}</p>` : ''}
      ${h.estudios_complementarios ? `<h2>Estudios complementarios</h2><p>${h.estudios_complementarios}</p>` : ''}
      ${h.laboratorio ? `<h2>Laboratorio</h2><p>${h.laboratorio}</p>` : ''}
      ${h.medicacion ? `<h2>Medicación</h2><p>${h.medicacion}</p>` : ''}
      ${h.observaciones ? `<h2>Observaciones</h2><p>${h.observaciones}</p>` : ''}
      <h2>Plantillas</h2><p>${h.plantillas ? 'Indicadas' : 'No indicadas'}${h.descripcion_pedografia ? ` — ${h.descripcion_pedografia}` : ''}</p>
      </body></html>`;
    const win = window.open('', '_blank');
    if (win) { win.document.open(); win.document.write(html); win.document.close(); win.print(); }
  }

  today(): string {
    return new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  formatDate(date: any): string {
    if (!date) return '—';
    try { return new Date(date).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch { return '—'; }
  }
}

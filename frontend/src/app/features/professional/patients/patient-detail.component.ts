import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-patient-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  template: `
    <div class="page">
      @if (loading()) {
        <div class="loading-state">Cargando...</div>
      } @else if (patient()) {
        <div class="page-header">
          <a routerLink="/professional/patients" class="btn-back">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
            Pacientes
          </a>
          <div class="header-info">
            <div class="patient-avatar-lg">{{ initials() }}</div>
            <div>
              <h1>{{ patient().apellido }}, {{ patient().nombre }}</h1>
              <p class="subtitle">DNI {{ patient().dni }} · {{ patient().sexo === 'M' ? 'Masculino' : patient().sexo === 'F' ? 'Femenino' : 'Otro' }}</p>
            </div>
          </div>
        </div>

        <!-- Acciones rápidas -->
        <div class="quick-actions">
          <a [routerLink]="['/professional/record', patientId]" class="action-card primary">
            <div class="action-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>
            </div>
            <div><h3>Nueva consulta</h3><p>Grabar y estructurar historia clínica</p></div>
          </a>
          <a [routerLink]="['/professional/patients', patientId, 'routines']" class="action-card">
            <div class="action-icon secondary">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            </div>
            <div><h3>Rutinas</h3><p>Gestionar planes asignados</p></div>
          </a>
          <a [routerLink]="['/professional/patients', patientId, 'evaluations']" class="action-card">
            <div class="action-icon green">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
            </div>
            <div><h3>Evaluaciones</h3><p>Testeos y mediciones</p></div>
          </a>
        </div>

        <!-- Datos del paciente -->
        <div class="section-card">
          <div class="section-header">
            <h2>Datos del paciente</h2>
            <div class="section-actions">
              <button class="btn-edit" (click)="editingPhone.set(!editingPhone()); editingEmail.set(false)">{{ editingPhone() ? 'Cancelar' : 'Editar teléfono' }}</button>
              <button class="btn-edit" (click)="editingEmail.set(!editingEmail()); editingPhone.set(false)">{{ editingEmail() ? 'Cancelar' : 'Editar email' }}</button>
              <button class="btn-danger" (click)="confirmDelete.set(true)">Eliminar paciente</button>
            </div>
          </div>
          <div class="data-grid">
            <div class="data-item"><span class="data-label">Fecha de nacimiento</span><span class="data-value">{{ patient().fecha_nacimiento || '—' }}</span></div>
            <div class="data-item">
              <span class="data-label">Teléfono</span>
              @if (editingPhone()) {
                <div class="phone-edit-row">
                  <input [(ngModel)]="newPhone" [placeholder]="patient().telefono || 'Ingresá el teléfono'" />
                  <button class="btn-save" (click)="savePhone()" [disabled]="savingPhone()">{{ savingPhone() ? '...' : 'Guardar' }}</button>
                </div>
              } @else {
                <span class="data-value">{{ patient().telefono || '—' }}</span>
              }
            </div>
            <div class="data-item">
              <span class="data-label">Email</span>
              @if (editingEmail()) {
                <div class="phone-edit-row">
                  <input [(ngModel)]="newEmail" [placeholder]="patient().email || 'Ingresá el email'" />
                  <button class="btn-save" (click)="saveEmail()" [disabled]="savingEmail()">{{ savingEmail() ? '...' : 'Guardar' }}</button>
                </div>
              } @else {
                <span class="data-value">{{ patient().email || '—' }}</span>
              }
            </div>
            <div class="data-item"><span class="data-label">Obra social</span><span class="data-value">{{ patient().obra_social || '—' }}</span></div>
            <div class="data-item"><span class="data-label">Nro. afiliado</span><span class="data-value">{{ patient().nro_afiliado || '—' }}</span></div>
          </div>
          @if (patient().diagnostico_inicial) {
            <div class="data-item full mt-12">
              <span class="data-label">Diagnóstico inicial</span>
              <p class="data-value">{{ patient().diagnostico_inicial }}</p>
            </div>
          }
        </div>

        <!-- Modal confirmar eliminación -->
        @if (confirmDelete()) {
          <div class="modal-overlay" (click)="confirmDelete.set(false)">
            <div class="modal" (click)="$event.stopPropagation()">
              <h3>¿Eliminar paciente?</h3>
              <p>Se borrarán todos sus datos, historias clínicas, evaluaciones y rutinas. Esta acción no se puede deshacer.</p>
              <div class="modal-actions">
                <button class="btn-secondary" (click)="confirmDelete.set(false)">Cancelar</button>
                <button class="btn-danger" (click)="deletePatient()" [disabled]="deleting()">{{ deleting() ? 'Eliminando...' : 'Sí, eliminar' }}</button>
              </div>
            </div>
          </div>
        }

        <!-- Modal editar historia -->
        @if (editingHistory()) {
          <div class="modal-overlay" (click)="editingHistory.set(null)">
            <div class="modal modal-lg" (click)="$event.stopPropagation()">
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
                    <div class="foot-item-sm">
                      <svg viewBox="0 0 80 140" width="32" height="56"><g transform="scale(-1,1) translate(-80,0)"><path [class.foot-yes]="editForm.plantillas" class="foot-path-sm" d="M 40 132 C 57 132 66 120 65 108 C 64 96 63 84 63 72 C 63 60 65 50 67 42 C 68 34 66 22 62 16 C 60 12 57 10 55 14 C 53 18 53 22 55 24 C 54 20 52 12 50 10 C 48 8 45 8 43 10 C 41 13 41 17 43 21 C 42 17 40 8 38 6 C 36 4 33 4 31 6 C 29 9 29 13 31 17 C 30 13 27 5 25 4 C 23 3 21 4 19 7 C 17 10 16 16 18 20 C 17 15 13 10 11 14 C 9 18 9 25 11 31 C 12 39 13 49 12 61 C 10 73 8 85 9 97 C 10 109 15 121 22 130 C 28 134 35 135 40 132 Z"/>@if(editForm.plantillas){<ellipse cx="40" cy="116" rx="16" ry="10" class="foot-zone-sm"/><ellipse cx="55" cy="34" rx="10" ry="7" class="foot-zone-sm"/><ellipse cx="24" cy="37" rx="12" ry="7" class="foot-zone-sm"/>}</g></svg>
                      <span class="foot-lbl">I</span>
                    </div>
                    <div class="foot-item-sm">
                      <svg viewBox="0 0 80 140" width="32" height="56"><path [class.foot-yes]="editForm.plantillas" class="foot-path-sm" d="M 40 132 C 57 132 66 120 65 108 C 64 96 63 84 63 72 C 63 60 65 50 67 42 C 68 34 66 22 62 16 C 60 12 57 10 55 14 C 53 18 53 22 55 24 C 54 20 52 12 50 10 C 48 8 45 8 43 10 C 41 13 41 17 43 21 C 42 17 40 8 38 6 C 36 4 33 4 31 6 C 29 9 29 13 31 17 C 30 13 27 5 25 4 C 23 3 21 4 19 7 C 17 10 16 16 18 20 C 17 15 13 10 11 14 C 9 18 9 25 11 31 C 12 39 13 49 12 61 C 10 73 8 85 9 97 C 10 109 15 121 22 130 C 28 134 35 135 40 132 Z"/>@if(editForm.plantillas){<ellipse cx="40" cy="116" rx="16" ry="10" class="foot-zone-sm"/><ellipse cx="24" cy="34" rx="10" ry="7" class="foot-zone-sm"/><ellipse cx="55" cy="37" rx="12" ry="7" class="foot-zone-sm"/>}</svg>
                      <span class="foot-lbl">D</span>
                    </div>
                    <span class="plantilla-tag" [class.yes]="editForm.plantillas">{{ editForm.plantillas ? 'Plantillas: Sí' : 'Plantillas: No' }}</span>
                  </div>
                </div>
                <div class="edit-field">
                  <label>Imágenes</label>
                  @for (img of editForm.imagenes; track $index) {
                    <div class="link-row">
                      <input [(ngModel)]="img.nombre" placeholder="Nombre (ej: RX rodilla)" class="link-name" />
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
                      <input [(ngModel)]="est.nombre" placeholder="Nombre (ej: Laboratorio)" class="link-name" />
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

        <!-- Modal nueva historia manual -->
        @if (showNewHistory()) {
          <div class="modal-overlay" (click)="showNewHistory.set(false)">
            <div class="modal modal-lg" (click)="$event.stopPropagation()">
              <h3>Nueva historia clínica</h3>
              <div class="edit-fields">
                <div class="edit-field"><label>Motivo de consulta</label><textarea [(ngModel)]="newHistoryForm.motivo_consulta" rows="2" placeholder="Ej: Dolor lumbar de 3 días de evolución"></textarea></div>
                <div class="edit-field"><label>Diagnóstico</label><textarea [(ngModel)]="newHistoryForm.diagnostico" rows="2" placeholder="Ej: Lumbalgia mecánica aguda"></textarea></div>
                <div class="edit-field"><label>Antecedentes y síntomas</label><textarea [(ngModel)]="newHistoryForm.antecedentes_sintomas" rows="4"></textarea></div>
                <div class="edit-field"><label>Exploración física</label><textarea [(ngModel)]="newHistoryForm.examen_fisico" rows="3"></textarea></div>
                <div class="edit-field"><label>Indicaciones / Plan terapéutico</label><textarea [(ngModel)]="newHistoryForm.plan_terapeutico" rows="3"></textarea></div>
                <div class="edit-field"><label>Estudios complementarios</label><textarea [(ngModel)]="newHistoryForm.estudios_complementarios" rows="2"></textarea></div>
                <div class="edit-field"><label>Laboratorio</label><textarea [(ngModel)]="newHistoryForm.laboratorio" rows="2"></textarea></div>
                <div class="edit-field"><label>Medicación</label><textarea [(ngModel)]="newHistoryForm.medicacion" rows="2"></textarea></div>
                <div class="edit-field"><label>Comentarios</label><textarea [(ngModel)]="newHistoryForm.observaciones" rows="2"></textarea></div>
                <div class="edit-field">
                  <label>Plantillas</label>
                  <div class="plantilla-toggle" (click)="newHistoryForm.plantillas = !newHistoryForm.plantillas">
                    <div class="foot-item-sm">
                      <svg viewBox="0 0 80 140" width="32" height="56"><g transform="scale(-1,1) translate(-80,0)"><path [class.foot-yes]="newHistoryForm.plantillas" class="foot-path-sm" d="M 40 132 C 57 132 66 120 65 108 C 64 96 63 84 63 72 C 63 60 65 50 67 42 C 68 34 66 22 62 16 C 60 12 57 10 55 14 C 53 18 53 22 55 24 C 54 20 52 12 50 10 C 48 8 45 8 43 10 C 41 13 41 17 43 21 C 42 17 40 8 38 6 C 36 4 33 4 31 6 C 29 9 29 13 31 17 C 30 13 27 5 25 4 C 23 3 21 4 19 7 C 17 10 16 16 18 20 C 17 15 13 10 11 14 C 9 18 9 25 11 31 C 12 39 13 49 12 61 C 10 73 8 85 9 97 C 10 109 15 121 22 130 C 28 134 35 135 40 132 Z"/>@if(newHistoryForm.plantillas){<ellipse cx="40" cy="116" rx="16" ry="10" class="foot-zone-sm"/><ellipse cx="55" cy="34" rx="10" ry="7" class="foot-zone-sm"/><ellipse cx="24" cy="37" rx="12" ry="7" class="foot-zone-sm"/>}</g></svg>
                      <span class="foot-lbl">I</span>
                    </div>
                    <div class="foot-item-sm">
                      <svg viewBox="0 0 80 140" width="32" height="56"><path [class.foot-yes]="newHistoryForm.plantillas" class="foot-path-sm" d="M 40 132 C 57 132 66 120 65 108 C 64 96 63 84 63 72 C 63 60 65 50 67 42 C 68 34 66 22 62 16 C 60 12 57 10 55 14 C 53 18 53 22 55 24 C 54 20 52 12 50 10 C 48 8 45 8 43 10 C 41 13 41 17 43 21 C 42 17 40 8 38 6 C 36 4 33 4 31 6 C 29 9 29 13 31 17 C 30 13 27 5 25 4 C 23 3 21 4 19 7 C 17 10 16 16 18 20 C 17 15 13 10 11 14 C 9 18 9 25 11 31 C 12 39 13 49 12 61 C 10 73 8 85 9 97 C 10 109 15 121 22 130 C 28 134 35 135 40 132 Z"/>@if(newHistoryForm.plantillas){<ellipse cx="40" cy="116" rx="16" ry="10" class="foot-zone-sm"/><ellipse cx="24" cy="34" rx="10" ry="7" class="foot-zone-sm"/><ellipse cx="55" cy="37" rx="12" ry="7" class="foot-zone-sm"/>}</svg>
                      <span class="foot-lbl">D</span>
                    </div>
                    <span class="plantilla-tag" [class.yes]="newHistoryForm.plantillas">{{ newHistoryForm.plantillas ? 'Plantillas: Sí' : 'Plantillas: No' }}</span>
                  </div>
                </div>
                <div class="edit-field">
                  <label>Signos vitales (opcional)</label>
                  <div class="signos-inputs">
                    <input [(ngModel)]="newHistoryForm.signos_vitales.tension_arterial" placeholder="TA (ej: 120/80)" />
                    <input [(ngModel)]="newHistoryForm.signos_vitales.frecuencia_cardiaca" placeholder="FC (ej: 72)" />
                    <input [(ngModel)]="newHistoryForm.signos_vitales.temperatura" placeholder="Temp (ej: 36.5)" />
                    <input [(ngModel)]="newHistoryForm.signos_vitales.peso" placeholder="Peso (ej: 70kg)" />
                    <input [(ngModel)]="newHistoryForm.signos_vitales.saturacion" placeholder="SatO2 (ej: 98%)" />
                  </div>
                </div>
              </div>
              @if (newHistoryError()) { <div class="error-banner">{{ newHistoryError() }}</div> }
              <div class="modal-actions">
                <button class="btn-secondary" (click)="showNewHistory.set(false)">Cancelar</button>
                <button class="btn-save" (click)="saveNewHistory()" [disabled]="savingNew()">{{ savingNew() ? 'Guardando...' : 'Guardar historia' }}</button>
              </div>
            </div>
          </div>
        }

        <!-- Historias clínicas -->
        <div class="section-card">
          <div class="section-header">
            <h2>Historias clínicas</h2>
            <button class="btn-edit" (click)="openNewHistory()">+ Nueva historia</button>
          </div>
          @if (histories().length === 0) {
            <div class="empty-small">No hay historias clínicas registradas aún</div>
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
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                      </button>
                      <button class="btn-icon-sm" (click)="downloadHistory(h)" title="Descargar PDF">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                      </button>
                      <button class="btn-icon-sm" (click)="openEdit(h)" title="Editar">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button class="btn-icon-sm danger" (click)="deleteHistory(h.id)" title="Eliminar">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                      </button>
                      <svg class="chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                    </div>
                  </div>

                  @if (expanded() === h.id) {
                    <div class="history-detail">
                      @if (h.antecedentes_sintomas) {
                        <div class="detail-section"><label>Antecedentes y síntomas</label><p>{{ h.antecedentes_sintomas }}</p></div>
                      }
                      @if (h.examen_fisico) {
                        <div class="detail-section"><label>Exploración física</label><p>{{ h.examen_fisico }}</p></div>
                      }
                      @if (h.signos_vitales) {
                        <div class="detail-section">
                          <label>Signos vitales</label>
                          <div class="signos-row">
                            @if (h.signos_vitales.tension_arterial) { <span class="signo-tag">TA: {{ h.signos_vitales.tension_arterial }}</span> }
                            @if (h.signos_vitales.frecuencia_cardiaca) { <span class="signo-tag">FC: {{ h.signos_vitales.frecuencia_cardiaca }}</span> }
                            @if (h.signos_vitales.temperatura) { <span class="signo-tag">Temp: {{ h.signos_vitales.temperatura }}</span> }
                            @if (h.signos_vitales.peso) { <span class="signo-tag">Peso: {{ h.signos_vitales.peso }}</span> }
                            @if (h.signos_vitales.saturacion) { <span class="signo-tag">SatO2: {{ h.signos_vitales.saturacion }}</span> }
                          </div>
                        </div>
                      }
                      @if (h.plan_terapeutico) {
                        <div class="detail-section"><label>Indicaciones / Plan terapéutico</label><p>{{ h.plan_terapeutico }}</p></div>
                      }
                      @if (h.estudios_complementarios) {
                        <div class="detail-section"><label>Estudios complementarios</label><p>{{ h.estudios_complementarios }}</p></div>
                      }
                      @if (h.laboratorio) {
                        <div class="detail-section"><label>Laboratorio</label><p>{{ h.laboratorio }}</p></div>
                      }
                      @if (h.medicacion) {
                        <div class="detail-section"><label>Medicación</label><p>{{ h.medicacion }}</p></div>
                      }
                      @if (h.observaciones) {
                        <div class="detail-section"><label>Comentarios</label><p>{{ h.observaciones }}</p></div>
                      }
                      <!-- Plantillas -->
                      <div class="detail-section">
                        <label>Plantillas</label>
                        <div class="feet-display">
                          <div class="foot-item-sm">
                            <svg viewBox="0 0 80 140" width="44" height="77"><g transform="scale(-1,1) translate(-80,0)"><path [class.foot-yes]="h.plantillas" class="foot-path-sm" d="M 40 132 C 57 132 66 120 65 108 C 64 96 63 84 63 72 C 63 60 65 50 67 42 C 68 34 66 22 62 16 C 60 12 57 10 55 14 C 53 18 53 22 55 24 C 54 20 52 12 50 10 C 48 8 45 8 43 10 C 41 13 41 17 43 21 C 42 17 40 8 38 6 C 36 4 33 4 31 6 C 29 9 29 13 31 17 C 30 13 27 5 25 4 C 23 3 21 4 19 7 C 17 10 16 16 18 20 C 17 15 13 10 11 14 C 9 18 9 25 11 31 C 12 39 13 49 12 61 C 10 73 8 85 9 97 C 10 109 15 121 22 130 C 28 134 35 135 40 132 Z"/>@if(h.plantillas){<ellipse cx="40" cy="116" rx="16" ry="10" class="foot-zone-sm"/><ellipse cx="55" cy="34" rx="10" ry="7" class="foot-zone-sm"/><ellipse cx="24" cy="37" rx="12" ry="7" class="foot-zone-sm"/>}</g></svg>
                            <span class="foot-lbl">I</span>
                          </div>
                          <div class="foot-item-sm">
                            <svg viewBox="0 0 80 140" width="44" height="77"><path [class.foot-yes]="h.plantillas" class="foot-path-sm" d="M 40 132 C 57 132 66 120 65 108 C 64 96 63 84 63 72 C 63 60 65 50 67 42 C 68 34 66 22 62 16 C 60 12 57 10 55 14 C 53 18 53 22 55 24 C 54 20 52 12 50 10 C 48 8 45 8 43 10 C 41 13 41 17 43 21 C 42 17 40 8 38 6 C 36 4 33 4 31 6 C 29 9 29 13 31 17 C 30 13 27 5 25 4 C 23 3 21 4 19 7 C 17 10 16 16 18 20 C 17 15 13 10 11 14 C 9 18 9 25 11 31 C 12 39 13 49 12 61 C 10 73 8 85 9 97 C 10 109 15 121 22 130 C 28 134 35 135 40 132 Z"/>@if(h.plantillas){<ellipse cx="40" cy="116" rx="16" ry="10" class="foot-zone-sm"/><ellipse cx="24" cy="34" rx="10" ry="7" class="foot-zone-sm"/><ellipse cx="55" cy="37" rx="12" ry="7" class="foot-zone-sm"/>}</svg>
                            <span class="foot-lbl">D</span>
                          </div>
                          <span class="plantilla-tag" [class.yes]="h.plantillas">{{ h.plantillas ? 'Plantillas: Sí' : 'Plantillas: No' }}</span>
                        </div>
                      </div>
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
      }
    </div>
  `,
  styles: [`
    .page { max-width: 900px; }
    .loading-state { padding: 40px; text-align: center; color: #9ca3af; }
    .page-header { margin-bottom: 28px; }
    .btn-back { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; background: white; border: 1px solid #e5e7eb; border-radius: 8px; cursor: pointer; font-size: 14px; color: #374151; text-decoration: none; margin-bottom: 20px; }
    .header-info { display: flex; align-items: center; gap: 16px; }
    .patient-avatar-lg { width: 56px; height: 56px; background: #eef2ff; color: #4f46e5; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 20px; flex-shrink: 0; }
    h1 { font-size: 22px; font-weight: 700; color: #111827; margin: 0 0 4px; }
    .subtitle { color: #6b7280; font-size: 14px; margin: 0; }

    .quick-actions { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 20px; }
    .action-card { display: flex; align-items: center; gap: 12px; padding: 16px; background: white; border-radius: 14px; text-decoration: none; box-shadow: 0 1px 4px rgba(0,0,0,0.05); border: 1.5px solid #e5e7eb; transition: all 0.15s; }
    .action-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.1); border-color: #4f46e5; }
    .action-card.primary { background: #4f46e5; color: white; border-color: transparent; }
    .action-card.primary h3, .action-card.primary p { color: white; }
    .action-icon { width: 40px; height: 40px; background: rgba(255,255,255,0.2); border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .action-icon.secondary { background: #eef2ff; color: #4f46e5; }
    .action-icon.green { background: #f0fdf4; color: #16a34a; }
    .action-card h3 { font-size: 13px; font-weight: 600; color: #111827; margin: 0 0 2px; }
    .action-card p { font-size: 11px; color: #6b7280; margin: 0; }

    .section-card { background: white; border-radius: 16px; padding: 24px; box-shadow: 0 1px 4px rgba(0,0,0,0.05); margin-bottom: 16px; }
    .section-card h2 { font-size: 16px; font-weight: 700; color: #111827; margin: 0 0 16px; }
    .data-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
    .data-item { display: flex; flex-direction: column; gap: 4px; }
    .data-item.full { grid-column: 1/-1; }
    .mt-12 { margin-top: 12px; }
    .data-label { font-size: 12px; color: #9ca3af; font-weight: 500; }
    .data-value { font-size: 14px; color: #111827; }

    .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
    .section-header h2 { margin: 0; }
    .section-actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .btn-edit { padding: 6px 12px; background: #f3f4f6; border: none; border-radius: 8px; font-size: 13px; font-weight: 500; color: #374151; cursor: pointer; }
    .btn-edit:hover { background: #e5e7eb; }
    .btn-danger { padding: 6px 12px; background: #fef2f2; border: none; border-radius: 8px; font-size: 13px; font-weight: 500; color: #dc2626; cursor: pointer; }
    .btn-danger:hover { background: #fee2e2; }
    .btn-danger:disabled { opacity: 0.6; cursor: not-allowed; }
    .phone-edit-row { display: flex; gap: 8px; align-items: center; }
    .phone-edit-row input { padding: 6px 10px; border: 1.5px solid #e5e7eb; border-radius: 8px; font-size: 14px; outline: none; font-family: inherit; flex: 1; }
    .phone-edit-row input:focus { border-color: #4f46e5; }
    .btn-save { padding: 6px 12px; background: #4f46e5; color: white; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap; }
    .btn-save:disabled { opacity: 0.6; cursor: not-allowed; }

    /* Histories */
    .history-list { display: flex; flex-direction: column; gap: 8px; }
    .history-card { background: #f9fafb; border-radius: 12px; border: 1.5px solid #e5e7eb; overflow: hidden; transition: border-color 0.15s; }
    .history-card.expanded { border-color: #4f46e5; }
    .history-summary { display: flex; align-items: flex-start; justify-content: space-between; padding: 14px 16px; cursor: pointer; gap: 10px; }
    .history-summary:hover { background: #f3f4f6; }
    .history-left { flex: 1; }
    .history-date { font-size: 11px; color: #9ca3af; display: block; margin-bottom: 2px; }
    .history-motivo { font-size: 14px; color: #374151; margin: 0 0 2px; font-weight: 500; }
    .history-dx { font-size: 13px; color: #6b7280; margin: 0 0 2px; }
    .history-prof { font-size: 11px; color: #4f46e5; margin: 0; font-weight: 600; }
    .history-actions { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
    .btn-icon-sm { width: 28px; height: 28px; background: white; border: 1px solid #e5e7eb; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #6b7280; transition: all 0.15s; }
    .btn-icon-sm:hover { border-color: #4f46e5; color: #4f46e5; }
    .btn-icon-sm.danger:hover { border-color: #dc2626; color: #dc2626; }
    .chevron { color: #9ca3af; transition: transform 0.2s; margin-left: 4px; flex-shrink: 0; }
    .history-card.expanded .chevron { transform: rotate(180deg); }

    .history-detail { padding: 0 16px 16px; border-top: 1px solid #e5e7eb; display: flex; flex-direction: column; gap: 12px; padding-top: 14px; animation: slideDown 0.15s ease; }
    @keyframes slideDown { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
    .detail-section label { display: block; font-size: 11px; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .detail-section p { font-size: 14px; color: #374151; margin: 0; line-height: 1.6; }
    .signos-row { display: flex; flex-wrap: wrap; gap: 6px; }
    .signo-tag { background: white; border: 1px solid #e5e7eb; color: #374151; padding: 3px 8px; border-radius: 6px; font-size: 12px; }
    .history-img { max-width: 100%; max-height: 300px; border-radius: 8px; border: 1px solid #e5e7eb; margin-top: 4px; }
    .estudio-link { display: inline-flex; align-items: center; gap: 6px; color: #4f46e5; font-size: 13px; text-decoration: none; font-weight: 500; }
    .estudio-link:hover { text-decoration: underline; }
    .archivos-list { display: flex; flex-direction: column; gap: 6px; }
    .link-row { display: flex; gap: 8px; align-items: center; margin-bottom: 6px; }
    .link-name { flex: 1; min-width: 0; }
    .link-url { flex: 2; min-width: 0; }
    .btn-rm { padding: 4px 8px; background: #fef2f2; color: #dc2626; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; flex-shrink: 0; }
    .btn-add-link { padding: 5px 12px; background: #eef2ff; color: #4f46e5; border: none; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; margin-top: 2px; }
    .empty-small { font-size: 14px; color: #9ca3af; padding: 20px 0; text-align: center; }
    .signos-inputs { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; }
    .signos-inputs input { padding: 7px 10px; border: 1.5px solid #e5e7eb; border-radius: 8px; font-size: 13px; outline: none; }
    .signos-inputs input:focus { border-color: #4f46e5; }

    /* Modals */
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 16px; }
    .modal { background: white; border-radius: 16px; padding: 28px; max-width: 400px; width: 100%; box-shadow: 0 20px 60px rgba(0,0,0,0.2); }
    .modal-lg { max-width: 700px; max-height: 90vh; overflow-y: auto; }
    .modal h3 { font-size: 18px; font-weight: 700; color: #111827; margin: 0 0 10px; }
    .modal p { font-size: 14px; color: #6b7280; margin: 0 0 20px; line-height: 1.6; }
    .modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px; }
    .btn-secondary { padding: 8px 16px; background: #f3f4f6; border: none; border-radius: 8px; font-size: 14px; cursor: pointer; color: #374151; }

    .edit-fields { display: flex; flex-direction: column; gap: 12px; }
    .edit-field { display: flex; flex-direction: column; gap: 4px; }
    .edit-field label { font-size: 12px; font-weight: 600; color: #6b7280; }
    .edit-field input, .edit-field textarea { padding: 8px 10px; border: 1.5px solid #e5e7eb; border-radius: 8px; font-size: 14px; outline: none; font-family: inherit; resize: vertical; }
    .edit-field input:focus, .edit-field textarea:focus { border-color: #4f46e5; }
    .edit-field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .error-banner { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 8px; padding: 10px 14px; font-size: 13px; margin-top: 10px; }

    /* Plantillas / Foot diagram */
    .feet-display { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .foot-item-sm { display: flex; flex-direction: column; align-items: center; gap: 2px; }
    .foot-path-sm { fill: #e5e7eb; stroke: #9ca3af; stroke-width: 1; transition: fill 0.2s, stroke 0.2s; }
    .foot-path-sm.foot-yes { fill: #a5b4fc; stroke: #4f46e5; }
    .foot-zone-sm { fill: rgba(79,70,229,0.4); }
    .foot-lbl { font-size: 10px; color: #9ca3af; font-weight: 600; letter-spacing: 0.5px; }
    .plantilla-tag { padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; background: #f3f4f6; color: #9ca3af; }
    .plantilla-tag.yes { background: #eef2ff; color: #4f46e5; }
    .plantilla-toggle { display: flex; align-items: center; gap: 12px; cursor: pointer; padding: 8px; border-radius: 8px; border: 1.5px dashed #e5e7eb; transition: background 0.15s; user-select: none; }
    .plantilla-toggle:hover { background: #f9fafb; border-color: #c7d2fe; }

    @media (max-width: 768px) {
      .quick-actions { grid-template-columns: 1fr 1fr; }
      .data-grid { grid-template-columns: 1fr 1fr; }
      .section-header { flex-direction: column; align-items: flex-start; gap: 10px; }
      .edit-field-row { grid-template-columns: 1fr; }
    }
    @media (max-width: 480px) {
      .quick-actions { grid-template-columns: 1fr; }
      .data-grid { grid-template-columns: 1fr; }
    }
  `]
})
export class PatientDetailComponent implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  patientId = this.route.snapshot.params['id'];
  patient = signal<any>(null);
  histories = signal<any[]>([]);
  loading = signal(true);
  editingPhone = signal(false);
  savingPhone = signal(false);
  editingEmail = signal(false);
  savingEmail = signal(false);
  confirmDelete = signal(false);
  deleting = signal(false);
  expanded = signal<string | null>(null);
  editingHistory = signal<string | null>(null);
  saving = signal(false);
  editError = signal('');
  newPhone = '';
  newEmail = '';

  editForm: any = {};

  showNewHistory = signal(false);
  savingNew = signal(false);
  newHistoryError = signal('');
  newHistoryForm: any = this.emptyHistoryForm();

  emptyHistoryForm() {
    return {
      motivo_consulta: '', diagnostico: '', antecedentes_sintomas: '',
      examen_fisico: '', plan_terapeutico: '', estudios_complementarios: '',
      laboratorio: '', medicacion: '', observaciones: '', plantillas: false,
      signos_vitales: { tension_arterial: '', frecuencia_cardiaca: '', temperatura: '', peso: '', talla: '', saturacion: '' }
    };
  }

  openNewHistory() {
    this.newHistoryForm = this.emptyHistoryForm();
    this.newHistoryError.set('');
    this.showNewHistory.set(true);
  }

  saveNewHistory() {
    this.savingNew.set(true);
    this.newHistoryError.set('');
    const payload = { ...this.newHistoryForm, patient_id: this.patientId };
    this.api.saveClinicalHistory(payload).subscribe({
      next: () => {
        this.showNewHistory.set(false);
        this.savingNew.set(false);
        this.api.getClinicalHistories(this.patientId).subscribe({ next: (data: any[]) => this.histories.set(data) });
      },
      error: (err: any) => {
        this.newHistoryError.set(err.error?.detail || 'Error al guardar');
        this.savingNew.set(false);
      }
    });
  }

  ngOnInit() {
    this.api.getPatient(this.patientId).subscribe({
      next: (data) => { this.patient.set(data); this.loading.set(false); }
    });
    this.api.getClinicalHistories(this.patientId).subscribe({
      next: (data) => this.histories.set(data)
    });
  }

  toggleExpand(id: string) {
    this.expanded.set(this.expanded() === id ? null : id);
  }

  openEdit(h: any) {
    this.editingHistory.set(h.id);
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
      estudios: (h.estudios || []).map((e: any) => ({ url: e.url || '', nombre: e.nombre || '' })),
    };
  }

  saveEdit() {
    const id = this.editingHistory();
    if (!id) return;
    this.saving.set(true);
    this.editError.set('');
    // Remove empty strings so PATCH doesn't wipe fields
    const payload: any = {};
    for (const [k, v] of Object.entries(this.editForm)) {
      if (v !== '') payload[k] = v;
    }
    this.api.updateClinicalHistory(id, this.patientId, payload).subscribe({
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

  printHistory(h: any) {
    const patient = this.patient();
    const date = this.formatDate(h.fecha?.seconds ? h.fecha.toDate() : h.fecha);
    const sv = h.signos_vitales;
    const signosHtml = sv ? `
      <p><b>Signos vitales:</b>
        ${sv.tension_arterial ? `TA: ${sv.tension_arterial}` : ''}
        ${sv.frecuencia_cardiaca ? ` · FC: ${sv.frecuencia_cardiaca}` : ''}
        ${sv.temperatura ? ` · Temp: ${sv.temperatura}` : ''}
        ${sv.peso ? ` · Peso: ${sv.peso}` : ''}
        ${sv.saturacion ? ` · SatO2: ${sv.saturacion}` : ''}
      </p>` : '';
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Historia clínica - ${patient?.nombre} ${patient?.apellido}</title>
      <style>body{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;color:#111}h1{font-size:22px;margin-bottom:4px}
      .sub{color:#666;font-size:14px;margin-bottom:24px}.section{margin-bottom:16px}.section label{font-size:11px;font-weight:700;color:#666;text-transform:uppercase;display:block;margin-bottom:4px}
      .section p{margin:0;line-height:1.6;font-size:14px}hr{border:none;border-top:1px solid #eee;margin:16px 0}
      @media print{body{margin:20px}}</style></head>
      <body>
      <h1>${patient?.apellido}, ${patient?.nombre}</h1>
      <div class="sub">DNI: ${patient?.dni} · Fecha de consulta: ${date}${h.professional_name ? ` · Prof: ${h.professional_name}` : ''}</div>
      <hr>
      ${h.motivo_consulta ? `<div class="section"><label>Motivo de consulta</label><p>${h.motivo_consulta}</p></div>` : ''}
      ${h.diagnostico ? `<div class="section"><label>Diagnóstico</label><p>${h.diagnostico}</p></div>` : ''}
      ${h.antecedentes_sintomas ? `<div class="section"><label>Antecedentes y síntomas</label><p>${h.antecedentes_sintomas}</p></div>` : ''}
      ${h.examen_fisico ? `<div class="section"><label>Exploración física</label><p>${h.examen_fisico}</p></div>` : ''}
      ${signosHtml}
      ${h.plan_terapeutico ? `<div class="section"><label>Indicaciones / Plan terapéutico</label><p>${h.plan_terapeutico}</p></div>` : ''}
      ${h.estudios_complementarios ? `<div class="section"><label>Estudios complementarios</label><p>${h.estudios_complementarios}</p></div>` : ''}
      ${h.laboratorio ? `<div class="section"><label>Laboratorio</label><p>${h.laboratorio}</p></div>` : ''}
      ${h.medicacion ? `<div class="section"><label>Medicación</label><p>${h.medicacion}</p></div>` : ''}
      ${h.observaciones ? `<div class="section"><label>Comentarios</label><p>${h.observaciones}</p></div>` : ''}
      <div class="section"><label>Plantillas</label><p>${h.plantillas ? 'Sí' : 'No'}</p></div>
      ${h.estudio_url ? `<div class="section"><label>Estudio adjunto</label><p><a href="${h.estudio_url}">${h.estudio_nombre || h.estudio_url}</a></p></div>` : ''}
      </body></html>`;
    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); win.print(); }
  }

  downloadHistory(h: any) {
    const patient = this.patient();
    const date = this.formatDate(h.fecha?.seconds ? h.fecha.toDate() : h.fecha);
    const sv = h.signos_vitales;
    const signosHtml = sv ? `
      <p><b>Signos vitales:</b>
        ${sv.tension_arterial ? `TA: ${sv.tension_arterial}` : ''}
        ${sv.frecuencia_cardiaca ? ` · FC: ${sv.frecuencia_cardiaca}` : ''}
        ${sv.temperatura ? ` · Temp: ${sv.temperatura}` : ''}
        ${sv.peso ? ` · Peso: ${sv.peso}` : ''}
        ${sv.saturacion ? ` · SatO2: ${sv.saturacion}` : ''}
      </p>` : '';
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Historia clínica - ${patient?.nombre} ${patient?.apellido}</title>
      <style>body{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;color:#111}h1{font-size:22px;margin-bottom:4px}
      .sub{color:#666;font-size:14px;margin-bottom:24px}.section{margin-bottom:16px}.section label{font-size:11px;font-weight:700;color:#666;text-transform:uppercase;display:block;margin-bottom:4px}
      .section p{margin:0;line-height:1.6;font-size:14px}hr{border:none;border-top:1px solid #eee;margin:16px 0}</style></head>
      <body>
      <h1>${patient?.apellido}, ${patient?.nombre}</h1>
      <div class="sub">DNI: ${patient?.dni} · Fecha de consulta: ${date}${h.professional_name ? ` · Prof: ${h.professional_name}` : ''}</div>
      <hr>
      ${h.motivo_consulta ? `<div class="section"><label>Motivo de consulta</label><p>${h.motivo_consulta}</p></div>` : ''}
      ${h.diagnostico ? `<div class="section"><label>Diagnóstico</label><p>${h.diagnostico}</p></div>` : ''}
      ${h.antecedentes_sintomas ? `<div class="section"><label>Antecedentes y síntomas</label><p>${h.antecedentes_sintomas}</p></div>` : ''}
      ${h.examen_fisico ? `<div class="section"><label>Exploración física</label><p>${h.examen_fisico}</p></div>` : ''}
      ${signosHtml}
      ${h.plan_terapeutico ? `<div class="section"><label>Indicaciones / Plan terapéutico</label><p>${h.plan_terapeutico}</p></div>` : ''}
      ${h.estudios_complementarios ? `<div class="section"><label>Estudios complementarios</label><p>${h.estudios_complementarios}</p></div>` : ''}
      ${h.laboratorio ? `<div class="section"><label>Laboratorio</label><p>${h.laboratorio}</p></div>` : ''}
      ${h.medicacion ? `<div class="section"><label>Medicación</label><p>${h.medicacion}</p></div>` : ''}
      ${h.observaciones ? `<div class="section"><label>Comentarios</label><p>${h.observaciones}</p></div>` : ''}
      <div class="section"><label>Plantillas</label><p>${h.plantillas ? 'Sí' : 'No'}</p></div>
      </body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `HC_${patient?.apellido}_${patient?.nombre}_${date}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  savePhone() {
    if (!this.newPhone.trim()) return;
    this.savingPhone.set(true);
    this.api.updatePatientPhone(this.patientId, this.newPhone.trim()).subscribe({
      next: () => {
        this.patient.update(p => ({ ...p, telefono: this.newPhone.trim() }));
        this.editingPhone.set(false);
        this.savingPhone.set(false);
        this.newPhone = '';
      },
      error: () => this.savingPhone.set(false)
    });
  }

  saveEmail() {
    if (!this.newEmail.trim()) return;
    this.savingEmail.set(true);
    this.api.updatePatientEmail(this.patientId, this.newEmail.trim()).subscribe({
      next: () => {
        this.patient.update(p => ({ ...p, email: this.newEmail.trim() }));
        this.editingEmail.set(false);
        this.savingEmail.set(false);
        this.newEmail = '';
      },
      error: () => this.savingEmail.set(false)
    });
  }

  deleteHistory(historyId: string) {
    if (!confirm('¿Eliminar esta historia clínica?')) return;
    this.api.deleteClinicalHistory(historyId, this.patientId).subscribe({
      next: () => this.histories.update(hs => hs.filter(h => h.id !== historyId))
    });
  }

  deletePatient() {
    this.deleting.set(true);
    this.api.deletePatient(this.patientId).subscribe({
      next: () => this.router.navigate(['/professional/patients']),
      error: () => this.deleting.set(false)
    });
  }

  initials(): string {
    const p = this.patient();
    return p ? `${p.nombre[0]}${p.apellido[0]}`.toUpperCase() : '';
  }

  formatDate(date: any): string {
    if (!date) return '—';
    try {
      return new Date(date).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return '—'; }
  }
}

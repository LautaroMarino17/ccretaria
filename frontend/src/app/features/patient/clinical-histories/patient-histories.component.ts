import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-patient-histories',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page">
      <div class="page-header">
        <h1>Mis historias clínicas</h1>
        <p class="subtitle">Historial completo de tus consultas</p>
      </div>

      @if (loading()) {
        <div class="loading-text">Cargando...</div>
      } @else if (histories().length === 0) {
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" stroke-width="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          <p>No hay historias clínicas disponibles aún</p>
        </div>
      } @else {
        <div class="history-list">
          @for (h of histories(); track h.id) {
            <div class="history-card" (click)="toggle(h.id)" [class.expanded]="expanded() === h.id">
              <div class="history-summary">
                <div>
                  <span class="history-date">{{ formatDate(h.fecha?.seconds ? h.fecha.toDate() : h.fecha) }}
                    @if (h.professional_name) {
                      <span class="prof-tag">{{ h.professional_name }}</span>
                    }
                  </span>
                  <h3>{{ h.motivo_consulta || 'Consulta sin título' }}</h3>
                  @if (h.diagnostico) {
                    <p class="history-dx">Diagnóstico: {{ h.diagnostico }}</p>
                  }
                </div>
                <svg class="chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </div>

              @if (expanded() === h.id) {
                <div class="history-detail">
                  @if (h.antecedentes_sintomas) {
                    <div class="detail-section">
                      <label>Antecedentes y síntomas</label>
                      <p>{{ h.antecedentes_sintomas }}</p>
                    </div>
                  }
                  @if (h.examen_fisico) {
                    <div class="detail-section">
                      <label>Exploración física</label>
                      <p>{{ h.examen_fisico }}</p>
                    </div>
                  }
                  @if (h.signos_vitales) {
                    <div class="detail-section">
                      <label>Signos vitales</label>
                      <div class="signos-row">
                        @if (h.signos_vitales.tension_arterial) {
                          <span class="signo-tag">TA: {{ h.signos_vitales.tension_arterial }}</span>
                        }
                        @if (h.signos_vitales.frecuencia_cardiaca) {
                          <span class="signo-tag">FC: {{ h.signos_vitales.frecuencia_cardiaca }}</span>
                        }
                        @if (h.signos_vitales.temperatura) {
                          <span class="signo-tag">Temp: {{ h.signos_vitales.temperatura }}</span>
                        }
                        @if (h.signos_vitales.peso) {
                          <span class="signo-tag">Peso: {{ h.signos_vitales.peso }}</span>
                        }
                        @if (h.signos_vitales.saturacion) {
                          <span class="signo-tag">SatO2: {{ h.signos_vitales.saturacion }}</span>
                        }
                      </div>
                    </div>
                  }
                  @if (h.plan_terapeutico) {
                    <div class="detail-section">
                      <label>Indicaciones / Plan terapéutico</label>
                      <p>{{ h.plan_terapeutico }}</p>
                    </div>
                  }
                  @if (h.estudios_complementarios) {
                    <div class="detail-section">
                      <label>Estudios complementarios</label>
                      <p>{{ h.estudios_complementarios }}</p>
                    </div>
                  }
                  @if (h.laboratorio) {
                    <div class="detail-section">
                      <label>Laboratorio</label>
                      <p>{{ h.laboratorio }}</p>
                    </div>
                  }
                  @if (h.medicacion) {
                    <div class="detail-section">
                      <label>Medicación</label>
                      <p>{{ h.medicacion }}</p>
                    </div>
                  }
                  @if (h.observaciones) {
                    <div class="detail-section">
                      <label>Comentarios</label>
                      <p>{{ h.observaciones }}</p>
                    </div>
                  }
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
                </div>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .page { max-width: 800px; }
    .page-header { margin-bottom: 24px; }
    h1 { font-size: 22px; font-weight: 700; color: #111827; margin: 0 0 4px; }
    .subtitle { color: #6b7280; font-size: 14px; margin: 0; }
    .history-list { display: flex; flex-direction: column; gap: 10px; }
    .history-card {
      background: white; border-radius: 14px; overflow: hidden;
      box-shadow: 0 1px 4px rgba(0,0,0,0.05); cursor: pointer;
      border: 1.5px solid #e5e7eb; transition: border-color 0.15s;
    }
    .history-card.expanded { border-color: #4f46e5; }
    .history-summary { display: flex; align-items: flex-start; justify-content: space-between; padding: 18px 20px; }
    .history-date { font-size: 12px; color: #9ca3af; font-weight: 500; display: block; margin-bottom: 4px; }
    .prof-tag { margin-left: 8px; padding: 2px 8px; background: #eef2ff; color: #4f46e5; border-radius: 20px; font-size: 11px; font-weight: 600; }
    .history-summary h3 { font-size: 15px; font-weight: 600; color: #111827; margin: 0 0 4px; }
    .history-dx { font-size: 13px; color: #6b7280; margin: 0; }
    .chevron { transition: transform 0.2s; flex-shrink: 0; color: #9ca3af; }
    .history-card.expanded .chevron { transform: rotate(180deg); }
    .history-detail {
      padding: 0 20px 20px; border-top: 1px solid #f3f4f6;
      display: flex; flex-direction: column; gap: 14px; padding-top: 16px;
      animation: slideDown 0.15s ease;
    }
    @keyframes slideDown { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
    .detail-section label { display: block; font-size: 12px; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
    .detail-section p { font-size: 14px; color: #374151; margin: 0; line-height: 1.6; }
    .signos-row { display: flex; flex-wrap: wrap; gap: 8px; }
    .signo-tag { background: #f3f4f6; color: #374151; padding: 4px 10px; border-radius: 6px; font-size: 13px; }
    .loading-text { padding: 32px; text-align: center; color: #9ca3af; }
    .empty-state { text-align: center; padding: 56px; display: flex; flex-direction: column; align-items: center; gap: 12px; color: #9ca3af; }
    .feet-display { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .foot-item-sm { display: flex; flex-direction: column; align-items: center; gap: 2px; }
    .foot-path-sm { fill: #e5e7eb; stroke: #9ca3af; stroke-width: 1; }
    .foot-path-sm.foot-yes { fill: #a5b4fc; stroke: #4f46e5; }
    .foot-zone-sm { fill: rgba(79,70,229,0.4); }
    .foot-lbl { font-size: 10px; color: #9ca3af; font-weight: 600; letter-spacing: 0.5px; }
    .plantilla-tag { padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; background: #f3f4f6; color: #9ca3af; }
    .plantilla-tag.yes { background: #eef2ff; color: #4f46e5; }
  `]
})
export class PatientHistoriesComponent implements OnInit {
  private api = inject(ApiService);

  histories = signal<any[]>([]);
  loading = signal(true);
  expanded = signal<string | null>(null);

  ngOnInit() {
    // El backend para rol=patient resuelve el vínculo internamente desde patient_links
    this.api.getClinicalHistories('me').subscribe({
      next: (data) => { this.histories.set(data); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  toggle(id: string) {
    this.expanded.set(this.expanded() === id ? null : id);
  }

  formatDate(date: any): string {
    if (!date) return '';
    try {
      return new Date(date).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });
    } catch { return ''; }
  }
}

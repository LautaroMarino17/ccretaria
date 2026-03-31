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
        <div>
          <h1>Historias clínicas</h1>
          <p class="subtitle">Todas las consultas de tus pacientes</p>
        </div>
      </div>

      <div class="search-bar">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input [(ngModel)]="search" placeholder="Buscar por paciente, motivo o diagnóstico..." />
      </div>

      @if (loading()) {
        <div class="loading-text">Cargando...</div>
      } @else if (filtered().length === 0) {
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" stroke-width="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          <p>{{ search ? 'Sin resultados' : 'No hay historias clínicas registradas' }}</p>
        </div>
      } @else {
        <div class="history-list">
          @for (h of filtered(); track h.id) {
            <div class="history-card" (click)="toggle(h.id)" [class.expanded]="expanded() === h.id">
              <div class="history-summary">
                <div class="history-left">
                  <span class="history-date">{{ formatDate(h.fecha) }}</span>
                  <a class="patient-link" [routerLink]="['/professional/patients', h.patient_id]" (click)="$event.stopPropagation()">
                    {{ h.patient_name }}
                  </a>
                  <h3>{{ h.motivo_consulta || 'Consulta sin título' }}</h3>
                  @if (h.diagnostico) {
                    <p class="history-dx">Dx: {{ h.diagnostico }}</p>
                  }
                </div>
                <svg class="chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </div>

              @if (expanded() === h.id) {
                <div class="history-detail">
                  @if (h.enfermedad_actual) {
                    <div class="detail-section">
                      <label>Enfermedad actual</label>
                      <p>{{ h.enfermedad_actual }}</p>
                    </div>
                  }
                  @if (h.antecedentes_personales) {
                    <div class="detail-section">
                      <label>Antecedentes personales</label>
                      <p>{{ h.antecedentes_personales }}</p>
                    </div>
                  }
                  @if (h.examen_fisico) {
                    <div class="detail-section">
                      <label>Examen físico</label>
                      <p>{{ h.examen_fisico }}</p>
                    </div>
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
                    <div class="detail-section">
                      <label>Plan terapéutico</label>
                      <p>{{ h.plan_terapeutico }}</p>
                    </div>
                  }
                  @if (h.observaciones) {
                    <div class="detail-section">
                      <label>Observaciones</label>
                      <p>{{ h.observaciones }}</p>
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
    .page-header { margin-bottom: 20px; }
    h1 { font-size: 22px; font-weight: 700; color: #111827; margin: 0 0 4px; }
    .subtitle { color: #6b7280; font-size: 14px; margin: 0; }

    .search-bar {
      display: flex; align-items: center; gap: 10px;
      background: white; border: 1.5px solid #e5e7eb; border-radius: 12px;
      padding: 10px 14px; margin-bottom: 20px;
    }
    .search-bar input { border: none; outline: none; font-size: 14px; flex: 1; font-family: inherit; }

    .history-list { display: flex; flex-direction: column; gap: 10px; }
    .history-card {
      background: white; border-radius: 14px; overflow: hidden;
      box-shadow: 0 1px 4px rgba(0,0,0,0.05); cursor: pointer;
      border: 1.5px solid #e5e7eb; transition: border-color 0.15s;
    }
    .history-card.expanded { border-color: #4f46e5; }
    .history-summary { display: flex; align-items: flex-start; justify-content: space-between; padding: 18px 20px; }
    .history-left { flex: 1; }
    .history-date { font-size: 12px; color: #9ca3af; font-weight: 500; display: block; margin-bottom: 2px; }
    .patient-link {
      display: inline-block; font-size: 12px; font-weight: 700; color: #4f46e5;
      text-decoration: none; margin-bottom: 4px;
    }
    .patient-link:hover { text-decoration: underline; }
    .history-summary h3 { font-size: 15px; font-weight: 600; color: #111827; margin: 0 0 4px; }
    .history-dx { font-size: 13px; color: #6b7280; margin: 0; }
    .chevron { transition: transform 0.2s; flex-shrink: 0; color: #9ca3af; margin-top: 4px; }
    .history-card.expanded .chevron { transform: rotate(180deg); }

    .history-detail {
      padding: 16px 20px 20px; border-top: 1px solid #f3f4f6;
      display: flex; flex-direction: column; gap: 14px;
      animation: slideDown 0.15s ease;
    }
    @keyframes slideDown { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
    .detail-section label { display: block; font-size: 12px; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
    .detail-section p { font-size: 14px; color: #374151; margin: 0; line-height: 1.6; }
    .signos-row { display: flex; flex-wrap: wrap; gap: 8px; }
    .signo-tag { background: #f3f4f6; color: #374151; padding: 4px 10px; border-radius: 6px; font-size: 13px; }
    .transcription-details { background: #f9fafb; border-radius: 10px; padding: 12px 14px; }
    .transcription-details summary { font-size: 13px; font-weight: 500; cursor: pointer; color: #6b7280; }
    .transcription-text { font-size: 13px; color: #9ca3af; margin-top: 10px; line-height: 1.7; white-space: pre-wrap; }

    .loading-text { padding: 32px; text-align: center; color: #9ca3af; }
    .empty-state { text-align: center; padding: 56px; display: flex; flex-direction: column; align-items: center; gap: 12px; color: #9ca3af; }
    .empty-state p { font-size: 15px; margin: 0; }
  `]
})
export class ProfessionalHistoriesComponent implements OnInit {
  private api = inject(ApiService);

  histories = signal<any[]>([]);
  loading = signal(true);
  expanded = signal<string | null>(null);
  search = '';

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

  formatDate(date: any): string {
    if (!date) return '';
    try {
      const d = date.seconds ? new Date(date.seconds * 1000) : new Date(date);
      return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return ''; }
  }
}

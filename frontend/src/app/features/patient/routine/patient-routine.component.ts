import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-patient-routine',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page">
      <div class="page-header">
        <h1>Mis rutinas</h1>
        <p class="subtitle">Ejercicios asignados por tu profesional</p>
      </div>

      @if (loading()) {
        <div class="loading-text">Cargando...</div>
      } @else if (routines().length === 0) {
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" stroke-width="1.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          <p>Tu profesional aún no te asignó ninguna rutina</p>
        </div>
      } @else {
        <div class="routines-list">
          @for (r of routines(); track r.id) {
            <div class="routine-card">
              <div class="routine-header">
                <div>
                  <h2>{{ r.titulo }}</h2>
                  @if (r.descripcion) { <p class="routine-desc">{{ r.descripcion }}</p> }
                </div>
                @if (r.professional_name) {
                  <span class="prof-badge">{{ r.professional_name }}</span>
                }
              </div>

              @for (circ of r.circuitos; track $index) {
                <div class="circuit-block">
                  <div class="circuit-header">
                    <span class="circuit-name">{{ circ.nombre || 'Bloque ' + ($index + 1) }}</span>
                    @if (circ.rondas) {
                      <span class="rondas-badge">{{ circ.rondas }} rondas</span>
                    }
                  </div>

                  <div class="exercises-table">
                    <div class="table-head">
                      <span>Ejercicio</span>
                      <span>Descripción</span>
                      <span>Rep / Seg / Mts</span>
                      <span>Carga %</span>
                    </div>
                    @for (ex of circ.ejercicios; track $index) {
                      <div class="table-row">
                        <span class="ex-name">{{ ex.nombre }}</span>
                        <span class="ex-desc">{{ ex.descripcion }}</span>
                        <span class="ex-reps">{{ ex.reps_seg_mts }}</span>
                        <span class="ex-carga">{{ ex.carga }}</span>
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
    </div>
  `,
  styles: [`
    .page { max-width: 900px; }
    .page-header { margin-bottom: 24px; }
    h1 { font-size: 22px; font-weight: 700; color: #111827; margin: 0 0 4px; }
    .subtitle { color: #6b7280; font-size: 14px; margin: 0; }

    .routines-list { display: flex; flex-direction: column; gap: 20px; }
    .routine-card { background: white; border-radius: 18px; padding: 24px; box-shadow: 0 1px 6px rgba(0,0,0,0.06); }
    .routine-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18px; gap: 12px; }
    .routine-card h2 { font-size: 18px; font-weight: 700; color: #111827; margin: 0 0 6px; }
    .routine-desc { font-size: 14px; color: #6b7280; margin: 0; }
    .prof-badge { padding: 4px 12px; background: #f0fdf4; color: #16a34a; border-radius: 20px; font-size: 12px; font-weight: 600; white-space: nowrap; flex-shrink: 0; }

    .circuit-block { margin-bottom: 16px; }
    .circuit-header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
    .circuit-name { font-size: 14px; font-weight: 700; color: #111111; }
    .rondas-badge { background: #16a34a; color: white; border-radius: 20px; padding: 3px 12px; font-size: 12px; font-weight: 700; }

    .exercises-table { border-radius: 10px; overflow: hidden; border: 1px solid #e5e7eb; }
    .table-head { display: grid; grid-template-columns: 2fr 2fr 1.5fr 1.5fr; padding: 8px 14px; background: #f3f4f6; gap: 8px; }
    .table-head span { font-size: 11px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; }
    .table-row { display: grid; grid-template-columns: 2fr 2fr 1.5fr 1.5fr; padding: 10px 14px; border-top: 1px solid #f3f4f6; gap: 8px; align-items: center; }
    .ex-name { font-size: 14px; font-weight: 500; color: #111827; }
    .ex-desc { font-size: 13px; color: #9ca3af; }
    .ex-reps { font-size: 14px; font-weight: 600; color: #16a34a; }
    .ex-carga { font-size: 13px; color: #374151; font-weight: 500; }

    .obs-box { background: #fffbeb; border-radius: 10px; padding: 14px; margin-top: 8px; }
    .obs-label { display: block; font-size: 11px; font-weight: 600; color: #92400e; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
    .obs-box p { font-size: 14px; color: #78350f; margin: 0; line-height: 1.6; }

    .loading-text { padding: 32px; text-align: center; color: #9ca3af; }
    .empty-state { text-align: center; padding: 56px; display: flex; flex-direction: column; align-items: center; gap: 12px; color: #9ca3af; }
    .empty-state p { font-size: 15px; margin: 0; }

    @media (max-width: 600px) {
      .table-head, .table-row { grid-template-columns: 1fr 1fr; }
      .table-head span:nth-child(2), .ex-desc { display: none; }
    }
  `]
})
export class PatientRoutineComponent implements OnInit {
  private api = inject(ApiService);
  routines = signal<any[]>([]);
  loading = signal(true);

  ngOnInit() {
    this.api.getRoutines('me').subscribe({
      next: (data) => { this.routines.set(data); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }
}

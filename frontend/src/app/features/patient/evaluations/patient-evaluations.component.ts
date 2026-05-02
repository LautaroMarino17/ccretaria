import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-patient-evaluations',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page">
      <div class="page-header">
        <h1>Mis evaluaciones</h1>
        <p class="subtitle">Testeos y mediciones realizados por tu profesional</p>
      </div>

      @if (loading()) {
        <div class="loading-text">Cargando...</div>
      } @else if (evals().length === 0) {
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" stroke-width="1.5"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          <p>Tu profesional aún no cargó evaluaciones</p>
        </div>
      } @else {
        <div class="evals-list">
          @for (ev of evals(); track ev.id) {
            <div class="eval-card">
              <div class="eval-header">
                <div>
                  <h2>{{ ev.nombre }}</h2>
                  <div class="eval-meta">
                    <span class="eval-date">{{ formatDate(ev.fecha) }}</span>
                    @if (ev.professional_name) {
                      <span class="prof-badge">{{ ev.professional_name }}</span>
                    }
                  </div>
                </div>
              </div>

              @if (ev.medidas?.length > 0) {
                <div class="measures-table">
                  <div class="measure-head">
                    <span>Medida</span><span>Valor</span><span>Unidad</span>
                  </div>
                  @for (m of ev.medidas; track $index) {
                    <div class="measure-row">
                      <span class="m-name">{{ m.nombre }}</span>
                      <span class="m-val">{{ m.valor }}</span>
                      <span class="m-unit">{{ m.unidad }}</span>
                    </div>
                  }
                </div>
              }

              @if (ev.observaciones) {
                <div class="obs-box">
                  <span class="obs-label">Observaciones</span>
                  <p>{{ ev.observaciones }}</p>
                </div>
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
    .page { max-width: 800px; }
    .page-header { margin-bottom: 24px; }
    h1 { font-size: 22px; font-weight: 700; color: #111827; margin: 0 0 4px; }
    .subtitle { color: #6b7280; font-size: 14px; margin: 0; }

    .evals-list { display: flex; flex-direction: column; gap: 16px; }
    .eval-card { background: white; border-radius: 18px; padding: 24px; box-shadow: 0 1px 6px rgba(0,0,0,0.06); }
    .eval-header { margin-bottom: 16px; }
    .eval-card h2 { font-size: 18px; font-weight: 700; color: #111827; margin: 0 0 6px; }
    .eval-meta { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .eval-date { font-size: 13px; color: #9ca3af; }
    .prof-badge { padding: 3px 10px; background: #f0fdf4; color: #16a34a; border-radius: 20px; font-size: 12px; font-weight: 600; }

    .measures-table { background: #f9fafb; border-radius: 10px; overflow: hidden; margin-bottom: 14px; }
    .measure-head { display: grid; grid-template-columns: 1fr 120px 100px; padding: 8px 14px; background: #f3f4f6; font-size: 11px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; }
    .measure-row { display: grid; grid-template-columns: 1fr 120px 100px; padding: 10px 14px; border-top: 1px solid #e5e7eb; }
    .m-name { font-size: 14px; color: #374151; font-weight: 500; }
    .m-val { font-size: 16px; color: #16a34a; font-weight: 700; }
    .m-unit { font-size: 13px; color: #9ca3af; }

    .obs-box { background: #fffbeb; border-radius: 10px; padding: 14px; margin-top: 10px; }
    .obs-label { display: block; font-size: 11px; font-weight: 600; color: #92400e; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
    .obs-box p { font-size: 14px; color: #78350f; margin: 0; line-height: 1.6; }

    .images-row { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
    .eval-img { height: 140px; width: auto; border-radius: 8px; border: 1px solid #e5e7eb; object-fit: cover; }

    .loading-text { padding: 32px; text-align: center; color: #9ca3af; }
    .empty-state { text-align: center; padding: 56px; display: flex; flex-direction: column; align-items: center; gap: 12px; color: #9ca3af; }
    .empty-state p { font-size: 15px; margin: 0; }

    @media (max-width: 540px) {
      .measure-head, .measure-row { grid-template-columns: 1fr 80px 70px; }
    }
  `]
})
export class PatientEvaluationsComponent implements OnInit {
  private api = inject(ApiService);

  evals = signal<any[]>([]);
  loading = signal(true);

  ngOnInit() {
    // El backend para rol=patient resuelve el vínculo internamente desde patient_links
    this.api.getEvaluations('me').subscribe({
      next: (data) => { this.evals.set(data); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    try {
      return new Date(dateStr + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });
    } catch { return dateStr; }
  }
}

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
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" stroke-width="1.5">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
          </svg>
          <p>Tu profesional aún no te asignó ninguna rutina</p>
        </div>
      } @else {
        <div class="routines-list">
          @for (r of routines(); track r.id) {
            <div class="routine-card">
              <div class="routine-header">
                <div>
                  <h2>{{ r.titulo }}</h2>
                  @if (r.descripcion) {
                    <p class="routine-desc">{{ r.descripcion }}</p>
                  }
                </div>
                @if (r.professional_name) {
                  <span class="prof-badge">{{ r.professional_name }}</span>
                }
              </div>

              @if (r.ejercicios?.length > 0) {
                <div class="exercises-list">
                  @for (ex of r.ejercicios; track $index) {
                    <div class="exercise-item">
                      <div class="exercise-number">{{ $index + 1 }}</div>
                      <div class="exercise-content">
                        <h4>{{ ex.nombre }}</h4>
                        @if (ex.descripcion) {
                          <p class="ex-desc">{{ ex.descripcion }}</p>
                        }
                        <div class="ex-tags">
                          @if (ex.series && ex.repeticiones) {
                            <span class="tag blue">{{ ex.series }} series × {{ ex.repeticiones }} reps</span>
                          }
                          @if (ex.duracion) {
                            <span class="tag green">{{ ex.duracion }}</span>
                          }
                          @if (ex.frecuencia) {
                            <span class="tag purple">{{ ex.frecuencia }}</span>
                          }
                        </div>
                      </div>
                    </div>
                  }
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
    .page { max-width: 800px; }
    .page-header { margin-bottom: 24px; }
    h1 { font-size: 22px; font-weight: 700; color: #111827; margin: 0 0 4px; }
    .subtitle { color: #6b7280; font-size: 14px; margin: 0; }

    .routines-list { display: flex; flex-direction: column; gap: 20px; }

    .routine-card { background: white; border-radius: 18px; padding: 24px; box-shadow: 0 1px 6px rgba(0,0,0,0.06); }
    .routine-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18px; gap: 12px; }
    .routine-card h2 { font-size: 18px; font-weight: 700; color: #111827; margin: 0 0 6px; }
    .routine-desc { font-size: 14px; color: #6b7280; margin: 0; }
    .prof-badge { padding: 4px 12px; background: #eef2ff; color: #4f46e5; border-radius: 20px; font-size: 12px; font-weight: 600; white-space: nowrap; flex-shrink: 0; }

    .exercises-list { display: flex; flex-direction: column; gap: 12px; }
    .exercise-item { display: flex; gap: 14px; padding: 14px; background: #f9fafb; border-radius: 12px; }
    .exercise-number {
      width: 32px; height: 32px; background: #4f46e5; color: white;
      border-radius: 50%; display: flex; align-items: center; justify-content: center;
      font-size: 14px; font-weight: 700; flex-shrink: 0;
    }
    .exercise-content { flex: 1; }
    .exercise-content h4 { font-size: 15px; font-weight: 600; color: #111827; margin: 0 0 4px; }
    .ex-desc { font-size: 13px; color: #6b7280; margin: 0 0 10px; line-height: 1.5; }
    .ex-tags { display: flex; flex-wrap: wrap; gap: 8px; }
    .tag { padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 500; }
    .tag.blue { background: #eff6ff; color: #2563eb; }
    .tag.green { background: #f0fdf4; color: #16a34a; }
    .tag.purple { background: #faf5ff; color: #7c3aed; }

    .obs-box { background: #fffbeb; border-radius: 10px; padding: 14px; margin-top: 16px; }
    .obs-label { display: block; font-size: 12px; font-weight: 600; color: #92400e; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
    .obs-box p { font-size: 14px; color: #78350f; margin: 0; line-height: 1.6; }

    .loading-text { padding: 32px; text-align: center; color: #9ca3af; }
    .empty-state { text-align: center; padding: 56px; display: flex; flex-direction: column; align-items: center; gap: 12px; color: #9ca3af; }
    .empty-state p { font-size: 15px; margin: 0; }
  `]
})
export class PatientRoutineComponent implements OnInit {
  private api = inject(ApiService);

  routines = signal<any[]>([]);
  loading = signal(true);

  ngOnInit() {
    this.api.getMyLink().subscribe({
      next: (link: any) => {
        this.api.getRoutines(link.patient_doc_id).subscribe({
          next: (data) => { this.routines.set(data); this.loading.set(false); },
          error: () => this.loading.set(false)
        });
      },
      error: () => this.loading.set(false)
    });
  }
}

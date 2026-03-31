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
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
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
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <circle cx="12" cy="12" r="3" fill="currentColor"/>
              </svg>
            </div>
            <div>
              <h3>Nueva consulta</h3>
              <p>Grabar y estructurar historia clínica</p>
            </div>
          </a>
          <a [routerLink]="['/professional/patients', patientId, 'routines']" class="action-card">
            <div class="action-icon secondary">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
              </svg>
            </div>
            <div>
              <h3>Rutinas de ejercicios</h3>
              <p>Gestionar planes asignados</p>
            </div>
          </a>
        </div>

        <!-- Datos del paciente -->
        <div class="section-card">
          <div class="section-header">
            <h2>Datos del paciente</h2>
            <div class="section-actions">
              <button class="btn-edit" (click)="editingPhone.set(!editingPhone())">
                {{ editingPhone() ? 'Cancelar' : 'Editar teléfono' }}
              </button>
              <button class="btn-danger" (click)="confirmDelete.set(true)">Eliminar paciente</button>
            </div>
          </div>
          <div class="data-grid">
            <div class="data-item">
              <span class="data-label">Fecha de nacimiento</span>
              <span class="data-value">{{ patient().fecha_nacimiento || '—' }}</span>
            </div>
            <div class="data-item">
              <span class="data-label">Teléfono</span>
              @if (editingPhone()) {
                <div class="phone-edit-row">
                  <input [(ngModel)]="newPhone" [placeholder]="patient().telefono || 'Ingresá el teléfono'" />
                  <button class="btn-save" (click)="savePhone()" [disabled]="savingPhone()">
                    {{ savingPhone() ? '...' : 'Guardar' }}
                  </button>
                </div>
              } @else {
                <span class="data-value">{{ patient().telefono || '—' }}</span>
              }
            </div>
            <div class="data-item">
              <span class="data-label">Email</span>
              <span class="data-value">{{ patient().email || '—' }}</span>
            </div>
            <div class="data-item">
              <span class="data-label">Obra social</span>
              <span class="data-value">{{ patient().obra_social || '—' }}</span>
            </div>
            <div class="data-item">
              <span class="data-label">Nro. afiliado</span>
              <span class="data-value">{{ patient().nro_afiliado || '—' }}</span>
            </div>
          </div>
          @if (patient().diagnostico_inicial) {
            <div class="data-item full">
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
              <p>Se borrarán todos sus datos, historias clínicas y rutinas. Esta acción no se puede deshacer.</p>
              <div class="modal-actions">
                <button class="btn-secondary" (click)="confirmDelete.set(false)">Cancelar</button>
                <button class="btn-danger" (click)="deletePatient()" [disabled]="deleting()">
                  {{ deleting() ? 'Eliminando...' : 'Sí, eliminar' }}
                </button>
              </div>
            </div>
          </div>
        }

        <!-- Historias clínicas -->
        <div class="section-card">
          <h2>Historias clínicas</h2>
          @if (histories().length === 0) {
            <div class="empty-small">No hay historias clínicas registradas aún</div>
          } @else {
            <div class="history-list">
              @for (h of histories(); track h.id) {
                <div class="history-item">
                  <div class="history-date">
                    {{ formatDate(h.fecha?.seconds ? h.fecha.toDate() : h.fecha) }}
                  </div>
                  <div class="history-content">
                    <p class="history-motivo">{{ h.motivo_consulta || 'Sin motivo registrado' }}</p>
                    @if (h.diagnostico) {
                      <p class="history-dx">Dx: {{ h.diagnostico }}</p>
                    }
                    @if (h.professional_name) {
                      <p class="history-prof">{{ h.professional_name }}</p>
                    }
                  </div>
                  <button class="btn-delete-history" (click)="deleteHistory(h.id)" title="Eliminar">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                    </svg>
                  </button>
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
    .btn-back {
      display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px;
      background: white; border: 1px solid #e5e7eb; border-radius: 8px;
      cursor: pointer; font-size: 14px; color: #374151; text-decoration: none;
      margin-bottom: 20px;
    }
    .header-info { display: flex; align-items: center; gap: 16px; }
    .patient-avatar-lg {
      width: 56px; height: 56px; background: #eef2ff; color: #4f46e5;
      border-radius: 50%; display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 20px; flex-shrink: 0;
    }
    h1 { font-size: 22px; font-weight: 700; color: #111827; margin: 0 0 4px; }
    .subtitle { color: #6b7280; font-size: 14px; margin: 0; }
    .quick-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 20px; }
    .action-card {
      display: flex; align-items: center; gap: 14px; padding: 18px;
      background: white; border-radius: 14px; text-decoration: none;
      box-shadow: 0 1px 4px rgba(0,0,0,0.05); border: 1.5px solid #e5e7eb;
      transition: all 0.15s;
    }
    .action-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.1); border-color: #4f46e5; }
    .action-card.primary { background: #4f46e5; color: white; border-color: transparent; }
    .action-card.primary h3, .action-card.primary p { color: white; }
    .action-icon {
      width: 44px; height: 44px; background: rgba(255,255,255,0.2);
      border-radius: 12px; display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .action-icon.secondary { background: #eef2ff; color: #4f46e5; }
    .action-card h3 { font-size: 14px; font-weight: 600; color: #111827; margin: 0 0 2px; }
    .action-card p { font-size: 12px; color: #6b7280; margin: 0; }
    .section-card {
      background: white; border-radius: 16px; padding: 24px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.05); margin-bottom: 16px;
    }
    .section-card h2 { font-size: 16px; font-weight: 700; color: #111827; margin: 0 0 16px; }
    .data-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
    .data-item { display: flex; flex-direction: column; gap: 4px; }
    .data-item.full { grid-column: 1/-1; }
    .data-label { font-size: 12px; color: #9ca3af; font-weight: 500; }
    .data-value { font-size: 14px; color: #111827; }
    .history-list { display: flex; flex-direction: column; gap: 10px; }
    .history-item {
      display: flex; gap: 14px; padding: 14px;
      background: #f9fafb; border-radius: 10px;
    }
    .history-date { font-size: 12px; color: #9ca3af; white-space: nowrap; min-width: 80px; }
    .history-motivo { font-size: 14px; color: #374151; margin: 0 0 4px; font-weight: 500; }
    .history-dx { font-size: 13px; color: #6b7280; margin: 0 0 2px; }
    .history-prof { font-size: 11px; color: #4f46e5; margin: 0; font-weight: 600; }
    .btn-delete-history {
      background: none; border: none; cursor: pointer; color: #d1d5db; padding: 4px;
      border-radius: 6px; display: flex; align-items: center; flex-shrink: 0;
      transition: color 0.15s, background 0.15s;
    }
    .btn-delete-history:hover { color: #dc2626; background: #fef2f2; }
    .empty-small { font-size: 14px; color: #9ca3af; padding: 20px 0; text-align: center; }
    .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
    .section-header h2 { margin: 0; }
    .section-actions { display: flex; gap: 8px; }
    .btn-edit {
      padding: 6px 12px; background: #f3f4f6; border: none; border-radius: 8px;
      font-size: 13px; font-weight: 500; color: #374151; cursor: pointer;
    }
    .btn-edit:hover { background: #e5e7eb; }
    .btn-danger {
      padding: 6px 12px; background: #fef2f2; border: none; border-radius: 8px;
      font-size: 13px; font-weight: 500; color: #dc2626; cursor: pointer;
    }
    .btn-danger:hover { background: #fee2e2; }
    .btn-danger:disabled { opacity: 0.6; cursor: not-allowed; }
    .phone-edit-row { display: flex; gap: 8px; align-items: center; }
    .phone-edit-row input {
      padding: 6px 10px; border: 1.5px solid #e5e7eb; border-radius: 8px;
      font-size: 14px; outline: none; font-family: inherit;
    }
    .phone-edit-row input:focus { border-color: #4f46e5; }
    .btn-save {
      padding: 6px 12px; background: #4f46e5; color: white; border: none;
      border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer;
    }
    .btn-save:disabled { opacity: 0.6; cursor: not-allowed; }
    .modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.4);
      display: flex; align-items: center; justify-content: center; z-index: 100;
    }
    .modal {
      background: white; border-radius: 16px; padding: 28px; max-width: 400px; width: 90%;
      box-shadow: 0 20px 60px rgba(0,0,0,0.2);
    }
    .modal h3 { font-size: 18px; font-weight: 700; color: #111827; margin: 0 0 10px; }
    .modal p { font-size: 14px; color: #6b7280; margin: 0 0 20px; line-height: 1.6; }
    .modal-actions { display: flex; gap: 10px; justify-content: flex-end; }
    .btn-secondary {
      padding: 8px 16px; background: #f3f4f6; border: none; border-radius: 8px;
      font-size: 14px; cursor: pointer; color: #374151;
    }
    @media (max-width: 640px) {
      .quick-actions { grid-template-columns: 1fr; }
      .data-grid { grid-template-columns: 1fr 1fr; }
      .section-header { flex-direction: column; align-items: flex-start; gap: 10px; }
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
  confirmDelete = signal(false);
  deleting = signal(false);
  newPhone = '';

  ngOnInit() {
    this.api.getPatient(this.patientId).subscribe({
      next: (data) => { this.patient.set(data); this.loading.set(false); }
    });
    this.api.getClinicalHistories(this.patientId).subscribe({
      next: (data) => this.histories.set(data)
    });
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
      return new Date(date).toLocaleDateString('es-AR', {
        day: '2-digit', month: 'short', year: 'numeric'
      });
    } catch { return '—'; }
  }
}

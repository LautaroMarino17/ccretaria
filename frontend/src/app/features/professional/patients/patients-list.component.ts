import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { Patient } from '../../../core/models/patient.model';

@Component({
  selector: 'app-patients-list',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Pacientes</h1>
          <p class="subtitle">{{ patients().length }} paciente(s) registrado(s)</p>
        </div>
        <a routerLink="/professional/patients/new" class="btn-primary">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Nuevo paciente
        </a>
      </div>

      <div class="search-bar">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input [(ngModel)]="search" placeholder="Buscar por nombre o DNI..." />
      </div>

      @if (loading()) {
        <div class="skeleton-list">
          @for (i of [1,2,3,4]; track i) {
            <div class="skeleton-card"></div>
          }
        </div>
      } @else if (filteredPatients().length === 0) {
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" stroke-width="1.5">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          <p>{{ search ? 'No se encontraron pacientes' : 'No hay pacientes registrados' }}</p>
          @if (!search) {
            <a routerLink="/professional/patients/new" class="btn-primary">Agregar primer paciente</a>
          }
        </div>
      } @else {
        <div class="patients-grid">
          @for (patient of filteredPatients(); track patient.id) {
            <div class="patient-card" (click)="goToPatient(patient.id!)">
              <div class="patient-avatar">{{ initials(patient) }}</div>
              <div class="patient-info">
                <h3>{{ patient.apellido }}, {{ patient.nombre }}</h3>
                <span class="patient-meta">DNI {{ patient.dni }}</span>
                @if (patient.obra_social) {
                  <span class="badge">{{ patient.obra_social }}</span>
                }
              </div>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; }
    h1 { font-size: 22px; font-weight: 700; color: #111827; margin: 0 0 4px; }
    .subtitle { color: #6b7280; font-size: 14px; margin: 0; }
    .btn-primary {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 18px; background: #16a34a; color: white;
      border: none; border-radius: 10px; font-size: 14px; font-weight: 600;
      cursor: pointer; text-decoration: none; white-space: nowrap;
    }
    .search-bar {
      display: flex; align-items: center; gap: 10px;
      background: white; border: 1.5px solid #e5e7eb; border-radius: 12px;
      padding: 10px 14px; margin-bottom: 20px;
    }
    .search-bar input { border: none; outline: none; font-size: 14px; flex: 1; }
    .patients-grid { display: flex; flex-direction: column; gap: 8px; }
    .patient-card {
      display: flex; align-items: center; gap: 14px;
      background: white; border-radius: 14px; padding: 16px;
      cursor: pointer; transition: box-shadow 0.15s;
      box-shadow: 0 1px 4px rgba(0,0,0,0.05);
    }
    .patient-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.1); }
    .patient-avatar {
      width: 44px; height: 44px; background: #f0fdf4; color: #16a34a;
      border-radius: 50%; display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 16px; flex-shrink: 0;
    }
    .patient-info { flex: 1; }
    .patient-info h3 { font-size: 15px; font-weight: 600; color: #111827; margin: 0 0 4px; }
    .patient-meta { font-size: 13px; color: #6b7280; }
    .badge {
      display: inline-block; background: #f0fdf4; color: #166534;
      font-size: 11px; padding: 2px 8px; border-radius: 20px; margin-left: 8px;
    }
    .skeleton-list { display: flex; flex-direction: column; gap: 8px; }
    .skeleton-card {
      height: 76px; background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%);
      background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius: 14px;
    }
    @keyframes shimmer { to { background-position: -200% 0; } }
    .empty-state {
      text-align: center; padding: 56px; display: flex; flex-direction: column;
      align-items: center; gap: 12px; color: #9ca3af;
    }
    .empty-state p { font-size: 15px; margin: 0; }
  `]
})
export class PatientsListComponent implements OnInit {
  private api = inject(ApiService);
  private router = inject(Router);

  patients = signal<Patient[]>([]);
  loading = signal(true);
  search = '';

  get filteredPatients(): () => Patient[] {
    return () => {
      const q = this.search.toLowerCase();
      return this.patients().filter(p =>
        !q ||
        p.nombre.toLowerCase().includes(q) ||
        p.apellido.toLowerCase().includes(q) ||
        p.dni.includes(q)
      );
    };
  }

  ngOnInit() {
    this.api.getPatients().subscribe({
      next: (data) => { this.patients.set(data); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  initials(p: Patient) {
    return `${p.nombre[0]}${p.apellido[0]}`.toUpperCase();
  }

  goToPatient(id: string) {
    this.router.navigate(['/professional/patients', id]);
  }
}

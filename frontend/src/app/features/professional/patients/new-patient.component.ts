import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-new-patient',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="page">
      <div class="page-header">
        <a routerLink="/professional/patients" class="btn-back">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Pacientes
        </a>
        <h1>Nuevo paciente</h1>
      </div>

      <div class="form-card">
        <form [formGroup]="form" (ngSubmit)="onSubmit()">
          <div class="form-section">
            <h3>Datos personales</h3>
            <div class="fields-grid">
              <div class="field">
                <label>Nombre *</label>
                <input formControlName="nombre" placeholder="Juan" />
              </div>
              <div class="field">
                <label>Apellido *</label>
                <input formControlName="apellido" placeholder="García" />
              </div>
              <div class="field">
                <label>DNI *</label>
                <input formControlName="dni" placeholder="30123456" />
              </div>
              <div class="field">
                <label>Fecha de nacimiento *</label>
                <input type="date" formControlName="fecha_nacimiento" />
              </div>
              <div class="field">
                <label>Sexo *</label>
                <select formControlName="sexo">
                  <option value="">Seleccionar...</option>
                  <option value="M">Masculino</option>
                  <option value="F">Femenino</option>
                  <option value="X">Otro</option>
                </select>
              </div>
              <div class="field">
                <label>Teléfono</label>
                <input formControlName="telefono" placeholder="+54 9 11 1234-5678" />
              </div>
              <div class="field">
                <label>Email</label>
                <input type="email" formControlName="email" placeholder="paciente@email.com" />
              </div>
            </div>
          </div>

          <div class="form-section">
            <h3>Cobertura médica</h3>
            <div class="fields-grid">
              <div class="field">
                <label>Obra social</label>
                <input formControlName="obra_social" placeholder="OSDE, Swiss Medical..." />
              </div>
              <div class="field">
                <label>Nro. afiliado</label>
                <input formControlName="nro_afiliado" placeholder="123456789" />
              </div>
            </div>
          </div>

          <div class="form-section">
            <h3>Antecedentes</h3>
            <div class="field full">
              <label>Diagnóstico inicial / antecedentes relevantes</label>
              <textarea formControlName="diagnostico_inicial" rows="3"
                placeholder="Hipertensión, diabetes tipo 2..."></textarea>
            </div>
          </div>

          @if (error) {
            <div class="error-banner">{{ error }}</div>
          }

          <div class="form-actions">
            <a routerLink="/professional/patients" class="btn-secondary">Cancelar</a>
            <button type="submit" class="btn-primary" [disabled]="loading || form.invalid">
              @if (loading) { <span class="spinner-sm"></span> } Guardar paciente
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .page { max-width: 700px; }
    .page-header { margin-bottom: 24px; }
    .btn-back {
      display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px;
      background: white; border: 1px solid #e5e7eb; border-radius: 8px;
      font-size: 14px; color: #374151; text-decoration: none; margin-bottom: 12px;
    }
    h1 { font-size: 22px; font-weight: 700; color: #111827; margin: 0; }
    .form-card { background: white; border-radius: 16px; padding: 28px; box-shadow: 0 1px 4px rgba(0,0,0,0.05); }
    .form-section { margin-bottom: 24px; }
    .form-section h3 { font-size: 14px; font-weight: 700; color: #374151; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 14px; border-bottom: 1px solid #f3f4f6; padding-bottom: 10px; }
    .fields-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .field { display: flex; flex-direction: column; gap: 6px; }
    .field.full { grid-column: 1/-1; }
    label { font-size: 13px; font-weight: 500; color: #374151; }
    input, select, textarea {
      padding: 10px 12px; border: 1.5px solid #e5e7eb; border-radius: 8px;
      font-size: 14px; outline: none; font-family: inherit;
    }
    input:focus, select:focus, textarea:focus { border-color: #4f46e5; }
    textarea { resize: vertical; }
    .error-banner { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 8px; padding: 10px 14px; font-size: 14px; margin-bottom: 16px; }
    .form-actions { display: flex; gap: 12px; justify-content: flex-end; }
    .btn-primary {
      display: flex; align-items: center; gap: 8px; padding: 11px 22px;
      background: #4f46e5; color: white; border: none; border-radius: 10px;
      font-size: 14px; font-weight: 600; cursor: pointer;
    }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-secondary { padding: 11px 22px; background: #f3f4f6; color: #374151; border: none; border-radius: 10px; font-size: 14px; cursor: pointer; text-decoration: none; }
    .spinner-sm { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.4); border-top-color: white; border-radius: 50%; animation: spin 0.7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (max-width: 540px) { .fields-grid { grid-template-columns: 1fr; } }
  `]
})
export class NewPatientComponent {
  private fb = inject(FormBuilder);
  private api = inject(ApiService);
  private router = inject(Router);

  loading = false;
  error = '';

  form = this.fb.group({
    nombre: ['', Validators.required],
    apellido: ['', Validators.required],
    dni: ['', [Validators.required, Validators.pattern(/^\d{7,8}$/)]],
    fecha_nacimiento: ['', Validators.required],
    sexo: ['', Validators.required],
    telefono: [''],
    email: ['', Validators.email],
    obra_social: [''],
    nro_afiliado: [''],
    diagnostico_inicial: ['']
  });

  onSubmit() {
    if (this.form.invalid) return;
    this.loading = true;
    this.error = '';

    this.api.createPatient(this.form.value).subscribe({
      next: () => this.router.navigate(['/professional/patients']),
      error: (err) => {
        this.error = err.error?.detail || 'Error al crear el paciente';
        this.loading = false;
      }
    });
  }
}

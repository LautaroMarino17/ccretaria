import { Component, inject, signal, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { ClinicalHistory, EMPTY_SIGNOS_VITALES, MANIOBRA_SECTIONS, emptyManiobras } from '../../../core/models/clinical-history.model';

type RecordingState = 'idle' | 'recording' | 'stopped' | 'processing' | 'reviewing' | 'saving' | 'done';

@Component({
  selector: 'app-record-history',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page">
      <div class="page-header">
        <button class="btn-back" (click)="goBack()">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Volver
        </button>
        <div>
          <h1>Nueva historia clínica</h1>
          <p class="subtitle">Grabá la consulta y el sistema la estructura automáticamente</p>
        </div>
      </div>

      <!-- Estado: IDLE / RECORDING / STOPPED -->
      @if (state() === 'idle' || state() === 'recording' || state() === 'stopped') {
        <div class="record-card">
          @if (state() !== 'stopped') {
            <div class="record-visual" [class.active]="state() === 'recording'">
              <div class="pulse-ring"></div>
              <button class="record-btn" (click)="toggleRecording()">
                @if (state() === 'idle') {
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="12" cy="12" r="8"/>
                  </svg>
                } @else {
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="6" width="12" height="12" rx="2"/>
                  </svg>
                }
              </button>
            </div>

            <p class="record-label">
              @if (state() === 'idle') {
                Presioná para iniciar la grabación
              } @else {
                Grabando... {{ formatTime(elapsedSeconds()) }}
              }
            </p>

            @if (state() === 'recording') {
              <div class="waveform">
                @for (h of waveHeights(); track $index) {
                  <div class="wave-bar" [style.height.px]="h"></div>
                }
              </div>
            }

            <p class="record-hint">
              Hablá con naturalidad durante la consulta.
              Al detener la grabación podrás generar la historia clínica.
            </p>
          } @else {
            <!-- Audio grabado, listo para procesar -->
            <div class="stopped-visual">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            <p class="record-label">Consulta finalizada.</p>
            <p class="record-duration">Duración: {{ formatTime(elapsedSeconds()) }}</p>

            @if (error()) {
              <p class="record-hint retry-hint">{{ error() }}</p>
              <div class="stopped-actions">
                <button class="btn-secondary" (click)="startOver()">Grabar de nuevo</button>
                <button class="btn-generate" (click)="processAudio()">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/>
                  </svg>
                  Reintentar
                </button>
              </div>
            } @else {
              <p class="record-hint">El audio quedó guardado. Presioná el botón para transcribirlo y generar la historia clínica.</p>
              <div class="stopped-actions">
                <button class="btn-secondary" (click)="startOver()">Descartar y grabar de nuevo</button>
                <button class="btn-generate" (click)="processAudio()">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                    <polyline points="10 9 9 9 8 9"/>
                  </svg>
                  Generar historia clínica
                </button>
              </div>
            }
          }
        </div>
      }

      <!-- Estado: PROCESSING -->
      @if (state() === 'processing') {
        <div class="processing-card">
          <div class="processing-spinner"></div>
          <h3>Procesando consulta</h3>
          <p>{{ processingMessage() }}</p>
          <div class="processing-steps">
            <div class="step" [class.done]="processingStep() > 0" [class.active]="processingStep() === 0">
              <span class="step-icon">1</span> Transcribiendo audio con Whisper
            </div>
            <div class="step" [class.done]="processingStep() > 1" [class.active]="processingStep() === 1">
              <span class="step-icon">2</span> Estructurando historia clínica con IA
            </div>
          </div>
        </div>
      }

      <!-- Estado: REVIEWING -->
      @if (state() === 'reviewing') {
        <div class="review-section">
          <div class="review-banner">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            Revisá y corregí los campos antes de guardar
          </div>

          <!-- Ficha médica impresa -->
          <div class="medical-form">
            <!-- Cabecera -->
            <div class="mf-header">
              <span class="mf-title">HISTORIA CLÍNICA</span>
              <span class="mf-date">Fecha: {{ today() }}</span>
            </div>

            <!-- Datos del paciente -->
            <div class="mf-patient-row">
              <div class="mf-patient-field wide">
                <span class="mf-plabel">Apellido y Nombre</span>
                <input class="mf-pinput" [(ngModel)]="history().nombre_paciente" placeholder="—" />
              </div>
              <div class="mf-patient-field">
                <span class="mf-plabel">T.A.</span>
                <input class="mf-pinput" [(ngModel)]="history().signos_vitales.tension_arterial" placeholder="—" />
              </div>
              <div class="mf-patient-field">
                <span class="mf-plabel">FC</span>
                <input class="mf-pinput" [(ngModel)]="history().signos_vitales.frecuencia_cardiaca" placeholder="—" />
              </div>
              <div class="mf-patient-field">
                <span class="mf-plabel">Temp.</span>
                <input class="mf-pinput" [(ngModel)]="history().signos_vitales.temperatura" placeholder="—" />
              </div>
              <div class="mf-patient-field">
                <span class="mf-plabel">Peso</span>
                <input class="mf-pinput" [(ngModel)]="history().signos_vitales.peso" placeholder="—" />
              </div>
              <div class="mf-patient-field">
                <span class="mf-plabel">Talla</span>
                <input class="mf-pinput" [(ngModel)]="history().signos_vitales.talla" placeholder="—" />
              </div>
              <div class="mf-patient-field">
                <span class="mf-plabel">SatO2</span>
                <input class="mf-pinput" [(ngModel)]="history().signos_vitales.saturacion" placeholder="—" />
              </div>
            </div>

            <!-- Motivo de consulta -->
            <div class="mf-section">
              <span class="mf-label">Motivo de consulta</span>
              <textarea class="mf-textarea" [(ngModel)]="history().motivo_consulta" rows="2" placeholder="—"></textarea>
            </div>

            <!-- Antecedentes y síntomas -->
            <div class="mf-section">
              <span class="mf-label">Antecedentes y síntomas</span>
              <textarea class="mf-textarea" [(ngModel)]="history().antecedentes_sintomas" rows="4" placeholder="—"></textarea>
            </div>

            <!-- Exploración estática -->
            <div class="mf-section">
              <span class="mf-label">Exploración estática</span>
              <textarea class="mf-textarea" [(ngModel)]="history().exploracion_estatica" rows="3" placeholder="—"></textarea>
            </div>

            <!-- Inspección dinámica -->
            <div class="mf-section">
              <span class="mf-label">Inspección dinámica</span>
              <textarea class="mf-textarea" [(ngModel)]="history().exploracion_dinamica" rows="3" placeholder="—"></textarea>
            </div>

            <!-- Maniobras semiológicas -->
            <div class="mf-section">
              <span class="mf-label">Maniobras semiológicas</span>
              <table class="maniobras-table">
                <thead>
                  <tr>
                    <th>Articulación</th>
                    <th>Comentario</th>
                  </tr>
                </thead>
                <tbody>
                  @for (section of maniobra_sections; track section.label) {
                    <tr class="maniobra-section-row">
                      <td colspan="2">{{ section.label }}</td>
                    </tr>
                    @for (joint of section.joints; track joint) {
                      <tr>
                        <td class="joint-name">{{ joint }}</td>
                        <td><input class="maniobra-input" [(ngModel)]="history().maniobras![joint].comentario" placeholder="—" /></td>
                      </tr>
                    }
                  }
                </tbody>
              </table>
            </div>

            <!-- Diagnóstico -->
            <div class="mf-section">
              <span class="mf-label">Diagnóstico</span>
              <textarea class="mf-textarea" [(ngModel)]="history().diagnostico" rows="2" placeholder="—"></textarea>
            </div>

            <!-- Plantillas -->
            <div class="mf-section mf-plantillas-row">
              <span class="mf-label">Plantillas</span>
              <div class="mf-plantillas-body">
                <div class="mf-feet" (click)="togglePlantillas()" title="Clic para indicar / quitar plantillas">
                  <!-- Pie izquierdo -->
                  <div class="mf-foot-item">
                    <svg viewBox="25 5 75 100" width="58" height="77">
                      <g transform="scale(-1,1) translate(-129,0)">
                        <path [class.foot-yes]="history().plantillas" class="foot-path" d="M 46.857 24.686 C 44.114 49.829 56.229 44.343 39.543 71.771 C 38.171 72.229 40.686 91.429 39.314 82.057 C 41 96 62 96 66 84 C 70 72 82 62 86 46 C 90 30 70 10 51.886 19.886 Z"/>
                        
                        
                        
                        
                        
                        @if (history().plantillas) {
                          
                          
                          
                        }
                      </g>
                    </svg>
                    <span class="foot-side">I</span>
                  </div>
                  <!-- Pie derecho -->
                  <div class="mf-foot-item">
                    <svg viewBox="25 5 75 100" width="58" height="77">
                      <path [class.foot-yes]="history().plantillas" class="foot-path" d="M 46.857 24.686 C 44.114 49.829 56.229 44.343 39.543 71.771 C 38.171 72.229 40.686 91.429 39.314 82.057 C 41 96 62 96 66 84 C 70 72 82 62 86 46 C 90 30 70 10 51.886 19.886 Z"/>
                      
                      
                      
                      
                      
                      @if (history().plantillas) {
                        
                        
                        
                      }
                    </svg>
                    <span class="foot-side">D</span>
                  </div>
                </div>
                <div class="plantilla-status" [class.active]="history().plantillas">
                  {{ history().plantillas ? 'Plantillas: Sí' : 'Plantillas: No' }}
                </div>
                <span class="feet-hint">Clic en los pies para indicar</span>
              </div>
            </div>

            <!-- Pedigrafía (siempre visible) -->
            <div class="mf-section">
              <span class="mf-label">Descripción de plantilla (pedigrafía)</span>
              <textarea class="mf-textarea" [(ngModel)]="history().descripcion_pedografia" rows="2" placeholder="—"></textarea>
            </div>

            <!-- Indicaciones / Plan terapéutico -->
            <div class="mf-section">
              <span class="mf-label">Indicaciones / Plan terapéutico</span>
              <textarea class="mf-textarea" [(ngModel)]="history().plan_terapeutico" rows="3" placeholder="—"></textarea>
            </div>

            <!-- Estudios complementarios + Laboratorio -->
            <div class="mf-section mf-row">
              <div class="mf-col">
                <span class="mf-label">Estudios complementarios</span>
                <textarea class="mf-textarea" [(ngModel)]="history().estudios_complementarios" rows="2" placeholder="—"></textarea>
              </div>
              <div class="mf-col">
                <span class="mf-label">Laboratorio</span>
                <textarea class="mf-textarea" [(ngModel)]="history().laboratorio" rows="2" placeholder="—"></textarea>
              </div>
            </div>

            <!-- Medicación -->
            <div class="mf-section">
              <span class="mf-label">Medicación</span>
              <textarea class="mf-textarea" [(ngModel)]="history().medicacion" rows="2" placeholder="—"></textarea>
            </div>

            <!-- Comentarios -->
            <div class="mf-section mf-last">
              <span class="mf-label">Comentarios</span>
              <textarea class="mf-textarea" [(ngModel)]="history().observaciones" rows="2" placeholder="—"></textarea>
            </div>
          </div>

          <div class="review-actions">
            <button class="btn-secondary" (click)="startOver()">Grabar de nuevo</button>
            <button class="btn-primary" (click)="saveHistory()" [disabled]="state() === 'saving'">
              @if (state() === 'saving') {
                <span class="spinner-sm"></span> Guardando...
              } @else {
                Confirmar y guardar
              }
            </button>
          </div>
        </div>
      }

      <!-- Estado: DONE -->
      @if (state() === 'done') {
        <div class="done-card">
          <div class="done-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </div>
          <h3>Historia clínica guardada</h3>
          <p>La historia quedó registrada correctamente en el sistema.</p>
          <button class="btn-primary" (click)="goBack()">Volver al paciente</button>
        </div>
      }

      @if (error()) {
        <div class="error-banner">{{ error() }}</div>
      }
    </div>
  `,
  styles: [`
    .page { max-width: 800px; }
    .page-header { display: flex; align-items: flex-start; gap: 16px; margin-bottom: 28px; }
    .btn-back {
      display: flex; align-items: center; gap: 6px; padding: 8px 14px;
      background: white; border: 1px solid #e5e7eb; border-radius: 8px;
      cursor: pointer; font-size: 14px; color: #374151; white-space: nowrap;
    }
    h1 { font-size: 22px; font-weight: 700; color: #111827; margin: 0 0 4px; }
    .subtitle { color: #6b7280; font-size: 14px; margin: 0; }

    /* ── Record card ── */
    .record-card {
      background: white; border-radius: 20px; padding: 48px 32px;
      text-align: center; box-shadow: 0 2px 12px rgba(0,0,0,0.06);
    }
    .record-visual {
      position: relative; width: 120px; height: 120px;
      margin: 0 auto 24px; display: flex; align-items: center; justify-content: center;
    }
    .pulse-ring {
      position: absolute; inset: 0; border-radius: 50%;
      border: 3px solid #e5e7eb; transition: all 0.3s;
    }
    .record-visual.active .pulse-ring {
      border-color: #ef4444; animation: pulse-ring 1.5s ease-out infinite;
    }
    @keyframes pulse-ring {
      0% { transform: scale(1); opacity: 1; }
      100% { transform: scale(1.5); opacity: 0; }
    }
    .record-btn {
      width: 80px; height: 80px; border-radius: 50%; border: none;
      background: #16a34a; color: white; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: background 0.2s, transform 0.1s; z-index: 1;
    }
    .record-visual.active .record-btn { background: #ef4444; }
    .record-btn:active { transform: scale(0.95); }
    .record-label { font-size: 16px; font-weight: 600; color: #374151; margin: 0 0 16px; }
    .waveform {
      display: flex; align-items: center; justify-content: center;
      gap: 3px; height: 40px; margin-bottom: 24px;
    }
    .wave-bar {
      width: 4px; background: #16a34a; border-radius: 2px;
      animation: wave 0.5s ease-in-out infinite alternate;
      animation-delay: calc(var(--i) * 0.05s);
    }
    @keyframes wave { to { transform: scaleY(0.3); } }
    .record-hint { font-size: 13px; color: #9ca3af; max-width: 480px; margin: 0 auto; line-height: 1.6; }

    .stopped-visual {
      width: 80px; height: 80px; background: #f0fdf4; border-radius: 50%;
      display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;
    }
    .record-duration { font-size: 14px; color: #6b7280; margin: 0 0 8px; }
    .stopped-actions { display: flex; gap: 12px; justify-content: center; margin-top: 24px; flex-wrap: wrap; }
    .btn-generate {
      padding: 14px 28px; background: #16a34a; color: white;
      border: none; border-radius: 12px; font-size: 15px; font-weight: 700;
      cursor: pointer; display: flex; align-items: center; gap: 10px;
      box-shadow: 0 4px 14px rgba(22,163,74,0.35); transition: background 0.2s, transform 0.1s;
    }
    .btn-generate:hover { background: #15803d; transform: translateY(-1px); }
    .btn-generate:active { transform: translateY(0); }

    /* ── Processing ── */
    .processing-card {
      background: white; border-radius: 20px; padding: 48px;
      text-align: center; box-shadow: 0 2px 12px rgba(0,0,0,0.06);
    }
    .processing-spinner {
      width: 56px; height: 56px; border: 4px solid #e5e7eb;
      border-top-color: #16a34a; border-radius: 50%;
      animation: spin 0.8s linear infinite; margin: 0 auto 20px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .processing-card h3 { font-size: 20px; font-weight: 700; color: #111827; margin: 0 0 8px; }
    .processing-card p { color: #6b7280; margin: 0 0 24px; }
    .processing-steps { display: flex; flex-direction: column; gap: 10px; text-align: left; max-width: 360px; margin: 0 auto; }
    .step {
      display: flex; align-items: center; gap: 12px;
      padding: 10px 14px; border-radius: 10px; font-size: 14px; color: #9ca3af;
      background: #f9fafb;
    }
    .step.active { background: #f0fdf4; color: #16a34a; font-weight: 600; }
    .step.done { background: #f0fdf4; color: #166534; }
    .step-icon {
      width: 24px; height: 24px; border-radius: 50%; background: #e5e7eb;
      display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; flex-shrink: 0;
    }
    .step.active .step-icon { background: #16a34a; color: white; }
    .step.done .step-icon { background: #22c55e; color: white; }

    /* ── Review ── */
    .review-section { display: flex; flex-direction: column; gap: 16px; }
    .review-banner {
      display: flex; align-items: center; gap: 10px;
      background: #fffbeb; color: #92400e; border: 1px solid #fde68a;
      border-radius: 10px; padding: 12px 16px; font-size: 14px;
    }

    /* ── Medical form ── */
    .medical-form {
      background: white; border: 1.5px solid #c9cdd4;
      border-radius: 6px; overflow: hidden;
      box-shadow: 0 2px 12px rgba(0,0,0,0.07);
      font-family: Georgia, 'Times New Roman', serif;
    }
    .mf-header {
      display: flex; justify-content: space-between; align-items: center;
      background: #f8f9fa; border-bottom: 1.5px solid #c9cdd4;
      padding: 10px 20px;
    }
    .mf-title { font-size: 13px; font-weight: 700; color: #374151; letter-spacing: 0.8px; font-family: Arial, sans-serif; }
    .mf-date { font-size: 12px; color: #6b7280; font-family: Arial, sans-serif; }

    .mf-patient-row {
      display: flex; flex-wrap: wrap; gap: 0;
      border-bottom: 1.5px solid #c9cdd4; padding: 0;
    }
    .mf-patient-field {
      display: flex; flex-direction: column; padding: 8px 14px;
      border-right: 1px solid #e5e7eb; min-width: 80px;
    }
    .mf-patient-field.wide { flex: 1; min-width: 200px; }
    .mf-patient-field:last-child { border-right: none; }
    .mf-plabel { font-size: 10px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.4px; font-family: Arial, sans-serif; margin-bottom: 3px; }
    .mf-pinput {
      border: none; outline: none; font-size: 13px; color: #111827;
      background: transparent; font-family: Georgia, serif; width: 100%;
      border-bottom: 1px dotted #9ca3af; padding: 2px 0;
    }
    .mf-pinput:focus { border-bottom-color: #16a34a; }

    .mf-section {
      padding: 10px 20px; border-bottom: 1px solid #e9eaec;
    }
    .mf-section.mf-last { border-bottom: none; }
    .mf-section.mf-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0; padding: 0; }
    .mf-col { padding: 10px 20px; }
    .mf-col:first-child { border-right: 1px solid #e9eaec; }
    .mf-label {
      display: block; font-size: 12px; font-weight: 700; color: #374151;
      font-family: Arial, sans-serif; margin-bottom: 4px;
    }
    .mf-textarea {
      width: 100%; border: none; outline: none; resize: none;
      background: transparent; font-family: Georgia, 'Times New Roman', serif;
      font-size: 14px; color: #111827; line-height: 1.9;
      background-image: repeating-linear-gradient(
        transparent, transparent calc(1.9em - 1px), #e5e7eb calc(1.9em - 1px), #e5e7eb 1.9em
      );
      padding: 0; margin-top: 2px;
    }
    .mf-textarea:focus { background-image: repeating-linear-gradient(
      transparent, transparent calc(1.9em - 1px), #a5b4fc calc(1.9em - 1px), #a5b4fc 1.9em
    ); }

    /* ── Maniobras table ── */
    .maniobras-table {
      width: 100%; border-collapse: collapse; font-family: Arial, sans-serif; font-size: 12px; margin-top: 6px;
    }
    .maniobras-table thead th {
      background: #f3f4f6; font-weight: 700; color: #374151; padding: 5px 10px;
      border: 1px solid #e5e7eb; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.4px;
    }
    .maniobras-table td { border: 1px solid #e9eaec; padding: 3px 8px; vertical-align: middle; }
    .maniobra-section-row td {
      background: #f8f9fa; font-weight: 700; font-size: 11px; color: #6b7280;
      text-transform: uppercase; letter-spacing: 0.6px; padding: 4px 10px;
    }
    .joint-name { width: 120px; color: #374151; font-size: 12px; }
    .maniobra-input {
      border: none; outline: none; width: 100%; background: transparent;
      font-family: Georgia, serif; font-size: 13px; color: #111827;
      border-bottom: 1px dotted #9ca3af; padding: 1px 2px;
    }
    .maniobra-input:focus { border-bottom-color: #16a34a; }

    /* ── Feet / Plantillas ── */
    .mf-plantillas-row { display: flex; flex-direction: column; gap: 6px; }
    .mf-plantillas-body { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; }
    .mf-feet {
      display: flex; gap: 20px; align-items: flex-end;
      cursor: pointer; padding: 8px 10px; border-radius: 10px;
      transition: background 0.2s; user-select: none;
    }
    .mf-feet:hover { background: #f0f4ff; }
    .mf-foot-item { display: flex; flex-direction: column; align-items: center; gap: 3px; }
    .foot-side { font-size: 10px; font-weight: 700; color: #9ca3af; letter-spacing: 1px; font-family: Arial, sans-serif; }
    .foot-path {
      fill: #d1d5db; stroke: #9ca3af; stroke-width: 1.5;
      transition: fill 0.35s, stroke 0.35s;
    }
    .foot-yes { fill: #818cf8; stroke: #15803d; }
    .foot-zone { fill: rgba(55, 48, 163, 0.5); }
    .plantilla-status {
      font-size: 13px; font-weight: 600; color: #9ca3af;
      font-family: Arial, sans-serif; transition: color 0.3s;
    }
    .plantilla-status.active { color: #16a34a; }
    .feet-hint { font-size: 11px; color: #d1d5db; font-family: Arial, sans-serif; }

    .review-actions { display: flex; gap: 12px; justify-content: flex-end; }

    @media (max-width: 640px) {
      .mf-section.mf-row { grid-template-columns: 1fr; }
      .mf-col:first-child { border-right: none; border-bottom: 1px solid #e9eaec; }
    }

    /* ── Done ── */
    .done-card {
      background: white; border-radius: 20px; padding: 56px 32px;
      text-align: center; box-shadow: 0 2px 12px rgba(0,0,0,0.06);
    }
    .done-icon {
      width: 80px; height: 80px; background: #f0fdf4; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      color: #22c55e; margin: 0 auto 20px;
    }
    .done-card h3 { font-size: 22px; font-weight: 700; color: #111827; margin: 0 0 8px; }
    .done-card p { color: #6b7280; margin: 0 0 24px; }

    /* ── Shared ── */
    .btn-primary {
      padding: 12px 24px; background: #16a34a; color: white;
      border: none; border-radius: 10px; font-size: 14px; font-weight: 600;
      cursor: pointer; display: flex; align-items: center; gap: 8px;
    }
    .btn-primary:hover:not(:disabled) { background: #15803d; }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-secondary {
      padding: 12px 24px; background: #f3f4f6; color: #374151;
      border: none; border-radius: 10px; font-size: 14px; font-weight: 500; cursor: pointer;
    }
    .spinner-sm {
      width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.4);
      border-top-color: white; border-radius: 50%; animation: spin 0.7s linear infinite;
    }
    .retry-hint { color: #dc2626 !important; }
    .error-banner {
      background: #fef2f2; color: #dc2626; border: 1px solid #fecaca;
      border-radius: 10px; padding: 12px 16px; font-size: 14px; margin-top: 16px;
    }

    @media (max-width: 640px) {
      .fields-grid { grid-template-columns: 1fr; }
      .signos-grid { grid-template-columns: 1fr 1fr; }
    }
  `]
})
export class RecordHistoryComponent implements OnDestroy {
  private api = inject(ApiService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);

  patientId = this.route.snapshot.params['patientId'] || '';
  maniobra_sections = MANIOBRA_SECTIONS;

  state = signal<RecordingState>('idle');
  error = signal('');
  processingMessage = signal('Transcribiendo audio con Whisper...');
  processingStep = signal(0);
  elapsedSeconds = signal(0);
  waveHeights = signal<number[]>(Array.from({ length: 20 }, () => 8));

  history = signal<ClinicalHistory>({
    patient_id: this.patientId,
    nombre_paciente: '',
    motivo_consulta: '',
    antecedentes_sintomas: '',
    examen_fisico: '',
    exploracion_estatica: '',
    exploracion_dinamica: '',
    maniobras: emptyManiobras(),
    signos_vitales: { ...EMPTY_SIGNOS_VITALES },
    diagnostico: '',
    plan_terapeutico: '',
    estudios_complementarios: '',
    laboratorio: '',
    medicacion: '',
    observaciones: '',
    plantillas: false,
    descripcion_pedografia: '',
    transcripcion_original: '',
    verificada: false
  });

  private mediaRecorder: MediaRecorder | null = null;
  private mediaStream: MediaStream | null = null;
  private audioChunks: Blob[] = [];
  private timerInterval: any = null;
  private waveInterval: any = null;

  async toggleRecording() {
    if (this.state() === 'idle') {
      await this.startRecording();
    } else if (this.state() === 'recording') {
      this.stopRecording();
    }
  }

  private async startRecording() {
    this.error.set('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaStream = stream;
      this.audioChunks = [];
      this.mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.audioChunks.push(e.data);
      };

      this.mediaRecorder.start(1000);
      this.state.set('recording');
      this.elapsedSeconds.set(0);

      this.timerInterval = setInterval(() => {
        this.elapsedSeconds.update(v => v + 1);
      }, 1000);

      this.waveInterval = setInterval(() => {
        this.waveHeights.set(
          Array.from({ length: 20 }, () => Math.floor(Math.random() * 30) + 4)
        );
      }, 150);

    } catch {
      this.error.set('No se pudo acceder al micrófono. Verificá los permisos del navegador.');
    }
  }

  private stopRecording() {
    clearInterval(this.timerInterval);
    clearInterval(this.waveInterval);
    this.mediaRecorder!.onstop = () => {
      this.mediaStream?.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    };
    this.mediaRecorder?.stop();
    this.state.set('stopped');
  }

  async processAudio() {
    if (!this.audioChunks.length) return;
    this.state.set('processing');
    this.processingStep.set(0);
    this.error.set('');
    this.cdr.detectChanges();

    // Agrupar blobs en chunks de 2 minutos (120 blobs de 1s cada uno).
    // El primer blob siempre se incluye al inicio de cada grupo para que
    // todos sean WebM válidos (contiene el header EBML + Tracks).
    const BLOBS_PER_CHUNK = 120;
    const firstBlob = this.audioChunks[0];
    const groups: Blob[] = [];
    for (let i = 0; i < this.audioChunks.length; i += BLOBS_PER_CHUNK) {
      const slice = this.audioChunks.slice(i, i + BLOBS_PER_CHUNK);
      const blobsForGroup = i === 0 ? slice : [firstBlob, ...slice];
      groups.push(new Blob(blobsForGroup, { type: 'audio/webm' }));
    }

    const texts: string[] = [];
    try {
      for (let i = 0; i < groups.length; i++) {
        this.processingMessage.set(`Transcribiendo parte ${i + 1} de ${groups.length}...`);
        this.cdr.detectChanges();
        const { text } = await firstValueFrom(this.api.transcribeChunk(groups[i]));
        texts.push(text);
      }

      this.processingStep.set(1);
      this.processingMessage.set('Estructurando historia clínica con IA...');
      this.cdr.detectChanges();

      const transcription = texts.join(' ');
      const { clinical_history: ch } = await firstValueFrom(this.api.structureText(transcription));

      this.history.set({
        patient_id: this.patientId,
        nombre_paciente: ch.nombre_paciente || '',
        motivo_consulta: ch.motivo_consulta || '',
        antecedentes_sintomas: ch.antecedentes_sintomas || '',
        examen_fisico: ch.examen_fisico || '',
        exploracion_estatica: ch.exploracion_estatica || '',
        exploracion_dinamica: ch.exploracion_dinamica || '',
        maniobras: emptyManiobras(),
        signos_vitales: ch.signos_vitales || { ...EMPTY_SIGNOS_VITALES },
        diagnostico: ch.diagnostico || '',
        plan_terapeutico: ch.plan_terapeutico || '',
        estudios_complementarios: ch.estudios_complementarios || '',
        laboratorio: ch.laboratorio || '',
        medicacion: ch.medicacion || '',
        observaciones: ch.observaciones || '',
        plantillas: ch.plantillas || false,
        descripcion_pedografia: ch.descripcion_pedografia || '',
        transcripcion_original: transcription,
        verificada: false
      });
      this.processingStep.set(2);
      this.state.set('reviewing');
      this.cdr.detectChanges();

    } catch (err: unknown) {
      const httpErr = err as any;
      const detail: string = httpErr?.error?.detail || '';
      if (detail.includes('rate_limit_exceeded') || detail.includes('Rate limit') || httpErr?.status === 429) {
        this.error.set('');
        this.state.set('idle');
        this.audioChunks = [];
        this.elapsedSeconds.set(0);
        this.cdr.detectChanges();
        alert('Límite de transcripciones alcanzado. Esperá unos minutos e intentá de nuevo.');
      } else {
        this.error.set(detail || 'Error al procesar el audio. Podés reintentar.');
        this.state.set('stopped');
        this.cdr.detectChanges();
      }
    }
  }

  saveHistory() {
    this.state.set('saving');
    this.api.saveClinicalHistory(this.history()).subscribe({
      next: () => this.state.set('done'),
      error: (err) => {
        this.error.set(err.error?.detail || 'Error al guardar la historia clínica');
        this.state.set('reviewing');
      }
    });
  }

  startOver() {
    this.state.set('idle');
    this.error.set('');
    this.audioChunks = [];
    this.elapsedSeconds.set(0);
  }

  togglePlantillas() {
    const h = this.history();
    this.history.set({ ...h, plantillas: !h.plantillas });
  }

  today(): string {
    return new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  goBack() {
    this.router.navigate(['/professional/patients', this.patientId]);
  }

  ngOnDestroy() {
    clearInterval(this.timerInterval);
    clearInterval(this.waveInterval);
    if (this.mediaRecorder?.state === 'recording') {
      this.mediaRecorder.stop();
    }
    this.mediaStream?.getTracks().forEach(t => t.stop());
  }
}

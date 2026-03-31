import { Component, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { ClinicalHistory, EMPTY_CLINICAL_HISTORY, EMPTY_SIGNOS_VITALES } from '../../../core/models/clinical-history.model';

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
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="22"/>
              </svg>
            </div>
            <p class="record-label">Grabación lista — {{ formatTime(elapsedSeconds()) }}</p>
            <p class="record-hint">Presioná "Generar historia clínica" para transcribir y estructurar la consulta con IA.</p>
            <div class="stopped-actions">
              <button class="btn-secondary" (click)="startOver()">Grabar de nuevo</button>
              <button class="btn-primary" (click)="processAudio()">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <circle cx="12" cy="12" r="3" fill="currentColor"/>
                </svg>
                Generar historia clínica
              </button>
            </div>
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

          <!-- Campos editables -->
          <div class="fields-grid">
            <div class="field">
              <label>Motivo de consulta</label>
              <textarea [(ngModel)]="history().motivo_consulta" rows="2"></textarea>
            </div>
            <div class="field">
              <label>Enfermedad actual</label>
              <textarea [(ngModel)]="history().enfermedad_actual" rows="3"></textarea>
            </div>
            <div class="field">
              <label>Antecedentes personales</label>
              <textarea [(ngModel)]="history().antecedentes_personales" rows="2"></textarea>
            </div>
            <div class="field">
              <label>Antecedentes familiares</label>
              <textarea [(ngModel)]="history().antecedentes_familiares" rows="2"></textarea>
            </div>
            <div class="field full">
              <label>Signos vitales</label>
              <div class="signos-grid">
                <label class="signo">
                  <span>TA</span>
                  <input [(ngModel)]="history().signos_vitales.tension_arterial" placeholder="120/80" />
                </label>
                <label class="signo">
                  <span>FC</span>
                  <input [(ngModel)]="history().signos_vitales.frecuencia_cardiaca" placeholder="72 lpm" />
                </label>
                <label class="signo">
                  <span>Temp</span>
                  <input [(ngModel)]="history().signos_vitales.temperatura" placeholder="36.5°C" />
                </label>
                <label class="signo">
                  <span>Peso</span>
                  <input [(ngModel)]="history().signos_vitales.peso" placeholder="75 kg" />
                </label>
                <label class="signo">
                  <span>Talla</span>
                  <input [(ngModel)]="history().signos_vitales.talla" placeholder="1.70 m" />
                </label>
                <label class="signo">
                  <span>SatO2</span>
                  <input [(ngModel)]="history().signos_vitales.saturacion" placeholder="98%" />
                </label>
              </div>
            </div>
            <div class="field">
              <label>Examen físico</label>
              <textarea [(ngModel)]="history().examen_fisico" rows="3"></textarea>
            </div>
            <div class="field">
              <label>Diagnóstico</label>
              <textarea [(ngModel)]="history().diagnostico" rows="2"></textarea>
            </div>
            <div class="field">
              <label>Plan terapéutico</label>
              <textarea [(ngModel)]="history().plan_terapeutico" rows="3"></textarea>
            </div>
            <div class="field">
              <label>Estudios complementarios</label>
              <textarea [(ngModel)]="history().estudios_complementarios" rows="2"></textarea>
            </div>
            <div class="field">
              <label>Observaciones</label>
              <textarea [(ngModel)]="history().observaciones" rows="2"></textarea>
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
      background: #4f46e5; color: white; cursor: pointer;
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
      width: 4px; background: #4f46e5; border-radius: 2px;
      animation: wave 0.5s ease-in-out infinite alternate;
      animation-delay: calc(var(--i) * 0.05s);
    }
    @keyframes wave { to { transform: scaleY(0.3); } }
    .record-hint { font-size: 13px; color: #9ca3af; max-width: 480px; margin: 0 auto; line-height: 1.6; }

    .stopped-visual {
      width: 80px; height: 80px; background: #f0fdf4; border-radius: 50%;
      display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;
    }
    .stopped-actions { display: flex; gap: 12px; justify-content: center; margin-top: 24px; }

    /* ── Processing ── */
    .processing-card {
      background: white; border-radius: 20px; padding: 48px;
      text-align: center; box-shadow: 0 2px 12px rgba(0,0,0,0.06);
    }
    .processing-spinner {
      width: 56px; height: 56px; border: 4px solid #e5e7eb;
      border-top-color: #4f46e5; border-radius: 50%;
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
    .step.active { background: #eef2ff; color: #4f46e5; font-weight: 600; }
    .step.done { background: #f0fdf4; color: #166534; }
    .step-icon {
      width: 24px; height: 24px; border-radius: 50%; background: #e5e7eb;
      display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; flex-shrink: 0;
    }
    .step.active .step-icon { background: #4f46e5; color: white; }
    .step.done .step-icon { background: #22c55e; color: white; }

    /* ── Review ── */
    .review-section { display: flex; flex-direction: column; gap: 20px; }
    .review-banner {
      display: flex; align-items: center; gap: 10px;
      background: #fffbeb; color: #92400e; border: 1px solid #fde68a;
      border-radius: 10px; padding: 12px 16px; font-size: 14px;
    }
    .fields-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 16px;
      background: white; border-radius: 16px; padding: 24px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.06);
    }
    .field { display: flex; flex-direction: column; gap: 6px; }
    .field.full { grid-column: 1 / -1; }
    .field label { font-size: 13px; font-weight: 600; color: #374151; }
    textarea {
      padding: 10px; border: 1.5px solid #e5e7eb; border-radius: 8px;
      font-size: 14px; resize: vertical; outline: none; font-family: inherit;
    }
    textarea:focus { border-color: #4f46e5; }
    .signos-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 6px; }
    .signo { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: #6b7280; }
    .signo input {
      padding: 8px; border: 1.5px solid #e5e7eb; border-radius: 8px;
      font-size: 14px; outline: none;
    }
    .signo input:focus { border-color: #4f46e5; }
    .review-actions { display: flex; gap: 12px; justify-content: flex-end; }

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
      padding: 12px 24px; background: #4f46e5; color: white;
      border: none; border-radius: 10px; font-size: 14px; font-weight: 600;
      cursor: pointer; display: flex; align-items: center; gap: 8px;
    }
    .btn-primary:hover:not(:disabled) { background: #4338ca; }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-secondary {
      padding: 12px 24px; background: #f3f4f6; color: #374151;
      border: none; border-radius: 10px; font-size: 14px; font-weight: 500; cursor: pointer;
    }
    .spinner-sm {
      width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.4);
      border-top-color: white; border-radius: 50%; animation: spin 0.7s linear infinite;
    }
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

  patientId = this.route.snapshot.params['patientId'] || '';

  state = signal<RecordingState>('idle');
  error = signal('');
  processingMessage = signal('Transcribiendo audio con Whisper...');
  processingStep = signal(0);
  elapsedSeconds = signal(0);
  waveHeights = signal<number[]>(Array.from({ length: 20 }, () => 8));

  history = signal<ClinicalHistory>({
    patient_id: this.patientId,
    ...EMPTY_CLINICAL_HISTORY,
    signos_vitales: { ...EMPTY_SIGNOS_VITALES }
  });

  private mediaRecorder: MediaRecorder | null = null;
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
      this.audioChunks = [];
      this.mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.audioChunks.push(e.data);
      };

      this.mediaRecorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        this.processAudio();
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
    // Cambiar estado inmediatamente para evitar doble click
    this.mediaRecorder!.onstop = () => {
      this.audioChunks = [...this.audioChunks]; // flush
      this.state.set('stopped');
    };
    this.mediaRecorder?.stop();
  }

  processAudio() {
    if (!this.audioChunks.length) return;
    this.state.set('processing');
    this.processingStep.set(0);
    this.processingMessage.set('Transcribiendo audio con Whisper...');

    const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });

    const stepTimer = setTimeout(() => {
      this.processingStep.set(1);
      this.processingMessage.set('Estructurando historia clínica con IA...');
    }, 3000);

    this.api.transcribeAndStructure(audioBlob).subscribe({
      next: (result) => {
        clearTimeout(stepTimer);
        try {
          const ch = result.clinical_history || result || {};
          this.history.set({
            patient_id: this.patientId,
            nombre_paciente: ch.nombre_paciente || '',
            motivo_consulta: ch.motivo_consulta || '',
            enfermedad_actual: ch.enfermedad_actual || '',
            antecedentes_personales: ch.antecedentes_personales || '',
            antecedentes_familiares: ch.antecedentes_familiares || '',
            examen_fisico: ch.examen_fisico || '',
            signos_vitales: ch.signos_vitales || { ...EMPTY_SIGNOS_VITALES },
            diagnostico: ch.diagnostico || '',
            plan_terapeutico: ch.plan_terapeutico || '',
            estudios_complementarios: ch.estudios_complementarios || '',
            observaciones: ch.observaciones || '',
            transcripcion_original: result.transcription || ch.transcripcion_original || '',
            verificada: false
          });
          this.processingStep.set(2);
          this.state.set('reviewing');
        } catch (e) {
          this.error.set('Error al procesar la respuesta del servidor. Intentá de nuevo.');
          this.state.set('stopped');
        }
      },
      error: (err) => {
        clearTimeout(stepTimer);
        this.error.set(err.error?.detail || 'Error al procesar el audio. Intentá de nuevo.');
        this.state.set('stopped');
      }
    });
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
  }
}

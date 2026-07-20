import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from './api.service';

export type VoiceStatus = 'idle' | 'listening' | 'processing' | 'speaking';

@Injectable({ providedIn: 'root' })
export class VoiceCommandService {
  private api = inject(ApiService);
  private router = inject(Router);

  active = signal(false);
  status = signal<VoiceStatus>('idle');
  lastText = signal('');
  lastResponse = signal('');

  private stream?: MediaStream;
  private audioCtx?: AudioContext;
  private analyser?: AnalyserNode;
  private mediaRecorder?: MediaRecorder;
  private chunks: Blob[] = [];
  private silenceTimer?: ReturnType<typeof setTimeout>;
  private bubbleTimer?: ReturnType<typeof setTimeout>;
  private hasSpeech = false;
  private rafId?: number;

  async toggle() {
    this.active() ? this.stop() : await this.start();
  }

  private async start() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      alert('No se pudo acceder al micrófono. Verificá los permisos del navegador.');
      return;
    }
    this.audioCtx = new AudioContext();
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 512;
    const src = this.audioCtx.createMediaStreamSource(this.stream);
    src.connect(this.analyser);
    this.active.set(true);
    this._record();
  }

  private _record() {
    if (!this.active() || !this.stream) return;
    this.chunks = [];
    this.hasSpeech = false;
    this.mediaRecorder = new MediaRecorder(this.stream);
    this.mediaRecorder.ondataavailable = e => { if (e.data.size > 0) this.chunks.push(e.data); };
    this.mediaRecorder.onstop = () => this._onStop();
    this.mediaRecorder.start(100);
    this.status.set('listening');
    this._watchSilence();
  }

  private _watchSilence() {
    if (!this.analyser) return;
    const data = new Uint8Array(this.analyser.frequencyBinCount);

    const tick = () => {
      if (!this.active() || this.status() !== 'listening') return;
      this.analyser!.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / data.length;

      if (avg > 12) {
        this.hasSpeech = true;
        clearTimeout(this.silenceTimer);
        this.silenceTimer = setTimeout(() => {
          if (this.mediaRecorder?.state === 'recording') this.mediaRecorder.stop();
        }, 5000);
      }
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private async _onStop() {
    cancelAnimationFrame(this.rafId!);
    if (!this.hasSpeech || this.chunks.length === 0) {
      if (this.active()) this._record();
      return;
    }

    this.status.set('processing');
    const blob = new Blob(this.chunks, { type: 'audio/webm' });

    this.api.transcribeChunk(blob).subscribe({
      next: (res) => {
        const text = res.text?.trim();
        if (!text) { if (this.active()) this._record(); return; }
        this.lastText.set(text);
        this.api.interpretVoiceCommand(text).subscribe({
          next: async (interpreted) => {
            this.lastResponse.set(interpreted.respuesta || '');
            await this._runActions(interpreted.acciones || []);
            this._finalize(interpreted.respuesta || '');
          },
          error: () => this._finalize('Ocurrió un error al procesar el comando.')
        });
      },
      error: () => { if (this.active()) this._record(); }
    });
  }

  private _finalize(response: string) {
    // Detiene el hardware inmediatamente, sin esperar al TTS
    this._stopHardware();
    this.active.set(false);
    this.status.set('idle');

    // Mantiene el globo visible 5 segundos para que el usuario vea qué pasó
    clearTimeout(this.bubbleTimer);
    this.bubbleTimer = setTimeout(() => {
      this.lastText.set('');
      this.lastResponse.set('');
    }, 5000);

    // TTS como bonus (no bloquea nada)
    if (response && 'speechSynthesis' in window) {
      speechSynthesis.cancel();
      const utt = new SpeechSynthesisUtterance(response);
      utt.lang = 'es-AR';
      utt.rate = 1.05;
      speechSynthesis.speak(utt);
    }
  }

  private async _runActions(acciones: any[]) {
    for (const a of acciones) await this._runOne(a);
  }

  private _findPatient(nombre: string): Promise<any | null> {
    return new Promise(resolve => {
      this.api.getPatients().subscribe({
        next: (patients) => {
          const q = nombre.toLowerCase();
          const found = patients.find((p: any) =>
            `${p.nombre} ${p.apellido}`.toLowerCase().includes(q) ||
            p.apellido.toLowerCase().includes(q) ||
            p.nombre.toLowerCase().includes(q)
          );
          resolve(found || null);
        },
        error: () => resolve(null)
      });
    });
  }

  private _runOne(a: any): Promise<void> {
    return new Promise(async resolve => {
      switch (a.tipo) {

        case 'navegar_pacientes':
          this.router.navigate(['/professional/patients']); resolve(); break;

        case 'navegar_evaluaciones':
          this.router.navigate(['/professional/evaluations']); resolve(); break;

        case 'navegar_turnos':
          this.router.navigate(['/professional/appointments']); resolve(); break;

        case 'navegar_inicio':
          this.router.navigate(['/professional']); resolve(); break;

        case 'buscar_y_abrir_paciente': {
          const patient = await this._findPatient(a.params?.nombre || '');
          if (patient) this.router.navigate(['/professional/patients', patient.id]);
          resolve();
          break;
        }

        case 'crear_paciente':
          this.api.createPatient(a.params || {}).subscribe({
            next: (p: any) => { this.router.navigate(['/professional/patients', p.id]); resolve(); },
            error: () => resolve()
          });
          break;

        case 'crear_historia_voz': {
          const params = a.params || {};
          const patient = await this._findPatient(params.patient_name || '');
          if (!patient) { resolve(); break; }

          this.api.structureText(params.transcription || '').subscribe({
            next: (res) => {
              const historia = res.clinical_history || res;
              historia.patient_id = patient.id;
              this.api.saveClinicalHistory(historia).subscribe({
                next: () => {
                  this.router.navigate(['/professional/patients', patient.id, 'histories']);
                  resolve();
                },
                error: () => resolve()
              });
            },
            error: () => resolve()
          });
          break;
        }

        case 'crear_rutina_voz': {
          const params = a.params || {};
          const patient = await this._findPatient(params.patient_name || '');
          if (!patient) { resolve(); break; }

          const payload = {
            patient_id: patient.id,
            titulo: params.titulo || 'Nueva rutina',
            descripcion: params.descripcion || '',
            circuitos: params.circuitos || [],
            observaciones: params.observaciones || '',
          };

          this.api.createRoutine(payload).subscribe({
            next: () => {
              this.router.navigate(['/professional/patients', patient.id, 'routines']);
              resolve();
            },
            error: () => resolve()
          });
          break;
        }

        case 'crear_evaluacion': {
          const params = a.params || {};
          const patient = await this._findPatient(params.patient_name || '');
          if (!patient) { resolve(); break; }

          const today = new Date().toISOString().split('T')[0];
          const payload = {
            patient_id: patient.id,
            nombre: params.nombre || 'Evaluación',
            fecha: params.fecha === 'hoy' ? today : (params.fecha || today),
            observaciones: params.observaciones || '',
            medidas: params.medidas || [],
          };

          this.api.createEvaluation(payload).subscribe({
            next: () => {
              this.router.navigate(['/professional/patients', patient.id, 'evaluations']);
              resolve();
            },
            error: () => resolve()
          });
          break;
        }

        default:
          resolve();
      }
    });
  }

  private _stopHardware() {
    clearTimeout(this.silenceTimer);
    cancelAnimationFrame(this.rafId!);
    speechSynthesis.cancel();
    try { this.mediaRecorder?.stop(); } catch {}
    this.stream?.getTracks().forEach(t => t.stop());
    this.audioCtx?.close();
    this.stream = undefined;
    this.audioCtx = undefined;
    this.analyser = undefined;
    this.mediaRecorder = undefined;
  }

  stop() {
    clearTimeout(this.bubbleTimer);
    this._stopHardware();
    this.active.set(false);
    this.status.set('idle');
    this.lastText.set('');
    this.lastResponse.set('');
  }
}

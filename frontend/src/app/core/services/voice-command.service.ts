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
        }, 1600);
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
            this._speak(interpreted.respuesta || '');
          },
          error: () => {
            this._speak('Ocurrió un error al procesar el comando.');
          }
        });
      },
      error: () => { if (this.active()) this._record(); }
    });
  }

  private async _runActions(acciones: any[]) {
    for (const a of acciones) await this._runOne(a);
  }

  private _runOne(a: any): Promise<void> {
    return new Promise(resolve => {
      switch (a.tipo) {
        case 'navegar_pacientes':
          this.router.navigate(['/professional/patients']); resolve(); break;
        case 'navegar_evaluaciones':
          this.router.navigate(['/professional/evaluations']); resolve(); break;
        case 'navegar_turnos':
          this.router.navigate(['/professional/appointments']); resolve(); break;
        case 'navegar_inicio':
          this.router.navigate(['/professional']); resolve(); break;
        case 'buscar_y_abrir_paciente':
          this.api.getPatients().subscribe({
            next: (patients) => {
              const q = (a.params?.nombre || '').toLowerCase();
              const found = patients.find((p: any) =>
                `${p.nombre} ${p.apellido}`.toLowerCase().includes(q) ||
                p.apellido.toLowerCase().includes(q)
              );
              if (found) this.router.navigate(['/professional/patients', found.id]);
              resolve();
            },
            error: () => resolve()
          });
          break;
        case 'crear_paciente':
          this.api.createPatient(a.params || {}).subscribe({
            next: (p: any) => { this.router.navigate(['/professional/patients', p.id]); resolve(); },
            error: () => resolve()
          });
          break;
        default:
          resolve();
      }
    });
  }

  private _speak(text: string) {
    if (!text) { if (this.active()) this._record(); return; }
    speechSynthesis.cancel();
    this.status.set('speaking');
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = 'es-AR';
    utt.rate = 1.05;
    utt.onend = () => { if (this.active()) this._record(); };
    utt.onerror = () => { if (this.active()) this._record(); };
    speechSynthesis.speak(utt);
  }

  stop() {
    this.active.set(false);
    this.status.set('idle');
    this.lastText.set('');
    this.lastResponse.set('');
    clearTimeout(this.silenceTimer);
    cancelAnimationFrame(this.rafId!);
    speechSynthesis.cancel();
    try { this.mediaRecorder?.stop(); } catch {}
    this.stream?.getTracks().forEach(t => t.stop());
    this.audioCtx?.close();
  }
}

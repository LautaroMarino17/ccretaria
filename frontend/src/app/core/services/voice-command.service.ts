import { Injectable, NgZone, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from './api.service';

export type VoiceStatus = 'idle' | 'listening' | 'processing';

@Injectable({ providedIn: 'root' })
export class VoiceCommandService {
  private api    = inject(ApiService);
  private router = inject(Router);
  private zone   = inject(NgZone);

  active               = signal(false);
  status               = signal<VoiceStatus>('idle');
  lastText             = signal('');
  lastResponse         = signal('');
  lastPatient          = signal<any | null>(null);
  awaitingConfirmation = signal(false);
  confirmationText     = signal('');

  private stream?:        MediaStream;
  private audioCtx?:      AudioContext;
  private analyser?:      AnalyserNode;
  private mediaRecorder?: MediaRecorder;
  private chunks:         Blob[] = [];
  private silenceTimer?:  ReturnType<typeof setTimeout>;
  private bubbleTimer?:   ReturnType<typeof setTimeout>;
  private processingTimer?: ReturnType<typeof setTimeout>;
  private hasSpeech = false;
  private rafId?:    number;

  private _pendingActions:  any[]  = [];
  private _pendingResponse  = '';
  private _runtimeError     = '';

  getAnalyser(): AnalyserNode | undefined { return this.analyser; }

  async toggle() {
    if (this.awaitingConfirmation()) return;
    this.active() ? this.stop() : await this.start();
  }

  // ── Arranque ────────────────────────────────────────────────────────────────
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
    this.audioCtx.createMediaStreamSource(this.stream).connect(this.analyser);
    this.active.set(true);
    this._record();
  }

  private _record() {
    if (!this.active() || !this.stream) return;
    this.chunks    = [];
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
        }, 2000);
      }
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  // ── Proceso tras silencio ────────────────────────────────────────────────────
  private async _onStop() {
    cancelAnimationFrame(this.rafId!);
    if (!this.hasSpeech || this.chunks.length === 0) {
      if (this.active()) this._record();
      return;
    }

    this.status.set('processing');
    const blob = new Blob(this.chunks, { type: 'audio/webm' });

    this.processingTimer = setTimeout(() => {
      if (this.status() === 'processing') this.zone.run(() => this._finalize(''));
    }, 30000);

    this.api.transcribeChunk(blob).subscribe({
      next: (res) => {
        const text = res.text?.trim();
        if (!text) { if (this.active()) this._record(); return; }
        this.lastText.set(text);

        const ctx = this.lastPatient()
          ? { last_patient: { id: this.lastPatient().id, name: `${this.lastPatient().apellido || ''} ${this.lastPatient().nombre || ''}`.trim() } }
          : undefined;

        this.api.interpretVoiceCommand(text, ctx).subscribe({
          next: async (interpreted) => {
            this.lastResponse.set(interpreted.respuesta || '');

            // Caso: el LLM pide confirmación antes de ejecutar
            if (interpreted.requiere_confirmacion) {
              this._pendingActions  = interpreted.acciones || [];
              this._pendingResponse = interpreted.respuesta || '';
              this.zone.run(() => {
                clearTimeout(this.processingTimer);
                this._stopHardware();
                this.active.set(false);
                this.status.set('idle');
                this.confirmationText.set(interpreted.confirmacion_texto || interpreted.respuesta || '');
                this.awaitingConfirmation.set(true);
                this._speak(interpreted.respuesta || '');
              });
              return;
            }

            await this._runActions(interpreted.acciones || []);
            this.zone.run(() => {
              this._finalize(this._runtimeError || interpreted.respuesta || '');
              this._runtimeError = '';
            });
          },
          error: () => this.zone.run(() => this._finalize('Ocurrió un error al procesar el comando.'))
        });
      },
      error: () => { if (this.active()) this._record(); }
    });
  }

  // ── Confirmación ─────────────────────────────────────────────────────────────
  async confirmAction(yes: boolean) {
    this.awaitingConfirmation.set(false);
    this.confirmationText.set('');

    if (yes) {
      await this._runActions(this._pendingActions);
      this._finalize(this._runtimeError || this._pendingResponse || 'Listo.');
      this._runtimeError = '';
    } else {
      this._speak('Cancelado.');
      clearTimeout(this.bubbleTimer);
      this.bubbleTimer = setTimeout(() => { this.lastText.set(''); this.lastResponse.set(''); }, 5000);
    }
    this._pendingActions  = [];
    this._pendingResponse = '';
  }

  // ── Finalización ─────────────────────────────────────────────────────────────
  private _finalize(response: string) {
    clearTimeout(this.processingTimer);
    this._stopHardware();
    this.active.set(false);
    this.status.set('idle');
    if (response) this.lastResponse.set(response);

    clearTimeout(this.bubbleTimer);
    this.bubbleTimer = setTimeout(() => {
      this.lastText.set('');
      this.lastResponse.set('');
    }, 5000);

    this._speak(response);
  }

  private _speak(text: string) {
    if (!text || !('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const utt  = new SpeechSynthesisUtterance(text);
    utt.lang   = 'es-AR';
    utt.rate   = 1.05;
    utt.pitch  = 1.1;

    const trySpeak = () => {
      const voices = speechSynthesis.getVoices();
      const FEMALE_NAMES = ['paulina','monica','helena','laura','sabina','maría','maria','sofia','sofía','valentina','luciana','camila','google'];
      const female = voices.find(v =>
        v.lang.startsWith('es') && FEMALE_NAMES.some(n => v.name.toLowerCase().includes(n))
      ) || voices.find(v => v.lang === 'es-AR')
        || voices.find(v => v.lang.startsWith('es'));
      if (female) utt.voice = female;
      speechSynthesis.speak(utt);
    };

    const voices = speechSynthesis.getVoices();
    if (voices.length) { trySpeak(); }
    else { speechSynthesis.onvoiceschanged = () => { trySpeak(); speechSynthesis.onvoiceschanged = null; }; }
  }

  // ── Acciones ─────────────────────────────────────────────────────────────────
  private async _runActions(acciones: any[]) {
    for (const a of acciones) await this._runOne(a);
  }

  private _findPatient(nombre: string): Promise<any | null> {
    return new Promise(resolve => {
      if (!nombre.trim() && this.lastPatient()) {
        resolve(this.lastPatient());
        return;
      }
      this.api.getPatients().subscribe({
        next: (patients) => {
          const q = nombre.toLowerCase().trim();
          const found = patients.find((p: any) =>
            `${p.nombre} ${p.apellido}`.toLowerCase().includes(q) ||
            (p.apellido || '').toLowerCase().includes(q) ||
            (p.nombre  || '').toLowerCase().includes(q)
          ) || null;
          if (found) this.lastPatient.set(found);
          resolve(found);
        },
        error: () => resolve(null)
      });
    });
  }

  private _notFound(name: string) {
    this._runtimeError = `No encontré al paciente "${name}". Revisá el nombre e intentá de nuevo.`;
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
          if (!patient) this._notFound(a.params?.nombre || '');
          else this.router.navigate(['/professional/patients', patient.id]);
          resolve(); break;
        }

        case 'crear_paciente':
          this.api.createPatient(a.params || {}).subscribe({
            next: (p: any) => { this.router.navigate(['/professional/patients', p.id]); resolve(); },
            error: () => resolve()
          });
          break;

        case 'crear_turno': {
          const p = a.params || {};
          const patient = await this._findPatient(p.patient_name || '');
          if (!patient) { this._notFound(p.patient_name || ''); resolve(); break; }
          this.api.assignAppointment({
            patient_id:       patient.id,
            patient_name:     `${patient.apellido || ''}, ${patient.nombre || ''}`.trim(),
            datetime_iso:     p.datetime_iso,
            duration_minutes: p.duration_minutes || 30,
            notes:            p.notes  || '',
            lugar:            p.lugar  || '',
            tipo:             p.tipo   || 'consulta',
          }).subscribe({
            next: () => { this.router.navigate(['/professional/appointments']); resolve(); },
            error: () => resolve()
          });
          break;
        }

        case 'crear_historia_voz': {
          const p = a.params || {};
          const patient = await this._findPatient(p.patient_name || '');
          if (!patient) { this._notFound(p.patient_name || ''); resolve(); break; }
          this.api.structureText(p.transcription || '').subscribe({
            next: (res) => {
              const historia = res.clinical_history || res;
              historia.patient_id = patient.id;
              this.api.saveClinicalHistory(historia).subscribe({
                next: () => { this.router.navigate(['/professional/patients', patient.id, 'histories']); resolve(); },
                error: () => resolve()
              });
            },
            error: () => resolve()
          });
          break;
        }

        case 'crear_rutina_voz': {
          const p = a.params || {};
          const patient = await this._findPatient(p.patient_name || '');
          if (!patient) { this._notFound(p.patient_name || ''); resolve(); break; }
          this.api.createRoutine({
            patient_id:   patient.id,
            titulo:       p.titulo       || 'Nueva rutina',
            descripcion:  p.descripcion  || '',
            circuitos:    p.circuitos    || [],
            observaciones: p.observaciones || '',
          }).subscribe({
            next: () => { this.router.navigate(['/professional/patients', patient.id, 'routines']); resolve(); },
            error: () => resolve()
          });
          break;
        }

        case 'crear_evaluacion': {
          const p = a.params || {};
          const patient = await this._findPatient(p.patient_name || '');
          if (!patient) { this._notFound(p.patient_name || ''); resolve(); break; }
          const today = new Date().toISOString().split('T')[0];
          this.api.createEvaluation({
            patient_id:   patient.id,
            nombre:       p.nombre        || 'Evaluación',
            fecha:        p.fecha === 'hoy' ? today : (p.fecha || today),
            observaciones: p.observaciones || '',
            medidas:      p.medidas        || [],
          }).subscribe({
            next: () => { this.router.navigate(['/professional/patients', patient.id, 'evaluations']); resolve(); },
            error: () => resolve()
          });
          break;
        }

        default: resolve();
      }
    });
  }

  // ── Hardware ─────────────────────────────────────────────────────────────────
  private _stopHardware() {
    clearTimeout(this.silenceTimer);
    cancelAnimationFrame(this.rafId!);
    speechSynthesis.cancel();
    try { this.mediaRecorder?.stop(); } catch {}
    this.stream?.getTracks().forEach(t => t.stop());
    this.audioCtx?.close();
    this.stream        = undefined;
    this.audioCtx      = undefined;
    this.analyser      = undefined;
    this.mediaRecorder = undefined;
  }

  stop() {
    clearTimeout(this.bubbleTimer);
    clearTimeout(this.processingTimer);
    this._stopHardware();
    this.active.set(false);
    this.status.set('idle');
    this.lastText.set('');
    this.lastResponse.set('');
    this.awaitingConfirmation.set(false);
    this.confirmationText.set('');
    this._pendingActions = [];
  }
}

import { Component, inject, viewChild, ElementRef, effect, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VoiceCommandService } from '../../../core/services/voice-command.service';

@Component({
  selector: 'app-voice-button',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- ── Overlay a pantalla completa ── -->
    @if (vc.active() || vc.awaitingConfirmation()) {
      <div class="voice-overlay" [class.confirming]="vc.awaitingConfirmation()" (click)="onOverlayClick()">

        <div class="ov-inner" (click)="$event.stopPropagation()">

          <div class="ov-amalia-name">Amalia</div>

          @if (vc.status() === 'listening' && !vc.awaitingConfirmation()) {
            <div class="ov-status">
              <span class="status-dot"></span>
              <span>Escuchando...</span>
            </div>
          }
          @if (vc.status() === 'processing') {
            <div class="ov-status processing">
              <span class="ov-spinner"></span>
              <span>Procesando...</span>
            </div>
          }

          @if (vc.lastText() && vc.status() !== 'listening') {
            <div class="ov-heard">"{{ vc.lastText() }}"</div>
          }

          @if (vc.awaitingConfirmation()) {
            <div class="ov-confirm-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1.5">
                <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
              </svg>
            </div>
            <div class="ov-confirm-text">{{ vc.confirmationText() }}</div>
            <div class="ov-confirm-btns">
              <button class="btn-yes" (click)="vc.confirmAction(true)">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                Sí, confirmar
              </button>
              <button class="btn-no" (click)="vc.confirmAction(false)">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                Cancelar
              </button>
            </div>
          }
        </div>

        <!-- Ondas tipo Siri en la parte inferior -->
        @if (vc.status() === 'listening' && !vc.awaitingConfirmation()) {
          <canvas #waveCanvas class="wave-canvas"></canvas>
        }
      </div>
    }

    <!-- ── Botón flotante ── -->
    <div class="voice-fab-wrap">

      <!-- Burbuja post-acción (fuera del overlay) -->
      @if (!vc.active() && !vc.awaitingConfirmation() && (vc.lastText() || vc.lastResponse())) {
        <div class="voice-bubble">
          @if (vc.lastText()) { <span class="vb-heard">"{{ vc.lastText() }}"</span> }
          @if (vc.lastResponse()) { <span class="vb-text">{{ vc.lastResponse() }}</span> }
        </div>
      }

      <div class="amalia-label">Hablá con Amalia</div>

      <button
        class="voice-fab"
        [class.active]="vc.active() && vc.status() === 'listening'"
        [class.processing]="vc.status() === 'processing'"
        [class.confirming]="vc.awaitingConfirmation()"
        (click)="vc.toggle()"
        [title]="vc.active() ? 'Detener a Amalia' : 'Hablá con Amalia'">

        @if (vc.status() === 'processing') {
          <span class="fab-spinner"></span>
        } @else if (vc.awaitingConfirmation()) {
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
          </svg>
        } @else {
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
        }

        @if (vc.active() && vc.status() === 'listening') {
          <span class="pulse-ring"></span>
        }
      </button>
    </div>
  `,
  styles: [`
    /* ─── Overlay ────────────────────────────────────────────────────────────── */
    .voice-overlay {
      position: fixed;
      inset: 0;
      background: rgba(5, 10, 5, 0.72);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      z-index: 9000;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      animation: fadeIn 0.18s ease;
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

    .voice-overlay.confirming { background: rgba(5, 10, 5, 0.82); }

    .ov-inner {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 22px;
      padding: 0 28px 80px;
      max-width: 440px;
      width: 100%;
      text-align: center;
    }

    /* Nombre Amalia en overlay */
    .ov-amalia-name {
      font-size: 38px;
      font-weight: 800;
      letter-spacing: 6px;
      text-transform: uppercase;
      color: transparent;
      background: linear-gradient(135deg, #8cc63f 0%, #c8e86a 50%, #8cc63f 100%);
      -webkit-background-clip: text;
      background-clip: text;
      animation: shimmer 3s ease infinite;
      background-size: 200% auto;
      margin-bottom: 4px;
    }
    @keyframes shimmer {
      0%   { background-position: 0% center; }
      50%  { background-position: 100% center; }
      100% { background-position: 0% center; }
    }

    /* Status */
    .ov-status {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 22px;
      font-weight: 700;
      color: white;
      letter-spacing: 0.2px;
    }
    .ov-status.processing { color: rgba(255,255,255,0.85); }

    .status-dot {
      width: 13px; height: 13px;
      background: #ef4444;
      border-radius: 50%;
      flex-shrink: 0;
      animation: blink 1s ease infinite;
    }
    @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.15} }

    .ov-spinner {
      width: 20px; height: 20px;
      border: 2.5px solid rgba(255,255,255,0.2);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
      flex-shrink: 0;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .ov-heard {
      font-size: 15px;
      color: rgba(255,255,255,0.5);
      font-style: italic;
    }

    /* Confirmación */
    .ov-confirm-icon { opacity: 0.6; }

    .ov-confirm-text {
      font-size: 19px;
      font-weight: 500;
      color: white;
      line-height: 1.55;
      max-width: 360px;
    }

    .ov-confirm-btns {
      display: flex;
      gap: 14px;
      flex-wrap: wrap;
      justify-content: center;
    }
    .btn-yes, .btn-no {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 13px 26px;
      border: none;
      border-radius: 14px;
      font-size: 15px;
      font-weight: 700;
      cursor: pointer;
      transition: transform 0.12s, opacity 0.15s;
    }
    .btn-yes {
      background: #8cc63f;
      color: white;
      box-shadow: 0 4px 18px rgba(140,198,63,0.4);
    }
    .btn-no {
      background: rgba(255,255,255,0.1);
      color: white;
      border: 1.5px solid rgba(255,255,255,0.25);
    }
    .btn-yes:hover { opacity: 0.88; transform: scale(1.04); }
    .btn-no:hover  { background: rgba(255,255,255,0.18); transform: scale(1.04); }

    /* Ondas Siri */
    .wave-canvas {
      position: absolute;
      bottom: 0;
      left: 0;
      width: 100%;
      height: 120px;
      pointer-events: none;
    }

    /* ─── FAB ────────────────────────────────────────────────────────────────── */
    .voice-fab-wrap {
      position: fixed;
      bottom: 28px;
      right: 28px;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 10px;
      z-index: 9100;
    }

    .voice-fab {
      position: relative;
      width: 56px; height: 56px;
      border-radius: 50%;
      border: none;
      background: #16a34a;
      color: white;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 18px rgba(22,163,74,0.4);
      transition: background 0.2s, transform 0.15s, box-shadow 0.2s;
    }
    .voice-fab:hover      { background: #15803d; transform: scale(1.06); }
    .voice-fab.active     { background: #dc2626; box-shadow: 0 4px 18px rgba(220,38,38,0.45); }
    .voice-fab.active:hover { background: #b91c1c; }
    .voice-fab.processing { background: #d97706; box-shadow: 0 4px 18px rgba(217,119,6,0.4); }
    .voice-fab.confirming { background: #7c3aed; box-shadow: 0 4px 18px rgba(124,58,237,0.45); }

    .pulse-ring {
      position: absolute; inset: -5px;
      border-radius: 50%;
      border: 3px solid rgba(239,68,68,0.7);
      animation: pulse 1.4s ease-out infinite;
      pointer-events: none;
    }
    @keyframes pulse { 0%{transform:scale(1);opacity:1} 100%{transform:scale(1.6);opacity:0} }

    .fab-spinner {
      width: 22px; height: 22px;
      border: 2.5px solid rgba(255,255,255,0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }

    /* Etiqueta "Hablá con Amalia" junto al botón */
    .amalia-label {
      font-size: 11px;
      font-weight: 700;
      color: #6b7280;
      letter-spacing: 0.5px;
      text-align: right;
      padding-right: 4px;
      opacity: 0.85;
      transition: opacity 0.2s;
      white-space: nowrap;
    }
    .voice-fab-wrap:hover .amalia-label { opacity: 1; color: #16a34a; }

    /* ─── Burbuja post-acción ────────────────────────────────────────────────── */
    .voice-bubble {
      background: white;
      border-radius: 14px;
      padding: 10px 14px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.13);
      max-width: 260px;
      display: flex;
      flex-direction: column;
      gap: 3px;
      border-left: 3px solid #8cc63f;
      animation: slideUp 0.2s ease;
    }
    @keyframes slideUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
    .vb-text  { font-size: 13px; color: #111827; line-height: 1.4; }
    .vb-heard { font-size: 12px; color: #6b7280; font-style: italic; }

    @media (max-width: 640px) {
      .voice-fab-wrap { bottom: 20px; right: 16px; }
      .ov-confirm-text { font-size: 16px; }
    }
  `]
})
export class VoiceButtonComponent implements OnDestroy {
  vc = inject(VoiceCommandService);

  waveCanvas = viewChild<ElementRef<HTMLCanvasElement>>('waveCanvas');

  private _rafId?: number;
  private _t = 0;

  constructor() {
    effect(() => {
      const status = this.vc.status();
      if (status === 'listening') {
        setTimeout(() => {
          const el = this.waveCanvas()?.nativeElement;
          if (el) this._startWave(el);
        }, 60);
      } else {
        this._stopWave();
      }
    });
  }

  ngOnDestroy() { this._stopWave(); }

  onOverlayClick() {
    if (!this.vc.awaitingConfirmation()) this.vc.toggle();
  }

  // ── Animación de ondas tipo Siri ─────────────────────────────────────────────
  private _startWave(canvas: HTMLCanvasElement) {
    this._stopWave();
    this._t = 0;
    canvas.width  = window.innerWidth;
    canvas.height = 120;
    const ctx = canvas.getContext('2d')!;
    const W = canvas.width, H = canvas.height;

    const waves = [
      { color: 'rgba(140,198,63,0.90)', phOff: 0,              freq: 0.020, spd: 0.038, amMult: 1.00 },
      { color: 'rgba(80,168,30,0.60)',  phOff: Math.PI * 0.65, freq: 0.015, spd: 0.028, amMult: 0.78 },
      { color: 'rgba(195,235,90,0.48)', phOff: Math.PI * 1.30, freq: 0.028, spd: 0.052, amMult: 0.65 },
      { color: 'rgba(38,120,12,0.38)',  phOff: Math.PI * 0.35, freq: 0.012, spd: 0.022, amMult: 0.52 },
    ];

    const draw = () => {
      if (!this.vc.active()) return;
      this._rafId = requestAnimationFrame(draw);
      this._t++;

      const analyser = this.vc.getAnalyser();
      let amp = 0.18;
      if (analyser) {
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        amp = Math.max(0.12, Math.min(0.78, avg / 62));
      }

      ctx.clearRect(0, 0, W, H);

      for (const w of waves) {
        ctx.beginPath();
        ctx.strokeStyle = w.color;
        ctx.lineWidth   = 2.8;
        ctx.lineJoin    = 'round';

        for (let x = 0; x <= W; x += 3) {
          const y = H * 0.42
            + Math.sin(x * w.freq + this._t * w.spd + w.phOff)
            * amp * H * w.amMult * 0.72;
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    };
    draw();
  }

  private _stopWave() {
    if (this._rafId !== undefined) {
      cancelAnimationFrame(this._rafId);
      this._rafId = undefined;
    }
  }
}

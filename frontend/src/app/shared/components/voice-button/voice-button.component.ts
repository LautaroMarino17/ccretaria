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
      <div class="voice-overlay" (click)="onOverlayClick()">
        <div class="ov-inner" (click)="$event.stopPropagation()">

          <div class="ov-amalia-name">Amalia</div>

          <canvas #waveCanvas class="sphere-canvas" width="300" height="300"></canvas>

          @if (vc.status() === 'listening' && !vc.awaitingConfirmation()) {
            <div class="ov-status">
              <span class="status-dot"></span>
              Escuchando...
            </div>
          }
          @if (vc.status() === 'processing') {
            <div class="ov-status">
              <span class="ov-spinner"></span>
              Procesando...
            </div>
          }

          @if (vc.lastText() && vc.status() !== 'listening') {
            <div class="ov-heard">"{{ vc.lastText() }}"</div>
          }

          @if (vc.awaitingConfirmation()) {
            <div class="ov-confirm-text">{{ vc.confirmationText() }}</div>
            <div class="ov-confirm-btns">
              <button class="btn-yes" (click)="vc.confirmAction(true)">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                Confirmar
              </button>
              <button class="btn-no" (click)="vc.confirmAction(false)">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                Cancelar
              </button>
            </div>
          }

        </div>
      </div>
    }

    <!-- ── Botón flotante ── -->
    <div class="voice-fab-wrap">

      @if (!vc.active() && !vc.awaitingConfirmation() && (vc.lastText() || vc.lastResponse())) {
        <div class="voice-bubble">
          @if (vc.lastText())    { <span class="vb-heard">"{{ vc.lastText() }}"</span> }
          @if (vc.lastResponse()) { <span class="vb-text">{{ vc.lastResponse() }}</span> }
        </div>
      }

      <button
        class="voice-fab"
        [class.rec]="vc.active() && vc.status() === 'listening'"
        [class.proc]="vc.status() === 'processing'"
        [class.conf]="vc.awaitingConfirmation()"
        (click)="vc.toggle()"
        title="Hablá con Amalia">

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
    /* ─── Overlay ──────────────────────────────────────────────────────────── */
    .voice-overlay {
      position: fixed;
      inset: 0;
      background: rgba(2, 8, 2, 0.90);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      z-index: 9000;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: fadeIn 0.2s ease;
    }
    @keyframes fadeIn { from{opacity:0} to{opacity:1} }

    .ov-inner {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
      padding: 0 24px;
      text-align: center;
    }

    /* ─── Nombre Amalia ────────────────────────────────────────────────────── */
    .ov-amalia-name {
      font-size: 34px;
      font-weight: 800;
      letter-spacing: 10px;
      text-transform: uppercase;
      color: transparent;
      background: linear-gradient(90deg, #4ade80, #a3e635, #86efac, #4ade80);
      background-size: 300% auto;
      -webkit-background-clip: text;
      background-clip: text;
      animation: shimmer 4s linear infinite;
      margin-bottom: -8px;
    }
    @keyframes shimmer { to { background-position: 300% center; } }

    /* ─── Esfera ───────────────────────────────────────────────────────────── */
    .sphere-canvas {
      width: 300px;
      height: 300px;
    }

    /* ─── Status ───────────────────────────────────────────────────────────── */
    .ov-status {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 15px;
      font-weight: 500;
      color: rgba(255,255,255,0.6);
      margin-top: -8px;
      letter-spacing: 0.3px;
    }
    .status-dot {
      width: 8px; height: 8px;
      border-radius: 50%;
      background: #4ade80;
      box-shadow: 0 0 8px #4ade80;
      animation: blink 1.2s ease infinite;
      flex-shrink: 0;
    }
    @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.1} }

    .ov-spinner {
      width: 16px; height: 16px;
      border: 2px solid rgba(255,255,255,0.12);
      border-top-color: #4ade80;
      border-radius: 50%;
      animation: spin 0.75s linear infinite;
      flex-shrink: 0;
    }
    @keyframes spin { to{transform:rotate(360deg)} }

    .ov-heard {
      font-size: 14px;
      color: rgba(255,255,255,0.38);
      font-style: italic;
      max-width: 280px;
      margin-top: -8px;
    }

    /* ─── Confirmación ─────────────────────────────────────────────────────── */
    .ov-confirm-text {
      font-size: 17px;
      font-weight: 500;
      color: rgba(255,255,255,0.9);
      line-height: 1.6;
      max-width: 310px;
    }
    .ov-confirm-btns {
      display: flex;
      gap: 12px;
    }
    .btn-yes, .btn-no {
      display: flex;
      align-items: center;
      gap: 7px;
      padding: 11px 22px;
      border: none;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      transition: transform 0.12s, opacity 0.15s;
    }
    .btn-yes {
      background: #16a34a;
      color: white;
      box-shadow: 0 4px 16px rgba(22,163,74,0.45);
    }
    .btn-no {
      background: rgba(255,255,255,0.07);
      color: rgba(255,255,255,0.75);
      border: 1px solid rgba(255,255,255,0.15);
    }
    .btn-yes:hover { opacity: 0.85; transform: scale(1.03); }
    .btn-no:hover  { background: rgba(255,255,255,0.12); transform: scale(1.03); }

    /* ─── FAB ──────────────────────────────────────────────────────────────── */
    .voice-fab-wrap {
      position: fixed;
      bottom: 28px;
      right: 28px;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 8px;
      z-index: 9100;
    }

    .voice-fab {
      position: relative;
      width: 58px; height: 58px;
      border-radius: 50%;
      border: none;
      background: linear-gradient(145deg, #22c55e 0%, #16a34a 55%, #15803d 100%);
      color: white;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      box-shadow:
        0 6px 22px rgba(22,163,74,0.50),
        0 2px 6px rgba(0,0,0,0.25),
        inset 0 1px 0 rgba(255,255,255,0.18);
      transition: transform 0.15s, box-shadow 0.2s;
      animation: idleGlow 3s ease-in-out infinite;
    }
    @keyframes idleGlow {
      0%,100% { box-shadow: 0 6px 22px rgba(22,163,74,0.50), 0 2px 6px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.18); }
      50%      { box-shadow: 0 6px 28px rgba(22,163,74,0.70), 0 2px 6px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.18); }
    }
    .voice-fab:hover { transform: scale(1.07); }

    .voice-fab.rec  {
      background: linear-gradient(145deg, #f87171 0%, #dc2626 55%, #b91c1c 100%);
      box-shadow: 0 6px 22px rgba(220,38,38,0.55), 0 2px 6px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.15);
      animation: none;
    }
    .voice-fab.proc {
      background: linear-gradient(145deg, #fbbf24 0%, #d97706 55%, #b45309 100%);
      box-shadow: 0 6px 22px rgba(217,119,6,0.5), 0 2px 6px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.15);
      animation: none;
    }
    .voice-fab.conf {
      background: linear-gradient(145deg, #a78bfa 0%, #7c3aed 55%, #6d28d9 100%);
      box-shadow: 0 6px 22px rgba(124,58,237,0.55), 0 2px 6px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.15);
      animation: none;
    }

    .pulse-ring {
      position: absolute; inset: -6px;
      border-radius: 50%;
      border: 2px solid rgba(220,38,38,0.5);
      animation: pulse 1.5s ease-out infinite;
      pointer-events: none;
    }
    @keyframes pulse { 0%{transform:scale(1);opacity:0.8} 100%{transform:scale(1.7);opacity:0} }

    .fab-spinner {
      width: 22px; height: 22px;
      border: 2.5px solid rgba(255,255,255,0.25);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }

    /* ─── Burbuja post-acción ──────────────────────────────────────────────── */
    .voice-bubble {
      background: rgba(10,20,10,0.95);
      border: 1px solid rgba(74,222,128,0.2);
      border-radius: 14px;
      padding: 10px 14px;
      max-width: 230px;
      display: flex;
      flex-direction: column;
      gap: 3px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      animation: slideUp 0.2s ease;
    }
    @keyframes slideUp { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
    .vb-text  { font-size: 13px; color: #d1fae5; line-height: 1.4; }
    .vb-heard { font-size: 12px; color: rgba(255,255,255,0.35); font-style: italic; }

    @media (max-width: 640px) {
      .voice-fab-wrap { bottom: 20px; right: 16px; }
      .sphere-canvas  { width: 240px; height: 240px; }
      .ov-amalia-name { font-size: 26px; letter-spacing: 7px; }
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
      const on = this.vc.active() || this.vc.awaitingConfirmation();
      if (on) {
        setTimeout(() => {
          const el = this.waveCanvas()?.nativeElement;
          if (el) this._startSphere(el);
        }, 60);
      } else {
        this._stopAnim();
      }
    });
  }

  ngOnDestroy() { this._stopAnim(); }

  onOverlayClick() {
    if (!this.vc.awaitingConfirmation()) this.vc.toggle();
  }

  // ── Átomo con anillos 3D + electrones ───────────────────────────────────────
  private _startSphere(canvas: HTMLCanvasElement) {
    this._stopAnim();
    this._t = 0;

    const S = 300;
    canvas.width = S; canvas.height = S;
    const ctx = canvas.getContext('2d')!;
    const cx = S / 2, cy = S / 2, R = S * 0.42;

    // Dibuja un anillo elíptico con profundidad + electrón orbitando
    const drawRing = (rx: number, ry: number, rot: number, amp: number,
                      ca: string, cb: string, eAngle: number) => {
      const srx = Math.max(1, rx), sry = Math.max(1, ry);

      // Mitad trasera (π → 2π) opaca
      ctx.beginPath();
      ctx.ellipse(cx, cy, srx, sry, rot, Math.PI, Math.PI * 2);
      ctx.strokeStyle = `${ca}${0.14 + 0.07 * amp})`;
      ctx.lineWidth = 0.9;
      ctx.shadowBlur = 0;
      ctx.stroke();

      // Mitad delantera (0 → π) brillante
      ctx.shadowBlur  = 8 + amp * 22;
      ctx.shadowColor = `${cb}0.85)`;
      ctx.beginPath();
      ctx.ellipse(cx, cy, srx, sry, rot, 0, Math.PI);
      ctx.strokeStyle = `${ca}${0.55 + 0.45 * amp})`;
      ctx.lineWidth   = 1.3 + amp * 1.8;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Electrón: posición sobre la elipse
      const ex = cx + srx * Math.cos(eAngle) * Math.cos(rot) - sry * Math.sin(eAngle) * Math.sin(rot);
      const ey = cy + srx * Math.cos(eAngle) * Math.sin(rot) + sry * Math.sin(eAngle) * Math.cos(rot);
      // Solo se ve si está en la mitad delantera
      if (Math.sin(eAngle) > -0.15) {
        ctx.beginPath();
        ctx.arc(ex, ey, 2.8 + amp * 1.4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(220,255,160,${0.88 + 0.12 * amp})`;
        ctx.shadowBlur  = 14 + amp * 10;
        ctx.shadowColor = 'rgba(180,255,100,1)';
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    };

    const draw = () => {
      if (!this.vc.active() && !this.vc.awaitingConfirmation()) return;
      this._rafId = requestAnimationFrame(draw);
      this._t += 0.014;

      // Amplitud según estado
      let amp = 0.30;
      const analyser = this.vc.getAnalyser();
      if (analyser && this.vc.status() === 'listening') {
        const d = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(d);
        const avg = d.reduce((a, b) => a + b, 0) / d.length;
        amp = Math.max(0.28, Math.min(1.0, avg / 46));
      } else if (this.vc.status() === 'processing') {
        amp = 0.36 + 0.10 * Math.sin(this._t * 2.8);
      } else {
        amp = 0.28 + 0.08 * Math.sin(this._t * 1.0);
      }

      ctx.clearRect(0, 0, S, S);

      // ── Interior de la esfera ───────────────────────────────────────────────
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.clip();

      // Fondo oscuro
      const bg = ctx.createRadialGradient(cx - R*0.2, cy - R*0.2, 0, cx, cy, R);
      bg.addColorStop(0, 'rgba(10,32,10,1)');
      bg.addColorStop(0.6, 'rgba(4,14,4,1)');
      bg.addColorStop(1, 'rgba(0,5,0,1)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, S, S);

      // Núcleo brillante
      const pulse = 0.18 + 0.10 * Math.sin(this._t * 2.0);
      const nucleus = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.16);
      nucleus.addColorStop(0, `rgba(230,255,180,${0.85 + 0.15 * amp})`);
      nucleus.addColorStop(0.5, `rgba(74,222,128,${0.6 + 0.2 * amp})`);
      nucleus.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = nucleus;
      ctx.fillRect(0, 0, S, S);

      // Halo del núcleo
      const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.46);
      cg.addColorStop(0, `rgba(74,222,128,${pulse})`);
      cg.addColorStop(0.55, `rgba(34,197,94,${pulse * 0.35})`);
      cg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = cg;
      ctx.fillRect(0, 0, S, S);

      // ── Anillo 1: rota en eje Y (rx oscila) ────────────────────────────────
      {
        const spin = this._t * 0.009;
        const rxs  = R * 0.86 * Math.max(0.05, Math.abs(Math.cos(spin))) * (0.88 + 0.12 * amp);
        const rys  = R * (0.20 + 0.10 * Math.abs(Math.sin(spin * 0.5))) * (0.88 + 0.12 * amp);
        const rot  = this._t * 0.004;
        drawRing(rxs, rys, rot, amp, 'rgba(74,222,128,', 'rgba(134,239,172,', this._t * 0.058);
      }

      // ── Anillo 2: rota en eje X (ry oscila) ────────────────────────────────
      {
        const spin = this._t * 0.012 + Math.PI * 0.45;
        const rxs  = R * (0.20 + 0.10 * Math.abs(Math.cos(spin * 0.5))) * (0.88 + 0.12 * amp);
        const rys  = R * 0.86 * Math.max(0.05, Math.abs(Math.sin(spin))) * (0.88 + 0.12 * amp);
        const rot  = this._t * 0.006 + Math.PI * 0.5;
        drawRing(rxs, rys, rot, amp, 'rgba(34,197,94,', 'rgba(74,222,128,', this._t * 0.071);
      }

      // ── Anillo 3: eje diagonal ──────────────────────────────────────────────
      {
        const spin = this._t * 0.016 + Math.PI * 0.85;
        const rxs  = R * 0.78 * Math.max(0.07, Math.abs(Math.cos(spin))) * (0.88 + 0.12 * amp);
        const rys  = R * 0.78 * Math.max(0.13, Math.abs(Math.sin(spin + 0.8))) * (0.88 + 0.12 * amp);
        const rot  = this._t * 0.008 + Math.PI * 0.25;
        drawRing(rxs, rys, rot, amp, 'rgba(163,230,53,', 'rgba(217,249,157,', this._t * 0.086);
      }

      // Reflejo glass
      const hl = ctx.createRadialGradient(cx - R*0.28, cy - R*0.32, 0, cx - R*0.06, cy - R*0.06, R*0.58);
      hl.addColorStop(0, 'rgba(255,255,255,0.09)');
      hl.addColorStop(0.5, 'rgba(200,255,160,0.02)');
      hl.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = hl;
      ctx.fillRect(0, 0, S, S);

      ctx.restore();

      // ── Halo exterior ───────────────────────────────────────────────────────
      const halo = ctx.createRadialGradient(cx, cy, R * 0.84, cx, cy, R * 1.16);
      halo.addColorStop(0, 'rgba(0,0,0,0)');
      halo.addColorStop(0.35, `rgba(74,222,128,${0.30 * amp})`);
      halo.addColorStop(0.7,  `rgba(34,197,94,${0.10 * amp})`);
      halo.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.16, 0, Math.PI * 2);
      ctx.fill();

      // Borde de la esfera
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(74,222,128,${0.13 + 0.12 * amp})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    };
    draw();
  }

  private _stopAnim() {
    if (this._rafId !== undefined) {
      cancelAnimationFrame(this._rafId);
      this._rafId = undefined;
    }
  }
}

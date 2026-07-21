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

          <!-- Esfera de plasma -->
          <canvas #waveCanvas class="sphere-canvas" width="280" height="280"></canvas>

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
      </div>
    }

    <!-- ── Botón flotante ── -->
    <div class="voice-fab-wrap">

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
      background: rgba(2, 8, 2, 0.88);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      z-index: 9000;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: fadeIn 0.22s ease;
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

    .ov-inner {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 18px;
      padding: 0 28px;
      max-width: 360px;
      width: 100%;
      text-align: center;
    }

    /* Nombre Amalia */
    .ov-amalia-name {
      font-size: 36px;
      font-weight: 800;
      letter-spacing: 8px;
      text-transform: uppercase;
      color: transparent;
      background: linear-gradient(135deg, #6fcf30 0%, #c8f060 40%, #8cc63f 70%, #4a9e1a 100%);
      -webkit-background-clip: text;
      background-clip: text;
      background-size: 200% auto;
      animation: shimmer 3s ease infinite;
      margin-bottom: -4px;
    }
    @keyframes shimmer {
      0%   { background-position: 0% center; }
      50%  { background-position: 100% center; }
      100% { background-position: 0% center; }
    }

    /* Esfera canvas */
    .sphere-canvas {
      width: 280px;
      height: 280px;
      border-radius: 50%;
    }

    /* Status */
    .ov-status {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 16px;
      font-weight: 600;
      color: rgba(255,255,255,0.75);
      margin-top: -6px;
    }
    .status-dot {
      width: 10px; height: 10px;
      background: #8cc63f;
      border-radius: 50%;
      flex-shrink: 0;
      animation: blink 1.2s ease infinite;
      box-shadow: 0 0 8px #8cc63f;
    }
    @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.15} }

    .ov-spinner {
      width: 18px; height: 18px;
      border: 2px solid rgba(255,255,255,0.15);
      border-top-color: #8cc63f;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
      flex-shrink: 0;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .ov-heard {
      font-size: 14px;
      color: rgba(255,255,255,0.45);
      font-style: italic;
      max-width: 300px;
      margin-top: -6px;
    }

    /* Confirmación */
    .ov-confirm-text {
      font-size: 17px;
      font-weight: 500;
      color: white;
      line-height: 1.6;
      max-width: 320px;
    }
    .ov-confirm-btns {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      justify-content: center;
    }
    .btn-yes, .btn-no {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 22px;
      border: none;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      transition: transform 0.12s, opacity 0.15s;
    }
    .btn-yes { background: #8cc63f; color: white; box-shadow: 0 4px 16px rgba(140,198,63,0.4); }
    .btn-no  { background: rgba(255,255,255,0.08); color: white; border: 1.5px solid rgba(255,255,255,0.2); }
    .btn-yes:hover { opacity: 0.88; transform: scale(1.04); }
    .btn-no:hover  { background: rgba(255,255,255,0.15); transform: scale(1.04); }

    /* ─── FAB ────────────────────────────────────────────────────────────────── */
    .voice-fab-wrap {
      position: fixed;
      bottom: 28px;
      right: 28px;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 6px;
      z-index: 9100;
    }
    .amalia-label {
      font-size: 11px;
      font-weight: 700;
      color: #6b7280;
      letter-spacing: 0.4px;
      text-align: right;
      opacity: 0.8;
      transition: opacity 0.2s, color 0.2s;
      white-space: nowrap;
    }
    .voice-fab-wrap:hover .amalia-label { opacity: 1; color: #16a34a; }

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
    .voice-fab.processing { background: #d97706; }
    .voice-fab.confirming { background: #7c3aed; box-shadow: 0 4px 18px rgba(124,58,237,0.45); }

    .pulse-ring {
      position: absolute; inset: -5px;
      border-radius: 50%;
      border: 3px solid rgba(140,198,63,0.6);
      animation: pulse 1.4s ease-out infinite;
      pointer-events: none;
    }
    @keyframes pulse { 0%{transform:scale(1);opacity:1} 100%{transform:scale(1.65);opacity:0} }

    .fab-spinner {
      width: 22px; height: 22px;
      border: 2.5px solid rgba(255,255,255,0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }

    /* Burbuja post-acción */
    .voice-bubble {
      background: rgba(10,20,10,0.92);
      border-radius: 14px;
      padding: 10px 14px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.25);
      max-width: 240px;
      display: flex;
      flex-direction: column;
      gap: 3px;
      border-left: 3px solid #8cc63f;
      animation: slideUp 0.2s ease;
    }
    @keyframes slideUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
    .vb-text  { font-size: 13px; color: #e5e7eb; line-height: 1.4; }
    .vb-heard { font-size: 12px; color: #6b7280; font-style: italic; }

    @media (max-width: 640px) {
      .voice-fab-wrap { bottom: 20px; right: 16px; }
      .sphere-canvas  { width: 220px; height: 220px; }
      .ov-amalia-name { font-size: 28px; letter-spacing: 6px; }
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
      const active     = this.vc.active();
      const confirming = this.vc.awaitingConfirmation();
      if (active || confirming) {
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

  // ── Esfera de plasma tipo Amalia ─────────────────────────────────────────────
  private _startSphere(canvas: HTMLCanvasElement) {
    this._stopAnim();
    this._t = 0;

    const S   = 280;
    canvas.width  = S;
    canvas.height = S;
    const ctx = canvas.getContext('2d')!;
    const cx = S / 2, cy = S / 2, R = S * 0.44;

    // Cintas de plasma: a/b = frecuencias Lissajous, phX/phY = desfases
    const ribbons = [
      { a: 1.30, b: 0.80, px: 0.00, py: 0.50, c1: 'rgba(140,220,50,',  c2: 'rgba(200,255,80,'  },
      { a: 0.70, b: 1.50, px: 1.05, py: 2.10, c1: 'rgba(80,200,30,',   c2: 'rgba(160,240,50,'  },
      { a: 2.10, b: 0.60, px: 2.30, py: 0.80, c1: 'rgba(110,230,60,',  c2: 'rgba(230,255,110,' },
      { a: 0.90, b: 1.80, px: 3.50, py: 1.30, c1: 'rgba(50,160,20,',   c2: 'rgba(130,210,50,'  },
      { a: 1.70, b: 1.10, px: 4.80, py: 2.70, c1: 'rgba(170,240,70,',  c2: 'rgba(100,200,40,'  },
      { a: 1.10, b: 2.30, px: 0.80, py: 3.60, c1: 'rgba(60,180,25,',   c2: 'rgba(150,230,60,'  },
    ];

    const draw = () => {
      if (!this.vc.active() && !this.vc.awaitingConfirmation()) return;
      this._rafId = requestAnimationFrame(draw);
      this._t += 0.014;

      // Amplitud según mic o estado
      const analyser = this.vc.getAnalyser();
      let amp = this.vc.awaitingConfirmation() ? 0.28 + 0.08 * Math.sin(this._t * 1.2) : 0.32;
      if (analyser && this.vc.status() === 'listening') {
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        amp = Math.max(0.28, Math.min(1.0, avg / 48));
      } else if (this.vc.status() === 'processing') {
        amp = 0.38 + 0.12 * Math.sin(this._t * 2.5);
      }

      ctx.clearRect(0, 0, S, S);

      // ── Interior de la esfera ─────────────────────────────────────────────────
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.clip();

      // Fondo oscuro
      const bg = ctx.createRadialGradient(cx * 0.65, cy * 0.65, 0, cx, cy, R);
      bg.addColorStop(0, 'rgba(8,28,6,1)');
      bg.addColorStop(0.65, 'rgba(3,12,2,1)');
      bg.addColorStop(1, 'rgba(0,6,0,1)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, S, S);

      // Glow central
      const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.55);
      cg.addColorStop(0, `rgba(120,210,40,${0.18 * amp})`);
      cg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = cg;
      ctx.fillRect(0, 0, S, S);

      // Cintas de plasma (modo lighter para que se mezclen con luz)
      ctx.globalCompositeOperation = 'lighter';
      for (const rib of ribbons) {
        ctx.beginPath();
        let first = true;
        for (let s = 0; s <= 1; s += 0.012) {
          const ang = s * Math.PI * 4;
          const scale = 0.35 + 0.65 * s;
          const x = cx + Math.sin(rib.a * ang + rib.px + this._t * 0.65) * R * 0.88 * scale * amp;
          const y = cy + Math.sin(rib.b * ang + rib.py + this._t * 0.48) * R * 0.88 * scale * amp;
          first ? (ctx.moveTo(x, y), first = false) : ctx.lineTo(x, y);
        }
        const la = Math.min(1, 0.35 + 0.55 * amp);
        ctx.strokeStyle = `${rib.c1}${la})`;
        ctx.lineWidth   = 1.2 + amp * 2.2;
        ctx.shadowBlur  = 10 + amp * 22;
        ctx.shadowColor = `${rib.c2}0.85)`;
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';

      // Reflejo glass (top-left highlight)
      const hl = ctx.createRadialGradient(cx - R * 0.32, cy - R * 0.38, 0, cx - R * 0.08, cy - R * 0.08, R * 0.62);
      hl.addColorStop(0, 'rgba(255,255,255,0.11)');
      hl.addColorStop(0.45, 'rgba(200,255,140,0.03)');
      hl.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = hl;
      ctx.fillRect(0, 0, S, S);

      ctx.restore();

      // ── Halo exterior ─────────────────────────────────────────────────────────
      const halo = ctx.createRadialGradient(cx, cy, R * 0.86, cx, cy, R * 1.14);
      halo.addColorStop(0, 'rgba(0,0,0,0)');
      halo.addColorStop(0.38, `rgba(140,198,63,${0.38 * amp})`);
      halo.addColorStop(0.72, `rgba(80,160,30,${0.14 * amp})`);
      halo.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.14, 0, Math.PI * 2);
      ctx.fill();

      // Borde nítido de la esfera
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(140,198,63,${0.22 + 0.18 * amp})`;
      ctx.lineWidth = 1.2;
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

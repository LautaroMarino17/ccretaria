import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VoiceCommandService } from '../../../core/services/voice-command.service';

@Component({
  selector: 'app-voice-button',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="voice-fab-wrap">

      @if (vc.active() || vc.lastResponse()) {
        <div class="voice-bubble" [class.processing]="vc.status() === 'processing'" [class.speaking]="vc.status() === 'speaking'">
          @if (vc.status() === 'listening') {
            <span class="vb-dot"></span>
            <span class="vb-text">Escuchando...</span>
          }
          @if (vc.status() === 'processing') {
            <span class="vb-text">Procesando...</span>
          }
          @if (vc.status() === 'speaking') {
            <span class="vb-text">{{ vc.lastResponse() }}</span>
          }
          @if (vc.lastText() && vc.status() !== 'listening') {
            <span class="vb-heard">"{{ vc.lastText() }}"</span>
          }
        </div>
      }

      <button
        class="voice-fab"
        [class.active]="vc.active()"
        [class.processing]="vc.status() === 'processing'"
        [class.speaking]="vc.status() === 'speaking'"
        (click)="vc.toggle()"
        [title]="vc.active() ? 'Desactivar dictado' : 'Activar dictado por voz'">

        @if (vc.status() === 'processing') {
          <span class="fab-spinner"></span>
        } @else if (vc.status() === 'speaking') {
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
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
    .voice-fab-wrap {
      position: fixed;
      bottom: 28px;
      right: 28px;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 10px;
      z-index: 500;
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
      box-shadow: 0 4px 16px rgba(22,163,74,0.4);
      transition: background 0.2s, transform 0.15s, box-shadow 0.2s;
    }
    .voice-fab:hover { background: #15803d; transform: scale(1.06); }
    .voice-fab.active { background: #dc2626; box-shadow: 0 4px 16px rgba(220,38,38,0.4); }
    .voice-fab.active:hover { background: #b91c1c; }
    .voice-fab.processing { background: #d97706; box-shadow: 0 4px 16px rgba(217,119,6,0.4); }
    .voice-fab.speaking { background: #7c3aed; box-shadow: 0 4px 16px rgba(124,58,237,0.4); }

    .pulse-ring {
      position: absolute;
      inset: -4px;
      border-radius: 50%;
      border: 3px solid #ef4444;
      animation: pulse 1.4s ease-out infinite;
      pointer-events: none;
    }
    @keyframes pulse { 0%{transform:scale(1);opacity:1} 100%{transform:scale(1.5);opacity:0} }

    .fab-spinner {
      width: 22px; height: 22px;
      border: 2.5px solid rgba(255,255,255,0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .voice-bubble {
      background: white;
      border-radius: 14px;
      padding: 12px 16px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.12);
      max-width: 280px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      border-left: 3px solid #16a34a;
      animation: slideUp 0.2s ease;
    }
    .voice-bubble.processing { border-left-color: #d97706; }
    .voice-bubble.speaking { border-left-color: #7c3aed; }
    @keyframes slideUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }

    .vb-dot {
      display: inline-block;
      width: 8px; height: 8px;
      background: #ef4444;
      border-radius: 50%;
      animation: blink 1s ease infinite;
      margin-bottom: 2px;
    }
    @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }

    .vb-text { font-size: 13px; font-weight: 600; color: #111827; line-height: 1.4; }
    .vb-heard { font-size: 12px; color: #6b7280; font-style: italic; margin-top: 2px; }

    @media (max-width: 640px) {
      .voice-fab-wrap { bottom: 20px; right: 16px; }
      .voice-bubble { max-width: 220px; }
    }
  `]
})
export class VoiceButtonComponent {
  vc = inject(VoiceCommandService);
}

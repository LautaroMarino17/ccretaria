import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

// ── Editá los precios acá ──────────────────────────────────────────────────────
const PRICES = {
  plan1: '$XX / mes',
  plan2: '$XX / mes',
  plan3: '$XX / mes',
};
// ──────────────────────────────────────────────────────────────────────────────

const PLANS = [
  {
    id: 1,
    name: 'Plan 1',
    subtitle: 'Historias clínicas',
    price: PRICES.plan1,
    color: '#2563eb',
    features: [
      'Gestión de pacientes',
      'Agenda de turnos',
      'Evaluaciones físicas',
      'Dictado de historia clínica con IA',
      'Estructurado automático de consultas',
      'Descarga de PDFs y Excel',
    ],
  },
  {
    id: 2,
    name: 'Plan 2',
    subtitle: 'Rutinas habladas',
    price: PRICES.plan2,
    color: '#7c3aed',
    highlight: true,
    features: [
      'Todo lo del Plan 1',
      'Dictado de rutinas con voz',
      'Generación automática de rutinas con IA',
      'Asignación de ejercicios por paciente',
    ],
  },
  {
    id: 3,
    name: 'Plan 3',
    subtitle: 'Amalia',
    price: PRICES.plan3,
    color: '#16a34a',
    features: [
      'Todo lo del Plan 2',
      'Amalia — asistente de voz completo',
      'Navegación por voz en toda la app',
      'Creación de turnos, rutinas e historias por voz',
      'Memoria de último paciente',
    ],
  },
];

@Component({
  selector: 'app-plans',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="plans-wrap">
      <div class="plans-header">
        <h1>Tu cuenta está pendiente de activación</h1>
        <p>Elegí el plan que mejor se adapte a tu práctica. Una vez que lo selecciones, el administrador lo activará en tu cuenta.</p>
      </div>

      <div class="plans-grid">
        @for (plan of plans; track plan.id) {
          <div class="plan-card" [class.highlighted]="plan.highlight">
            @if (plan.highlight) {
              <div class="popular-badge">Más completo</div>
            }
            <div class="plan-top">
              <div class="plan-dot" [style.background]="plan.color"></div>
              <div>
                <div class="plan-name">{{ plan.name }}</div>
                <div class="plan-subtitle">{{ plan.subtitle }}</div>
              </div>
            </div>
            <div class="plan-price" [style.color]="plan.color">{{ plan.price }}</div>
            <ul class="plan-features">
              @for (f of plan.features; track f) {
                <li>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" [attr.stroke]="plan.color" stroke-width="2.5">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  {{ f }}
                </li>
              }
            </ul>
          </div>
        }
      </div>

      <div class="plans-footer">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        Contactá al administrador para activar tu plan. El acceso se habilita de forma inmediata una vez asignado.
      </div>
    </div>
  `,
  styles: [`
    .plans-wrap {
      max-width: 960px;
      margin: 0 auto;
      padding: 8px 0 40px;
    }

    .plans-header {
      text-align: center;
      margin-bottom: 40px;
    }
    .plans-header h1 {
      font-size: 24px;
      font-weight: 700;
      color: #111;
      margin: 0 0 10px;
    }
    .plans-header p {
      font-size: 15px;
      color: #6b7280;
      max-width: 480px;
      margin: 0 auto;
      line-height: 1.6;
    }

    .plans-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin-bottom: 32px;
    }

    .plan-card {
      background: white;
      border: 1.5px solid #e5e7eb;
      border-radius: 16px;
      padding: 28px 24px;
      position: relative;
      transition: box-shadow 0.2s;
    }
    .plan-card:hover {
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
    }
    .plan-card.highlighted {
      border-color: #7c3aed;
      box-shadow: 0 4px 24px rgba(124,58,237,0.12);
    }

    .popular-badge {
      position: absolute;
      top: -12px;
      left: 50%;
      transform: translateX(-50%);
      background: #7c3aed;
      color: white;
      font-size: 11px;
      font-weight: 700;
      padding: 3px 14px;
      border-radius: 20px;
      white-space: nowrap;
    }

    .plan-top {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }
    .plan-dot {
      width: 10px; height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .plan-name {
      font-size: 15px;
      font-weight: 700;
      color: #111;
    }
    .plan-subtitle {
      font-size: 12px;
      color: #6b7280;
      margin-top: 1px;
    }

    .plan-price {
      font-size: 26px;
      font-weight: 800;
      margin-bottom: 20px;
    }

    .plan-features {
      list-style: none;
      padding: 0; margin: 0;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .plan-features li {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      font-size: 13px;
      color: #374151;
      line-height: 1.4;
    }
    .plan-features li svg { flex-shrink: 0; margin-top: 1px; }

    .plans-footer {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      font-size: 13px;
      color: #6b7280;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 14px 20px;
    }

    @media (max-width: 768px) {
      .plans-grid { grid-template-columns: 1fr; }
    }
  `]
})
export class PlansComponent {
  plans = PLANS;
}

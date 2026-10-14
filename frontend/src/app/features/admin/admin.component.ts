import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/services/api.service';

const PLAN_LABELS: Record<number, string> = {
  0: 'Sin plan',
  1: 'Plan 1 · Historias',
  2: 'Plan 2 · Rutinas',
  3: 'Plan 3 · Amalia',
};
const PLAN_COLORS: Record<number, string> = {
  0: '#9ca3af', 1: '#2563eb', 2: '#7c3aed', 3: '#16a34a'
};

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="admin-wrap">
      <h1 class="title">Panel de administración</h1>
      <p class="subtitle">Asigná el plan de cada profesional registrado.</p>

      @if (loading()) {
        <div class="loading">Cargando...</div>
      } @else if (error()) {
        <div class="error">{{ error() }}</div>
      } @else {
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Plan actual</th>
                <th>Cambiar plan</th>
              </tr>
            </thead>
            <tbody>
              @for (pro of professionals(); track pro.uid) {
                <tr [class.saving]="saving() === pro.uid">
                  <td class="td-name">{{ pro.display_name || '—' }}</td>
                  <td class="td-email">{{ pro.email }}</td>
                  <td>
                    <span class="plan-badge" [style.background]="planColor(pro.plan)">
                      {{ planLabel(pro.plan) }}
                    </span>
                    @if (pro.is_admin) { <span class="admin-chip">Admin</span> }
                  </td>
                  <td class="td-actions">
                    @for (p of [0,1,2,3]; track p) {
                      <button
                        class="plan-btn"
                        [class.active]="pro.plan === p"
                        [style.border-color]="pro.plan === p ? planColor(p) : ''"
                        [style.color]="pro.plan === p ? planColor(p) : ''"
                        [disabled]="saving() === pro.uid"
                        (click)="setPlan(pro, p)">
                        {{ p === 0 ? 'P0' : 'P' + p }}
                      </button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      <!-- ── Uso de IA ─────────────────────────────── -->
      <div class="usage-head">
        <h2 class="title">Uso de IA</h2>
        <button class="plan-btn refresh-btn" (click)="loadUsage()">Actualizar</button>
      </div>
      @if (usage(); as u) {
        <p class="subtitle">Cuenta Groq (compartida) · {{ u.fecha_ar }} · se deja de llamar al {{ u.margen_cuenta_pct }} % de hora y día</p>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Límite</th><th>Ventana</th><th>Usado</th><th>Máximo</th><th>%</th></tr></thead>
            <tbody>
              @for (l of u.cuenta; track l.limite + l.ventana) {
                <tr>
                  <td>{{ l.limite }}</td>
                  <td>{{ ventanaLabel(l.ventana) }}</td>
                  <td>{{ l.usado }}</td>
                  <td>{{ l.maximo }}</td>
                  <td><span class="pct" [class.warn]="l.porcentaje >= u.aviso_pct" [class.full]="l.porcentaje >= 100">{{ l.porcentaje }} %</span></td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <p class="subtitle usage-sub">Por profesional (hora Argentina)</p>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Profesional</th><th>Plan</th><th>Hoy</th><th>Mes</th><th>Cupo</th></tr></thead>
            <tbody>
              @for (p of u.profesionales; track p.uid) {
                <tr>
                  <td class="td-name">{{ p.display_name || p.email || p.uid }}</td>
                  <td>{{ 'P' + p.plan }}</td>
                  <td>{{ p.hoy.minutos_audio }} min @if (p.limite_dia_min) { / {{ p.limite_dia_min }} }<br><small>{{ p.hoy.requests }} pedidos · {{ p.hoy.tokens }} tokens</small></td>
                  <td>{{ p.mes.minutos_audio }} min @if (p.limite_mes_min) { / {{ p.limite_mes_min }} }<br><small>{{ p.mes.requests }} pedidos · {{ p.mes.tokens }} tokens</small></td>
                  <td>
                    @if (p.ilimitado) { <span class="pct">Sin tope</span> }
                    @else { <span class="pct" [class.warn]="p.aviso" [class.full]="p.bloqueado">{{ p.porcentaje }} %</span> }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else if (usageError()) {
        <div class="error">{{ usageError() }}</div>
      } @else {
        <div class="loading">Cargando uso de IA...</div>
      }
    </div>
  `,
  styles: [`
    .admin-wrap { max-width: 820px; }
    .title    { font-size: 22px; font-weight: 700; color: #111; margin: 0 0 4px; }
    .subtitle { font-size: 14px; color: #6b7280; margin: 0 0 28px; }
    .loading  { color: #6b7280; font-size: 14px; }
    .error    { color: #dc2626; font-size: 14px; }

    .table-wrap {
      background: white;
      border-radius: 14px;
      border: 1px solid #e5e7eb;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      box-shadow: 0 1px 4px rgba(0,0,0,0.06);
    }
    table { width: 100%; border-collapse: collapse; }
    thead tr { background: #f9fafb; }
    th {
      text-align: left;
      padding: 12px 16px;
      font-size: 12px;
      font-weight: 600;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 1px solid #e5e7eb;
    }
    td { padding: 14px 16px; border-bottom: 1px solid #f3f4f6; vertical-align: middle; }
    tr:last-child td { border-bottom: none; }
    tr.saving { opacity: 0.6; pointer-events: none; }

    .td-name  { font-weight: 600; font-size: 14px; color: #111; }
    .td-email { font-size: 13px; color: #6b7280; }

    .plan-badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      color: white;
    }
    .admin-chip {
      margin-left: 6px;
      display: inline-block;
      padding: 2px 8px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
      background: #fef3c7;
      color: #92400e;
    }

    .td-actions { display: flex; gap: 6px; align-items: center; }
    .plan-btn {
      width: 34px; height: 30px;
      border: 1.5px solid #d1d5db;
      border-radius: 8px;
      background: white;
      color: #9ca3af;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.15s;
    }
    .plan-btn:hover:not([disabled]) { border-color: #6b7280; color: #111; }
    .plan-btn.active { background: #f0fdf4; }
    .plan-btn:disabled { opacity: 0.5; cursor: default; }

    .usage-head { display: flex; align-items: center; justify-content: space-between; margin-top: 36px; }
    .refresh-btn { width: auto; padding: 0 12px; color: #374151; }
    .usage-sub { margin-top: 20px; margin-bottom: 10px; }
    td small { color: #9ca3af; font-size: 11px; }
    .pct { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 12px; font-weight: 600; background: #f0fdf4; color: #166534; }
    .pct.warn { background: #fffbeb; color: #92400e; }
    .pct.full { background: #fef2f2; color: #b91c1c; }
  `]
})
export class AdminComponent implements OnInit {
  private api = inject(ApiService);

  professionals = signal<any[]>([]);
  loading       = signal(true);
  error         = signal('');
  saving        = signal('');
  usage         = signal<any | null>(null);
  usageError    = signal('');

  ngOnInit() {
    this.api.getAdminProfessionals().subscribe({
      next:  (list) => { this.professionals.set(list); this.loading.set(false); },
      error: ()     => { this.error.set('No se pudo cargar la lista. ¿Tenés permisos de admin?'); this.loading.set(false); }
    });
    this.loadUsage();
  }

  loadUsage() {
    this.usageError.set('');
    this.api.getAdminAiUsage().subscribe({
      next:  (u) => this.usage.set(u),
      error: ()  => this.usageError.set('No se pudo cargar el uso de IA.')
    });
  }

  ventanaLabel(v: string) { return ({ minuto: 'Último minuto', hora: 'Hora actual', dia: 'Últimas 24 h' } as any)[v] ?? v; }

  planLabel(plan: number) { return PLAN_LABELS[plan] ?? `Plan ${plan}`; }
  planColor(plan: number) { return PLAN_COLORS[plan] ?? '#6b7280'; }

  setPlan(pro: any, plan: number) {
    if (pro.plan === plan) return;
    this.saving.set(pro.uid);
    this.api.updateProfessionalPlan(pro.uid, plan).subscribe({
      next: () => {
        this.professionals.update(list => list.map(p => p.uid === pro.uid ? { ...p, plan } : p));
        this.saving.set('');
      },
      error: () => this.saving.set('')
    });
  }
}

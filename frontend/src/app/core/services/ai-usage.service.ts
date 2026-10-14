import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';

/** Estado del cupo de IA tal como lo calcula el backend (GET /usage/me). */
export interface AiQuotaStatus {
  plan: number;
  ilimitado: boolean;
  usado_dia_min: number;
  usado_mes_min: number;
  limite_dia_min: number | null;
  limite_mes_min: number | null;
  restante_min: number | null;
  porcentaje: number;
  aviso: boolean;
  bloqueado: boolean;
  mensaje: string | null;
  renueva: string | null;
  sin_ia: boolean;
}

/** Código de error de IA del backend: 'cupo_agotado' | 'pendiente' | 'demasiado_largo' | 'error_ia'. */
export function aiErrorCode(err: any): string | undefined {
  return err?.error?.detail?.codigo;
}

export function aiErrorMessage(err: any): string | undefined {
  return err?.error?.detail?.mensaje;
}

/** Solo muestra el estado del cupo: toda la lógica vive en el backend. */
@Injectable({ providedIn: 'root' })
export class AiUsageService {
  private api = inject(ApiService);

  status = signal<AiQuotaStatus | null>(null);

  async refresh(): Promise<AiQuotaStatus | null> {
    try {
      const s = await firstValueFrom(this.api.getAiUsage());
      this.status.set(s);
      return s;
    } catch {
      return this.status();
    }
  }
}

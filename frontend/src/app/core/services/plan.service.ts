import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class PlanService {
  private api = inject(ApiService);

  plan    = signal<number | null>(null);
  isAdmin = signal<boolean>(false);

  load() {
    this.api.getMe().subscribe({
      next: (me) => {
        this.plan.set(me.plan ?? 1);
        this.isAdmin.set(me.is_admin ?? false);
      },
      error: () => { this.plan.set(1); }
    });
  }
}

import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { PlanService } from '../services/plan.service';

export const adminGuard = () => {
  const plan    = inject(PlanService);
  const router  = inject(Router);
  if (plan.isAdmin()) return true;
  return router.parseUrl('/professional/dashboard');
};

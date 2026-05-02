import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { filter, map, take } from 'rxjs';

// Espera hasta que Firebase resuelva el estado de auth (descarta el undefined inicial)
function waitForAuth(auth: AuthService) {
  return auth.currentUser$.pipe(
    filter(user => user !== undefined),
    take(1)
  );
}

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return waitForAuth(auth).pipe(
    map(user => {
      if (user) return true;
      router.navigate(['/login']);
      return false;
    })
  );
};

export const professionalGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return waitForAuth(auth).pipe(
    map(user => {
      if (user?.role === 'professional') return true;
      router.navigate(['/login']);
      return false;
    })
  );
};

export const patientGuard: CanActivateFn = () => {
  const router = inject(Router);
  router.navigate(['/login']);
  return false;
};

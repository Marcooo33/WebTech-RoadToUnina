import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from './auth.service';

/**
 * Protects authenticated-only routes. Auth state is normally already resolved by
 * `provideAppInitializer`; this still calls `bootstrap()` defensively so a
 * direct deep-link works even if the initializer was skipped. Unauthenticated
 * users are sent to `/login`.
 */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const deny = () => router.createUrlTree(['/login']);

  if (auth.status() === 'authenticated') {
    return true;
  }
  if (auth.status() === 'anonymous') {
    return deny();
  }

  return auth.bootstrap().pipe(map((status) => (status === 'authenticated' ? true : deny())));
};

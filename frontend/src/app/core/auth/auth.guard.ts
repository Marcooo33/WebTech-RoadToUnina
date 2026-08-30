import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from './auth.service';

/**
 * Protects authenticated-only routes. Auth state is normally already resolved by
 * `provideAppInitializer`; this still calls `bootstrap()` defensively so a
 * direct deep-link works even if the initializer was skipped. Unauthenticated
 * users are sent to `/login` with a `redirect` back to the requested URL.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const deny = () => router.createUrlTree(['/login'], { queryParams: { redirect: state.url } });

  if (auth.status() === 'authenticated') {
    return true;
  }
  if (auth.status() === 'anonymous') {
    return deny();
  }

  return auth.bootstrap().pipe(map((status) => (status === 'authenticated' ? true : deny())));
};

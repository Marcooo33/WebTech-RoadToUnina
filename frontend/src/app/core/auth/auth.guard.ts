import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from './auth.service';

// Auth state is usually already resolved by provideAppInitializer, but a
// direct deep-link can skip that, so this calls bootstrap() defensively too.
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

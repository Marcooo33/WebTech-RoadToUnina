import { Route } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { routes } from './app.routes';

/**
 * Access rules for the public History surfaces and authenticated profile.
 */
describe('app routes — Milestone 15 access rules', () => {
  const byPath = (path: string): Route => {
    const route = routes.find((r) => r.path === path);
    if (!route) throw new Error(`route not found: ${path}`);
    return route;
  };

  it('exposes public history to anonymous users', () => {
    expect(byPath('history').canActivate ?? []).toEqual([]);
  });

  it('exposes public completed-game detail to anonymous users', () => {
    expect(byPath('history/:gameId').canActivate ?? []).toEqual([]);
  });

  it('does not expose a separate leaderboard route', () => {
    expect(routes.some((route) => route.path === 'leaderboard')).toBe(false);
  });

  it('protects the personal profile behind the auth guard', () => {
    expect(byPath('profile').canActivate).toContain(authGuard);
  });
});

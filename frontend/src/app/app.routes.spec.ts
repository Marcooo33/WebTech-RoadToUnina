import { Route } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { routes } from './app.routes';

/**
 * Access rules for the Milestone 15 product surfaces: the public history and
 * leaderboard screens must be reachable without authentication; the personal
 * profile must be protected.
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
    expect(byPath('history/:id').canActivate ?? []).toEqual([]);
  });

  it('exposes public leaderboards to anonymous users', () => {
    expect(byPath('leaderboard').canActivate ?? []).toEqual([]);
  });

  it('protects the personal profile behind the auth guard', () => {
    expect(byPath('profile').canActivate).toContain(authGuard);
  });
});

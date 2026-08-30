import { runInInjectionContext, Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { of } from 'rxjs';
import { authGuard } from './auth.guard';
import { AuthService } from './auth.service';

function runGuard(url: string) {
  const injector = TestBed.inject(Injector);
  return runInInjectionContext(injector, () => authGuard({} as never, { url } as never));
}

describe('authGuard', () => {
  let status: 'unknown' | 'authenticated' | 'anonymous';

  beforeEach(() => {
    status = 'anonymous';
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: {
            status: () => status,
            bootstrap: () => of(status),
          },
        },
        {
          provide: Router,
          useValue: {
            createUrlTree: (commands: unknown[], extras: unknown) =>
              ({ commands, extras }) as unknown as UrlTree,
          },
        },
      ],
    });
  });

  it('allows navigation when authenticated', () => {
    status = 'authenticated';
    expect(runGuard('/dashboard')).toBe(true);
  });

  it('redirects to /login with a redirect param when anonymous', () => {
    status = 'anonymous';
    const result = runGuard('/dashboard') as unknown as {
      commands: unknown[];
      extras: { queryParams: { redirect: string } };
    };
    expect(result.commands).toEqual(['/login']);
    expect(result.extras.queryParams.redirect).toBe('/dashboard');
  });
});

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
            createUrlTree: (commands: unknown[]) => ({ commands }) as unknown as UrlTree,
          },
        },
      ],
    });
  });

  it('allows navigation when authenticated', () => {
    status = 'authenticated';
    expect(runGuard('/new-game')).toBe(true);
  });

  it('redirects to /login when anonymous', () => {
    status = 'anonymous';
    const result = runGuard('/new-game') as unknown as {
      commands: unknown[];
    };
    expect(result.commands).toEqual(['/login']);
  });
});

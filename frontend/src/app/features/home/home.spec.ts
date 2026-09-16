import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { StatisticsDto } from '../../shared/models/stats.model';
import { UserProfileDto } from '../../shared/models/user.model';
import { Home } from './home';

const USER: UserProfileDto = {
  id: 'u1',
  username: 'marco',
  email: 'marco@example.com',
  avatarUrl: null,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const STATS: StatisticsDto = {
  completedGames: 0,
  inProgressGames: 0,
  bestClick: null,
  bestTime: null,
  averageClicks: null,
  averageEffectiveTimeMs: null,
};

describe('Home', () => {
  const authenticated = signal(false);
  let fixture: ComponentFixture<Home>;
  let http: HttpTestingController;

  beforeEach(async () => {
    authenticated.set(false);

    await TestBed.configureTestingModule({
      imports: [Home],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: {
            isAuthenticated: authenticated.asReadonly(),
            user: signal(USER).asReadonly(),
          },
        },
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Home);
  });

  afterEach(() => http.verify());

  it('shows the landing page without loading dashboard data when anonymous', () => {
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-landing-page')).toBeTruthy();
    expect(el.querySelector('app-dashboard')).toBeNull();
    expect(el.textContent).toContain('Reach Federico II');
    http.expectNone('/api/games?status=IN_PROGRESS');
    http.expectNone('/api/me/stats');
  });

  it('shows the existing dashboard when authenticated', () => {
    authenticated.set(true);
    fixture.detectChanges();

    http.expectOne('/api/games?status=IN_PROGRESS').flush({ items: [] });
    http.expectOne('/api/me/stats').flush(STATS);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-dashboard')).toBeTruthy();
    expect(el.querySelector('app-landing-page')).toBeNull();
    expect(el.textContent).toContain('Signed in as marco');
  });
});

import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { errorInterceptor } from '../../../core/interceptors/error.interceptor';
import { StatisticsDto } from '../../../shared/models/stats.model';
import { ProfilePage } from './profile-page';

const USER = {
  id: 'u1',
  username: 'marco',
  email: 'marco@example.com',
  avatarUrl: null,
  createdAt: '2026-01-01T00:00:00.000Z',
};

function stats(over: Partial<StatisticsDto> = {}): StatisticsDto {
  return {
    completedGames: 4,
    inProgressGames: 1,
    bestClick: {
      gameId: 'gc',
      difficulty: 'EASY',
      clickCount: 7,
      effectivePlayTimeMs: 240_000,
      completedAt: '2026-08-01T00:00:00.000Z',
    },
    bestTime: {
      gameId: 'gt',
      difficulty: 'HARD',
      clickCount: 15,
      effectivePlayTimeMs: 180_000,
      completedAt: '2026-08-02T00:00:00.000Z',
    },
    averageClicks: 12.36,
    averageEffectiveTimeMs: 300_000,
    ...over,
  };
}

describe('ProfilePage', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<ProfilePage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProfilePage],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { user: () => USER, clearUser: vi.fn() } },
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ProfilePage);
  });

  afterEach(() => http.verify());

  function load(dto = stats()): HTMLElement {
    fixture.detectChanges();
    http.expectOne('/api/me/stats').flush(dto);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders profile info and statistics', () => {
    const el = load();
    expect(el.textContent).toContain('marco');
    expect(el.textContent).toContain('marco@example.com');
    expect(el.textContent).toContain('Completed games');
    expect(el.textContent).toContain('4');
  });

  it('shows best-result tie-break values and difficulty, linked to public history', () => {
    const el = load();

    const clickLink = el.querySelector('a[href="/history/gc"]');
    expect(clickLink?.textContent).toContain('7 clicks');
    expect(clickLink?.textContent).toContain('4:00'); // 240s tie-break time
    expect(clickLink?.textContent).toContain('EASY');

    const timeLink = el.querySelector('a[href="/history/gt"]');
    expect(timeLink?.textContent).toContain('3:00'); // 180s
    expect(timeLink?.textContent).toContain('15 clicks');
    expect(timeLink?.textContent).toContain('HARD');
  });

  it('formats average clicks to one decimal place', () => {
    const el = load();
    expect(el.textContent).toContain('12.4');
  });

  it('renders — for null best results and null averages', () => {
    const el = load(
      stats({
        bestClick: null,
        bestTime: null,
        averageClicks: null,
        averageEffectiveTimeMs: null,
      }),
    );
    expect(el.querySelector('a[href^="/history/"]')).toBeNull();
    expect(el.textContent).toContain('—');
  });
});

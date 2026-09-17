import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { errorInterceptor } from '../../core/interceptors/error.interceptor';
import { GameListItemDto } from '../../shared/models/game.model';
import { StatisticsDto } from '../../shared/models/stats.model';
import { Dashboard } from './dashboard';

const STATS: StatisticsDto = {
  completedGames: 3,
  inProgressGames: 2,
  bestClick: null,
  bestTime: null,
  averageClicks: null,
  averageEffectiveTimeMs: null,
};

function game(id: string, over: Partial<GameListItemDto> = {}): GameListItemDto {
  return {
    id,
    mode: 'CLICK',
    difficulty: 'EASY',
    status: 'IN_PROGRESS',
    startPageTitle: 'Start',
    currentPageId: 1,
    currentPageTitle: 'Current',
    clickCount: 0,
    backtrackCount: 0,
    effectivePlayTimeMs: 0,
    startedAt: '2026-08-01T00:00:00.000Z',
    completedAt: null,
    ...over,
  };
}

describe('Dashboard', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<Dashboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Dashboard],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: { user: () => ({ username: 'marco' }), clearUser: vi.fn() },
        },
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Dashboard);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  function flushLoad(games: GameListItemDto[], stats: StatisticsDto = STATS): void {
    http.expectOne('/api/games?status=IN_PROGRESS').flush({ items: games });
    http.expectOne('/api/me/stats').flush(stats);
    fixture.detectChanges();
  }

  it('lists in-progress games and personal statistics', () => {
    flushLoad([game('g1'), game('g2')]);

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('[data-testid="game-row"]')).toHaveLength(2);
    expect(el.textContent).toContain('In-progress games (2/10)');
    expect(el.textContent).toContain('Your statistics');
  });

  it('presents the 10-game limit and disables starting a new game', () => {
    flushLoad(Array.from({ length: 10 }, (_, i) => game('g' + i)));

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('reached the 10-game limit');
    expect(el.querySelector('button.btn[disabled]')?.textContent).toContain('New game');
    expect(el.querySelector('.page-header a.btn')).toBeNull();
  });

  it('deletes an in-progress game after confirmation and drops the row', () => {
    flushLoad([game('g1'), game('g2')]);
    const component = fixture.componentInstance;

    component.askDelete('g1');
    fixture.detectChanges();
    component.confirmDelete(component.inProgress()[0]);

    const req = http.expectOne('/api/games/g1');
    expect(req.request.method).toBe('DELETE');
    expect(req.request.params.keys()).toEqual([]);
    req.flush(null, { status: 204, statusText: 'No Content' });

    expect(component.inProgress().map((g) => g.id)).toEqual(['g2']);
    expect(component.statistics()?.inProgressGames).toBe(1);
  });

  it('does not start a second delete while one is already in flight', () => {
    flushLoad([game('g1'), game('g2')]);
    const component = fixture.componentInstance;

    component.confirmDelete(component.inProgress()[0]);
    http.expectOne('/api/games/g1'); // pending, not flushed

    component.confirmDelete(component.inProgress()[1]);
    http.expectNone('/api/games/g2');
    expect(component.deletingId()).toBe('g1');
  });

  it('refreshes the list when a delete reports the game is no longer in progress', () => {
    flushLoad([game('g1')]);
    const component = fixture.componentInstance;

    component.confirmDelete(component.inProgress()[0]);
    http
      .expectOne('/api/games/g1')
      .flush(
        { error: { code: 'GAME_NOT_IN_PROGRESS', message: 'This game is already completed.' } },
        { status: 409, statusText: 'Conflict' },
      );

    flushLoad([]);
    expect(component.inProgress()).toEqual([]);
    expect(component.error()).toBe('This game is already completed.');
  });
});

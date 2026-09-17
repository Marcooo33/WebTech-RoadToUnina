import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { errorInterceptor } from '../../../core/interceptors/error.interceptor';
import { GameDto } from '../../../shared/models/game.model';
import { GamePage } from './game-page';

function playingGame(over: Partial<GameDto> = {}): GameDto {
  return {
    id: 'g1',
    mode: 'CLICK',
    difficulty: 'EASY',
    status: 'IN_PROGRESS',
    startPageId: 1,
    startPageTitle: 'Start',
    currentPageId: 100,
    currentPageTitle: 'Current',
    clickCount: 0,
    backtrackCount: 0,
    effectivePlayTimeMs: 0,
    playStartedAt: '2026-08-01T00:00:00.000Z',
    startedAt: '2026-08-01T00:00:00.000Z',
    completedAt: null,
    createdAt: '2026-08-01T00:00:00.000Z',
    path: [
      { pageId: 1, title: 'Start' },
      { pageId: 100, title: 'Current' },
    ],
    moves: [],
    ...over,
  };
}

function articleDto(over: Record<string, unknown> = {}) {
  return {
    gameId: 'g1',
    pageId: 100,
    title: 'Current',
    contentHtml: '<p>hi <a data-page-title="Next">next</a></p>',
    links: [{ title: 'Next' }],
    ...over,
  };
}

function preparedState(
  game = playingGame(),
  article: Record<string, unknown> | null = articleDto(),
) {
  return { game, article };
}

function apiError(code: string, status: number) {
  return [{ error: { code, message: `msg:${code}` } }, { status, statusText: 'Conflict' }] as const;
}

describe('GamePage', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<GamePage>;
  let component: GamePage;

  beforeEach(async () => {
    // Fake only interval/Date so the component's heartbeat + timer intervals are
    // deterministic; promises and HttpTestingController stay synchronous.
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });

    await TestBed.configureTestingModule({
      imports: [GamePage],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { clearUser: vi.fn() } },
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(GamePage);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('id', 'g1');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    http.verify();
  });

  /** Drives the combined game + prepared article response to a playing state. */
  function reachPlaying(
    game = playingGame(),
    article: Record<string, unknown> = articleDto(),
  ): void {
    fixture.detectChanges();
    http.expectOne('/api/games/g1').flush(preparedState(game, article));
  }

  it('initializes from one prepared game response without a second article request', () => {
    fixture.detectChanges();

    const gameReq = http.expectOne('/api/games/g1');
    expect(gameReq.request.method).toBe('GET');
    gameReq.flush(preparedState());

    http.expectNone('/api/games/g1/article');
    http.expectNone('/api/games/g1/session');
    expect(component.phase()).toBe('playing');
    expect(component.busy()).toBe(false);
  });

  it('loads a completed game straight into the result state, with no article call', () => {
    fixture.detectChanges();
    http
      .expectOne('/api/games/g1')
      .flush(
        preparedState(
          playingGame({ status: 'COMPLETED', completedAt: '2026-08-01T01:00:00.000Z' }),
          null,
        ),
      );

    http.expectNone('/api/games/g1/article');
    expect(component.phase()).toBe('completed');

    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Target reached');
  });

  it('redirects to the root dashboard when the game is not found', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
    http.expectOne('/api/games/g1').flush(...apiError('GAME_NOT_FOUND', 404));

    expect(navigate).toHaveBeenCalledWith(['/']);
  });

  it('uses the article returned by a successful navigation without another request', () => {
    reachPlaying();

    component.onNavigate('Next');
    const move = http.expectOne('/api/games/g1/moves');
    expect(move.request.method).toBe('POST');
    expect(move.request.body).toEqual({ toTitle: 'Next' });
    move.flush(
      preparedState(
        playingGame({ currentPageId: 200, currentPageTitle: 'Next', clickCount: 1 }),
        articleDto({ pageId: 200, title: 'Next' }),
      ),
    );

    http.expectNone('/api/games/g1/article');

    expect(component.game()?.clickCount).toBe(1);
    expect(component.article()?.pageId).toBe(200);
    expect(component.phase()).toBe('playing');
  });

  it('enters the completed state when a move reaches the target and stops heartbeating', () => {
    reachPlaying();

    component.onNavigate('Forged');
    http.expectOne('/api/games/g1/moves').flush(
      preparedState(
        playingGame({
          status: 'COMPLETED',
          currentPageId: 999,
          currentPageTitle: 'Federico II',
          completedAt: '2026-08-01T01:00:00.000Z',
          effectivePlayTimeMs: 123_456,
          playStartedAt: null,
        }),
        null,
      ),
    );

    http.expectNone('/api/games/g1/article');
    expect(component.phase()).toBe('completed');
    expect(component.displayTimeMs()).toBe(123_456);

    vi.advanceTimersByTime(30_000);
    http.expectNone('/api/games/g1/heartbeat');
  });

  it('sends a plain heartbeat on its interval while playing', () => {
    reachPlaying();

    vi.advanceTimersByTime(12_000);
    const hb = http.expectOne('/api/games/g1/heartbeat');
    expect(hb.request.method).toBe('POST');
    hb.flush(null, { status: 204, statusText: 'No Content' });

    expect(component.phase()).toBe('playing');
  });

  it('reconciles by reloading when a heartbeat reports GAME_NOT_IN_PROGRESS', () => {
    reachPlaying();

    vi.advanceTimersByTime(12_000);
    http.expectOne('/api/games/g1/heartbeat').flush(...apiError('GAME_NOT_IN_PROGRESS', 409));

    // load() re-runs: GET game (now completed) → result state, no article call.
    http
      .expectOne('/api/games/g1')
      .flush(
        preparedState(
          playingGame({ status: 'COMPLETED', completedAt: '2026-08-01T01:00:00.000Z' }),
          null,
        ),
      );
    http.expectNone('/api/games/g1/article');
    expect(component.phase()).toBe('completed');
  });

  it('ignores a transient heartbeat failure without interrupting gameplay', () => {
    reachPlaying();

    vi.advanceTimersByTime(12_000);
    http.expectOne('/api/games/g1/heartbeat').flush(...apiError('INTERNAL_ERROR', 500));

    expect(component.phase()).toBe('playing');
    http.expectNone('/api/games/g1');
  });

  it('reconciles by reloading when a move is rejected as GAME_NOT_IN_PROGRESS', () => {
    reachPlaying();

    component.onNavigate('Next');
    http.expectOne('/api/games/g1/moves').flush(...apiError('GAME_NOT_IN_PROGRESS', 409));

    http
      .expectOne('/api/games/g1')
      .flush(
        preparedState(
          playingGame({ status: 'COMPLETED', completedAt: '2026-08-01T01:00:00.000Z' }),
          null,
        ),
      );
    expect(component.phase()).toBe('completed');
    http.expectNone('/api/games/g1/moves');
  });

  it('reloads a coherent prepared state when a move is rejected as GAME_STATE_CHANGED', () => {
    reachPlaying();

    component.onNavigate('Next');
    http.expectOne('/api/games/g1/moves').flush(...apiError('GAME_STATE_CHANGED', 409));

    const changedGame = playingGame({
      currentPageId: 200,
      currentPageTitle: 'Other tab destination',
      clickCount: 1,
    });
    http
      .expectOne('/api/games/g1')
      .flush(
        preparedState(
          changedGame,
          articleDto({ pageId: 200, title: 'Other tab destination' }),
        ),
      );

    expect(component.phase()).toBe('playing');
    expect(component.busy()).toBe(false);
    expect(component.game()?.currentPageId).toBe(200);
    expect(component.article()?.pageId).toBe(200);
  });

  it('does not fire a second move request while one is already in flight', () => {
    reachPlaying();

    component.onNavigate('Next');
    component.onNavigate('Other');

    const move = http.expectOne('/api/games/g1/moves');
    expect(move.request.body).toEqual({ toTitle: 'Next' });
    http.expectNone('/api/games/g1/moves');

    move.flush(
      preparedState(playingGame({ currentPageId: 200 }), articleDto({ pageId: 200 })),
    );
    http.expectNone('/api/games/g1/article');
  });

  it('refreshes the article when a move is rejected as INVALID_MOVE', () => {
    reachPlaying();

    component.onNavigate('Next');
    http.expectOne('/api/games/g1/moves').flush(...apiError('INVALID_MOVE', 422));

    http.expectOne('/api/games/g1/article').flush(articleDto());
    expect(component.notice()).toContain('no longer available');
    expect(component.phase()).toBe('playing');
  });

  it('keeps the current article usable and continuous timing after MediaWiki failure', () => {
    reachPlaying(playingGame({ effectivePlayTimeMs: 20_000 }));
    const currentArticle = component.article();
    component.onNavigate('Next');
    vi.advanceTimersByTime(5_000);

    http
      .expectOne('/api/games/g1/moves')
      .flush(...apiError('WIKIPEDIA_UNAVAILABLE', 502));

    expect(component.busy()).toBe(false);
    expect(component.article()).toBe(currentArticle);
    expect(component.notice()).toContain('temporarily unavailable');
    expect(component.displayTimeMs()).toBeGreaterThanOrEqual(25_000);
  });

  it.each(['BACKTRACK_NOT_ALLOWED', 'BACKTRACK_LIMIT_REACHED'])(
    'keeps playing without a timing-mutating reload after %s',
    (code) => {
      reachPlaying(playingGame({ effectivePlayTimeMs: 20_000 }));
      const currentArticle = component.article();
      component.onBacktrack();
      vi.advanceTimersByTime(2_000);

      http.expectOne('/api/games/g1/backtrack').flush(...apiError(code, 422));

      http.expectNone('/api/games/g1');
      http.expectNone('/api/games/g1/article');
      expect(component.phase()).toBe('playing');
      expect(component.busy()).toBe(false);
      expect(component.article()).toBe(currentArticle);
      expect(component.displayTimeMs()).toBeGreaterThanOrEqual(22_000);

      vi.advanceTimersByTime(10_000);
      http
        .expectOne('/api/games/g1/heartbeat')
        .flush(null, { status: 204, statusText: 'No Content' });
    },
  );

  it('uses the prepared article returned by backtracking', () => {
    reachPlaying();
    component.onBacktrack();

    http.expectOne('/api/games/g1/backtrack').flush(
      preparedState(
        playingGame({ currentPageId: 1, currentPageTitle: 'Start', backtrackCount: 1 }),
        articleDto({ pageId: 1, title: 'Start' }),
      ),
    );

    http.expectNone('/api/games/g1/article');
    expect(component.article()?.pageId).toBe(1);
    expect(component.game()?.backtrackCount).toBe(1);
  });

  it('rejects a mismatched combined initial payload', () => {
    fixture.detectChanges();
    http
      .expectOne('/api/games/g1')
      .flush(
        preparedState(playingGame({ currentPageId: 100 }), articleDto({ pageId: 200 })),
      );

    expect(component.article()).toBeNull();
    expect(component.phase()).toBe('error');
  });

  it('animates the display timer locally from the server baseline while playing', () => {
    reachPlaying(playingGame({ effectivePlayTimeMs: 60_000 }));

    expect(component.displayTimeMs()).toBe(60_000);
    vi.advanceTimersByTime(10_000);
    expect(component.displayTimeMs()).toBeGreaterThanOrEqual(70_000);
  });

  it('freezes the visual timer and suppresses heartbeats while navigation is loading', () => {
    reachPlaying(playingGame({ effectivePlayTimeMs: 60_000 }));
    vi.advanceTimersByTime(3_000);
    const before = component.displayTimeMs();

    component.onNavigate('Next');
    vi.advanceTimersByTime(24_000);

    expect(component.displayTimeMs()).toBe(before);
    http.expectNone('/api/games/g1/heartbeat');

    http.expectOne('/api/games/g1/moves').flush(
      preparedState(
        playingGame({
          currentPageId: 200,
          effectivePlayTimeMs: 63_000,
          playStartedAt: '2026-08-01T00:00:30.000Z',
        }),
        articleDto({ pageId: 200 }),
      ),
    );
  });

  it('does not re-add MediaWiki preparation when reseeding from the authoritative response', () => {
    reachPlaying(playingGame({ effectivePlayTimeMs: 25_000 }));
    vi.advanceTimersByTime(4_000);
    const authoritativeAtClick = component.displayTimeMs();
    component.onNavigate('Next');
    vi.advanceTimersByTime(3_000);

    expect(component.displayTimeMs()).toBe(authoritativeAtClick);

    http.expectOne('/api/games/g1/moves').flush(
      preparedState(
        playingGame({
          currentPageId: 200,
          // Derived from the server boundary represented by the frozen HUD;
          // the separate backend integration test derives this value across two
          // real prepared-response cycles.
          effectivePlayTimeMs: authoritativeAtClick,
        }),
        articleDto({ pageId: 200 }),
      ),
    );

    expect(component.displayTimeMs()).toBe(authoritativeAtClick);
    expect(component.displayTimeMs()).not.toBe(authoritativeAtClick + 3_000);
    vi.advanceTimersByTime(2_000);
    expect(component.displayTimeMs()).toBeGreaterThanOrEqual(authoritativeAtClick + 2_000);
  });
});

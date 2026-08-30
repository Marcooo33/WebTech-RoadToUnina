import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { errorInterceptor } from '../../../core/interceptors/error.interceptor';
import { SessionResponseDto } from '../../../shared/models/article.model';
import { GameDto, SessionDto } from '../../../shared/models/game.model';
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
    version: 0,
    startedAt: '2026-08-01T00:00:00.000Z',
    completedAt: null,
    createdAt: '2026-08-01T00:00:00.000Z',
    path: [
      { pageId: 1, title: 'Start' },
      { pageId: 100, title: 'Current' },
    ],
    moves: [],
    activeSession: null,
    ...over,
  };
}

function sessionRes(
  over: Partial<Omit<SessionResponseDto, 'session'>> = {},
  session: Partial<SessionDto> = {},
): SessionResponseDto {
  return {
    session: {
      id: 's1',
      gameId: 'g1',
      status: 'ACTIVE',
      startedAt: '2026-08-01T00:00:00.000Z',
      endedAt: null,
      lastHeartbeatAt: '2026-08-01T00:00:30.000Z',
      ...session,
    },
    effectivePlayTimeMs: 0,
    gameVersion: 0,
    ...over,
  };
}

function articleDto(over: Record<string, unknown> = {}) {
  return {
    gameId: 'g1',
    pageId: 100,
    title: 'Current',
    version: 0,
    contentHtml: '<p>hi <a data-page-id="200" data-page-title="Next">next</a></p>',
    links: [{ pageId: 200, title: 'Next' }],
    ...over,
  };
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
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 200 })));

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

  /** Drives the standard init handshake to a `playing` state. */
  function reachPlaying(
    game = playingGame(),
    session = sessionRes(),
    article: Record<string, unknown> = articleDto(),
  ): void {
    fixture.detectChanges();
    http.expectOne('/api/games/g1').flush(game);
    http.expectOne('/api/games/g1/session').flush(session);
    http.expectOne('/api/games/g1/article').flush(article);
  }

  it('initializes with GET game → POST session → GET article and ends in the playing state', () => {
    fixture.detectChanges();

    const gameReq = http.expectOne('/api/games/g1');
    expect(gameReq.request.method).toBe('GET');
    gameReq.flush(playingGame());

    const sessionReq = http.expectOne('/api/games/g1/session');
    expect(sessionReq.request.method).toBe('POST');
    sessionReq.flush(sessionRes());

    http.expectOne('/api/games/g1/article').flush(articleDto());

    expect(component.phase()).toBe('playing');
    expect(component.busy()).toBe(false);
  });

  it('loads a completed game straight into the result state, with no session or article calls', () => {
    fixture.detectChanges();
    http
      .expectOne('/api/games/g1')
      .flush(playingGame({ status: 'COMPLETED', completedAt: '2026-08-01T01:00:00.000Z' }));

    http.expectNone('/api/games/g1/session');
    http.expectNone('/api/games/g1/article');
    expect(component.phase()).toBe('completed');

    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Target reached');
  });

  it('redirects to the dashboard when the game is not found', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
    http.expectOne('/api/games/g1').flush(...apiError('GAME_NOT_FOUND', 404));

    expect(navigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it('applies a successful navigation and reloads the article for the new page', () => {
    reachPlaying();

    component.onNavigate(200);
    const move = http.expectOne('/api/games/g1/moves');
    expect(move.request.body).toEqual({ toPageId: 200, version: 0 });
    move.flush(
      playingGame({ version: 1, currentPageId: 200, currentPageTitle: 'Next', clickCount: 1 }),
    );

    http
      .expectOne('/api/games/g1/article')
      .flush(articleDto({ version: 1, pageId: 200, title: 'Next' }));

    expect(component.game()?.clickCount).toBe(1);
    expect(component.article()?.pageId).toBe(200);
    expect(component.phase()).toBe('playing');
  });

  it('enters the completed state when a move reaches the target and stops heartbeating', () => {
    reachPlaying();

    component.onNavigate(999);
    http.expectOne('/api/games/g1/moves').flush(
      playingGame({
        status: 'COMPLETED',
        version: 1,
        currentPageId: 999,
        currentPageTitle: 'Federico II',
        completedAt: '2026-08-01T01:00:00.000Z',
        effectivePlayTimeMs: 123_456,
      }),
    );

    http.expectNone('/api/games/g1/article');
    expect(component.phase()).toBe('completed');
    expect(component.displayTimeMs()).toBe(123_456);

    vi.advanceTimersByTime(30_000);
    http.expectNone('/api/games/g1/session/heartbeat');
  });

  it('recovers from STALE_VERSION via a single authoritative resync and does not retry the move', () => {
    reachPlaying();

    component.onNavigate(200);
    http.expectOne('/api/games/g1/moves').flush(...apiError('STALE_VERSION', 409));

    http.expectOne('/api/games/g1').flush(playingGame({ version: 1 }));
    http
      .expectOne('/api/games/g1/session')
      .flush(sessionRes({ gameVersion: 1, effectivePlayTimeMs: 4_000 }));
    http.expectOne('/api/games/g1/article').flush(articleDto({ version: 1 }));

    expect(component.phase()).toBe('playing');
    expect(component.game()?.version).toBe(1);
    expect(component.notice()).toContain('changed');
    http.expectNone('/api/games/g1/moves');
  });

  it('recovers from NO_ACTIVE_SESSION: reload → new session → article reload → usable, no retry', () => {
    reachPlaying();

    component.onNavigate(200);
    http.expectOne('/api/games/g1/moves').flush(...apiError('NO_ACTIVE_SESSION', 409));

    // Authoritative reload first — the expired session bumped the version; the
    // replacement session has a new id, so the timer baseline is re-seeded.
    http.expectOne('/api/games/g1').flush(playingGame({ version: 2 }));
    http
      .expectOne('/api/games/g1/session')
      .flush(sessionRes({ gameVersion: 2, effectivePlayTimeMs: 9_000 }, { id: 's2' }));
    http.expectOne('/api/games/g1/article').flush(articleDto({ version: 2 }));

    expect(component.phase()).toBe('playing');
    expect(component.busy()).toBe(false);
    expect(component.game()?.version).toBe(2);
    expect(component.notice()).toContain('resumed');
    http.expectNone('/api/games/g1/moves');
  });

  it('does not rewind the visual timer during a same-session STALE_VERSION resync', () => {
    reachPlaying(
      playingGame({ effectivePlayTimeMs: 60_000 }),
      sessionRes({ effectivePlayTimeMs: 60_000 }),
    );

    vi.advanceTimersByTime(20_000);
    const beforeResync = component.displayTimeMs();
    expect(beforeResync).toBeGreaterThanOrEqual(79_000);

    component.onNavigate(200);
    http.expectOne('/api/games/g1/moves').flush(...apiError('STALE_VERSION', 409));

    // POST /session is idempotent: it returns the SAME still-running session,
    // whose accumulated total does not include the running time.
    http.expectOne('/api/games/g1').flush(playingGame({ version: 1, effectivePlayTimeMs: 60_000 }));
    http
      .expectOne('/api/games/g1/session')
      .flush(sessionRes({ gameVersion: 1, effectivePlayTimeMs: 60_000 }));
    http.expectOne('/api/games/g1/article').flush(articleDto({ version: 1 }));

    expect(component.displayTimeMs()).toBeGreaterThanOrEqual(beforeResync);
  });

  it('does not let a successful heartbeat push the visual timer backwards', () => {
    reachPlaying(
      playingGame({ effectivePlayTimeMs: 60_000 }),
      sessionRes({ effectivePlayTimeMs: 60_000 }),
    );

    vi.advanceTimersByTime(30_000);
    const beforeHeartbeat = component.displayTimeMs();
    expect(beforeHeartbeat).toBeGreaterThanOrEqual(89_000);

    // Heartbeat response carries the *accumulated* total (running session not folded in).
    http
      .expectOne('/api/games/g1/session/heartbeat')
      .flush(sessionRes({ effectivePlayTimeMs: 60_000 }));

    expect(component.displayTimeMs()).toBeGreaterThanOrEqual(beforeHeartbeat);
  });

  it('discards an article whose version does not match the game and resyncs instead of rendering it', () => {
    fixture.detectChanges();
    http.expectOne('/api/games/g1').flush(playingGame({ version: 0 }));
    http.expectOne('/api/games/g1/session').flush(sessionRes({ gameVersion: 0 }));

    // Stale: the game is at version 0 but this article is for version 2.
    http.expectOne('/api/games/g1/article').flush(articleDto({ version: 2 }));

    expect(component.phase()).toBe('loading');
    expect(component.article()).toBeNull();

    // Centralized resync kicks in.
    http.expectOne('/api/games/g1').flush(playingGame({ version: 2 }));
    http.expectOne('/api/games/g1/session').flush(sessionRes({ gameVersion: 2 }));
    http.expectOne('/api/games/g1/article').flush(articleDto({ version: 2 }));

    expect(component.phase()).toBe('playing');
    expect(component.article()?.version).toBe(2);
  });

  it('does not fire a second move request while one is already in flight', () => {
    reachPlaying();

    component.onNavigate(200);
    component.onNavigate(201);

    const move = http.expectOne('/api/games/g1/moves');
    expect(move.request.body).toEqual({ toPageId: 200, version: 0 });
    http.expectNone('/api/games/g1/moves');

    move.flush(
      playingGame({ status: 'COMPLETED', version: 1, completedAt: '2026-08-01T01:00:00.000Z' }),
    );
  });

  it('refreshes the article (no resync) when a move is rejected as INVALID_MOVE', () => {
    reachPlaying();

    component.onNavigate(200);
    http.expectOne('/api/games/g1/moves').flush(...apiError('INVALID_MOVE', 422));

    http.expectOne('/api/games/g1/article').flush(articleDto());
    expect(component.notice()).toContain('no longer available');
    expect(component.phase()).toBe('playing');
  });

  it('sends a best-effort session end on teardown while playing', () => {
    reachPlaying();
    fixture.destroy();

    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/games/g1/session/end',
      expect.objectContaining({ method: 'POST', keepalive: true }),
    );
  });
});

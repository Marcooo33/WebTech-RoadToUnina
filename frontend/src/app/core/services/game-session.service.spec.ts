import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SessionResponseDto } from '../../shared/models/article.model';
import { GameSessionService } from './game-session.service';

const SESSION_RESPONSE: SessionResponseDto = {
  session: {
    id: 's1',
    gameId: 'g1',
    status: 'ACTIVE',
    startedAt: '2026-08-01T00:00:00.000Z',
    endedAt: null,
    lastHeartbeatAt: '2026-08-01T00:00:30.000Z',
  },
  effectivePlayTimeMs: 12_000,
  gameVersion: 3,
};

describe('GameSessionService', () => {
  let service: GameSessionService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(GameSessionService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('POSTs an empty body to start/resume the session', () => {
    service.start('g1').subscribe();
    const req = http.expectOne('/api/games/g1/session');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush(SESSION_RESPONSE);
  });

  it('POSTs the heartbeat endpoint', () => {
    service.heartbeat('g1').subscribe();
    const req = http.expectOne('/api/games/g1/session/heartbeat');
    expect(req.request.method).toBe('POST');
    req.flush(SESSION_RESPONSE);
  });

  it('endOnTeardown fires a best-effort keepalive POST to the end endpoint', () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    service.endOnTeardown('g 1');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/games/g%201/session/end');
    expect(init).toMatchObject({ method: 'POST', credentials: 'include', keepalive: true });

    vi.unstubAllGlobals();
  });
});

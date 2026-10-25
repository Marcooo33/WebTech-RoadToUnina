import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { GuestGamesService } from './guest-games.service';
import { credentialsInterceptor } from '../interceptors/credentials.interceptor';

describe('GuestGamesService', () => {
  let service: GuestGamesService;
  let http: HttpTestingController;
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([credentialsInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(GuestGamesService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify();
    localStorage.clear();
  });
  it('creates without client-selected options and sends CSRF header/credentials', () => {
    service.create().subscribe();
    const request = http.expectOne('/api/guest-games');
    expect(request.request.body).toEqual({});
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.headers.get('X-Requested-With')).toBe('ROADTOUNINA');
    request.flush({
      game: { id: 'game', status: 'IN_PROGRESS' },
      revision: 1,
      article: null,
      expiresAt: '',
    });
  });
  it('uses the server revision for moves and retains only a claim hint', () => {
    const id = '00000000-0000-4000-8000-000000000001';
    service.get(id).subscribe();
    http
      .expectOne(`/api/guest-games/${id}`)
      .flush({ game: { id, status: 'IN_PROGRESS' }, revision: 7 });
    service.move(id, 'Napoli').subscribe();
    const request = http.expectOne(`/api/guest-games/${id}/moves`);
    expect(request.request.body).toEqual({ toTitle: 'Napoli', revision: 7 });
    request.flush({ game: { id, status: 'COMPLETED' }, revision: 8 });
    expect(service.pending()).toEqual({ gameId: id, action: 'claim' });
    service.remember(id, 'discard');
    service.remember(id, 'claim');
    expect(service.pending()?.action).toBe('claim');
  });
  it('sends unload pause with keepalive, revision, credentials and custom header', () => {
    service.summary().subscribe();
    http.expectOne('/api/guest-games').flush({ game: { id: 'game' }, revision: 4 });
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response());
    service.pauseOnExit('game');
    expect(fetch).toHaveBeenCalledWith(
      '/api/guest-games/game/pause',
      expect.objectContaining({
        keepalive: true,
        credentials: 'same-origin',
        body: '{"revision":4}',
        headers: expect.objectContaining({ 'X-Requested-With': 'ROADTOUNINA' }),
      }),
    );
    fetch.mockRestore();
  });
  it('shares concurrent identity summaries and starts a fresh read after completion', () => {
    let received = 0;
    service.summary().subscribe(() => received++);
    service.summary().subscribe(() => received++);
    http.expectOne('/api/guest-games').flush({ game: null, revision: null });
    expect(received).toBe(2);
    service.summary().subscribe();
    http.expectOne('/api/guest-games').flush({ game: null, revision: null });
  });
});

import { errorInterceptor } from '../interceptors/error.interceptor';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PostAuthGuestService } from './post-auth-guest.service';
import { AuthService } from './auth.service';
import { GuestGamesService } from '../services/guest-games.service';
import { ApiError } from '../../shared/models/api-error.model';
import { throwError } from 'rxjs';
const id = '00000000-0000-4000-8000-000000000001';
describe('PostAuthGuestService', () => {
  let service: PostAuthGuestService;
  let http: HttpTestingController;
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: {
            user: () => ({ id: 'user' }),
            isAuthenticated: () => true,
            clearUser: () => {},
          },
        },
      ],
    });
    service = TestBed.inject(PostAuthGuestService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify();
    localStorage.clear();
    vi.useRealTimers();
  });
  it('automatically claims completed games and coalesces duplicate continuation calls', async () => {
    const finish = service.finish();
    expect(service.finish()).toBe(finish);
    http.expectOne('/api/guest-games').flush({ game: { id, status: 'COMPLETED' }, revision: 3 });
    await Promise.resolve();
    http.expectOne(`/api/guest-games/${id}/claim`).flush({ gameId: id, status: 'COMPLETED' });
    await finish;
    expect(service.message()).toBeNull();
    expect(TestBed.inject(GuestGamesService).pending()).toBeNull();
    await service.finish();
    http.expectNone('/api/guest-games');
  });
  it('explicitly discards unfinished games instead of claiming', async () => {
    const finish = service.finish();
    http.expectOne('/api/guest-games').flush({ game: { id, status: 'IN_PROGRESS' }, revision: 9 });
    await Promise.resolve();
    const request = http.expectOne(`/api/guest-games/${id}`);
    expect(request.request.method).toBe('DELETE');
    expect(request.request.body).toEqual({ revision: 9 });
    request.flush(null);
    await finish;
    expect(service.message()).toBeNull();
  });
  it('explains permanent loss and clears the recovery hint', async () => {
    TestBed.inject(GuestGamesService).remember(id, 'claim');
    const finish = service.finish();
    http.expectOne('/api/guest-games').flush({ game: null });
    await Promise.resolve();
    http
      .expectOne(`/api/guest-games/${id}/claim`)
      .flush({ error: { code: 'GAME_NOT_FOUND' } }, { status: 404, statusText: 'Not found' });
    await finish;
    expect(service.retryable()).toBe(false);
    expect(service.message()).toContain('could not be saved');
  });
  it('retains pending result after bounded retries without changing authentication', async () => {
    vi.useFakeTimers();
    const guests = TestBed.inject(GuestGamesService);
    vi.spyOn(guests, 'summary').mockReturnValue(
      throwError(() => new ApiError(503, 'GUEST_CLAIM_FAILED', 'temporary')),
    );
    guests.remember(id, 'claim');
    const finish = service.finish();
    await vi.advanceTimersByTimeAsync(4000);
    await finish;
    expect(service.retryable()).toBe(true);
    expect(service.message()).toContain('has not been saved');
    expect(guests.pending()?.gameId).toBe(id);
  });
  it('keeps the claim hint when authentication expires', async () => {
    const guests = TestBed.inject(GuestGamesService);
    guests.remember(id, 'claim');
    const finish = service.finish();
    http.expectOne('/api/guest-games').flush({ game: null });
    await Promise.resolve();
    http
      .expectOne(`/api/guest-games/${id}/claim`)
      .flush(
        { error: { code: 'AUTHENTICATION_REQUIRED', message: 'Authentication required' } },
        { status: 401, statusText: 'Unauthorized' },
      );
    await finish;
    expect(guests.pending()?.gameId).toBe(id);
    expect(service.message()).toContain('Log in again');
  });
  it('claims the authoritative completed result despite a stale discard hint', async () => {
    const guests = TestBed.inject(GuestGamesService);
    guests.remember(id, 'discard');
    // Even unavailable storage must not let the old hint override server status.
    vi.spyOn(guests, 'remember').mockImplementation(() => {});
    const finish = service.finish();
    http.expectOne('/api/guest-games').flush({ game: { id, status: 'COMPLETED' }, revision: 8 });
    await Promise.resolve();
    http.expectNone((req) => req.method === 'DELETE');
    http.expectOne(`/api/guest-games/${id}/claim`).flush({ gameId: id, status: 'COMPLETED' });
    await finish;
    expect(guests.pending()).toBeNull();
    expect(service.message()).toBeNull();
  });

  for (const operation of ['creation', 'replacement']) {
    it(`waits for pending ${operation} before discarding the resolved unfinished game`, async () => {
      vi.useFakeTimers();
      const finish = service.finish();
      http
        .expectOne('/api/guest-games')
        .flush(
          { error: { code: 'GUEST_GAME_BUSY', message: 'Pending operation' } },
          { status: 409, statusText: 'Conflict' },
        );
      await vi.advanceTimersByTimeAsync(1000);
      http
        .expectOne('/api/guest-games')
        .flush({ game: { id, status: 'IN_PROGRESS' }, revision: 1 });
      await Promise.resolve();
      http.expectOne(`/api/guest-games/${id}`).flush(null);
      await finish;
      expect(service.message()).toBeNull();
      expect(service.retryable()).toBe(false);
    });
  }

  it('does not settle after bounded busy retries; a later call reconciles again', async () => {
    vi.useFakeTimers();
    const guests = TestBed.inject(GuestGamesService);
    const summary = vi
      .spyOn(guests, 'summary')
      .mockReturnValue(throwError(() => new ApiError(409, 'GUEST_GAME_BUSY', 'Pending creation')));
    const finish = service.finish();
    await vi.advanceTimersByTimeAsync(4000);
    await finish;
    expect(summary).toHaveBeenCalledTimes(3);
    expect(service.retryable()).toBe(true);
    summary.mockRestore();
    const retry = service.finish();
    http.expectOne('/api/guest-games').flush({ game: null, revision: null });
    await retry;
    expect(service.message()).toBeNull();
  });

  it('reconciles completion between summary and discard rather than deleting the result', async () => {
    vi.useFakeTimers();
    const finish = service.finish();
    http.expectOne('/api/guest-games').flush({ game: { id, status: 'IN_PROGRESS' }, revision: 7 });
    await Promise.resolve();
    http
      .expectOne(`/api/guest-games/${id}`)
      .flush(
        { error: { code: 'GUEST_GAME_CHANGED', message: 'Completed meanwhile' } },
        { status: 409, statusText: 'Conflict' },
      );
    await vi.advanceTimersByTimeAsync(1000);
    http.expectOne('/api/guest-games').flush({ game: { id, status: 'COMPLETED' }, revision: 8 });
    await Promise.resolve();
    http.expectOne(`/api/guest-games/${id}/claim`).flush({ gameId: id, status: 'COMPLETED' });
    await finish;
    expect(service.message()).toBeNull();
  });
});

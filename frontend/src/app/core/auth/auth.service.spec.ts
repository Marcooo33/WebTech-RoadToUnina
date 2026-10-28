import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from './auth.service';
import { UserProfileDto } from '../../shared/models/user.model';

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('restores a valid session and reuses the resolved identity', () => {
    const user = { id: 'user', username: 'player' } as UserProfileDto;
    let status: string | undefined;
    service.bootstrap().subscribe((value) => (status = value));
    http.expectOne('/api/auth/me').flush(user);

    expect(status).toBe('authenticated');
    expect(service.user()).toEqual(user);
    service.bootstrap().subscribe((value) => expect(value).toBe('authenticated'));
    http.expectNone('/api/auth/me');
  });

  it('unblocks public navigation after five seconds without discarding guest recovery', () => {
    vi.useFakeTimers();
    const pending = JSON.stringify({ gameId: 'pending-game', action: 'claim' });
    localStorage.setItem('roadtounina.pendingGuestAction', pending);
    let status: string | undefined;
    let completed = false;
    service.bootstrap().subscribe({
      next: (value) => (status = value),
      complete: () => (completed = true),
    });
    const request = http.expectOne('/api/auth/me');

    vi.advanceTimersByTime(4_999);
    expect(service.status()).toBe('unknown');
    expect(completed).toBe(false);
    vi.advanceTimersByTime(1);

    expect(status).toBe('anonymous');
    expect(completed).toBe(true);
    expect(request.cancelled).toBe(true);
    expect(localStorage.getItem('roadtounina.pendingGuestAction')).toBe(pending);
  });

  it('falls back to anonymous when the session endpoint is unavailable', () => {
    let status: string | undefined;
    service.bootstrap().subscribe((value) => (status = value));
    http.expectOne('/api/auth/me').flush({}, { status: 503, statusText: 'Unavailable' });

    expect(status).toBe('anonymous');
    expect(service.user()).toBeNull();
  });
});

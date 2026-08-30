import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { UserProfileDto } from '../../shared/models/user.model';
import { AuthService } from './auth.service';

const USER: UserProfileDto = {
  id: 'u1',
  username: 'marco',
  email: 'marco@example.com',
  avatarUrl: null,
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('login sets the user signal and authenticated status', () => {
    service.login('marco', 'secret').subscribe();

    const req = http.expectOne('/api/auth/login');
    expect(req.request.method).toBe('POST');
    req.flush(USER);

    expect(service.user()).toEqual(USER);
    expect(service.isAuthenticated()).toBe(true);
  });

  it('bootstrap resolves to anonymous when /auth/me returns 401', async () => {
    const promise = firstValueFrom(service.bootstrap());

    http
      .expectOne('/api/auth/me')
      .flush(
        { error: { code: 'AUTHENTICATION_REQUIRED', message: 'nope' } },
        { status: 401, statusText: 'Unauthorized' },
      );

    await promise;
    expect(service.status()).toBe('anonymous');
    expect(service.isAuthenticated()).toBe(false);
  });
});

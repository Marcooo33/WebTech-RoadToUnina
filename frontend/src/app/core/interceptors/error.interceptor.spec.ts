import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiError } from '../../shared/models/api-error.model';
import { AuthService } from '../auth/auth.service';
import { errorInterceptor } from './error.interceptor';

describe('errorInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let clearUser: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    clearUser = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { clearUser } },
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('maps a backend error body to an ApiError', async () => {
    const promise = new Promise<unknown>((resolve) => {
      http.get('/api/games').subscribe({ error: resolve });
    });

    controller.expectOne('/api/games').flush(
      {
        error: {
          code: 'GAME_NOT_FOUND',
          message: 'Game does not exist',
          details: [{ path: 'x' }],
        },
      },
      { status: 404, statusText: 'Not Found' },
    );

    const err = (await promise) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('GAME_NOT_FOUND');
    expect(err.status).toBe(404);
    expect(err.message).toBe('Game does not exist');
  });

  it('calls AuthService.clearUser on a 401', async () => {
    const promise = new Promise<unknown>((resolve) => {
      http.get('/api/me/stats').subscribe({ error: resolve });
    });

    controller
      .expectOne('/api/me/stats')
      .flush(
        { error: { code: 'AUTHENTICATION_REQUIRED', message: 'nope' } },
        { status: 401, statusText: 'Unauthorized' },
      );

    await promise;
    expect(clearUser).toHaveBeenCalledOnce();
  });
});

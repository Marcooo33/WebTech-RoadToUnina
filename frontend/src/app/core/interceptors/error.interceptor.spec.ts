import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../auth/auth.service';
import { ApiError } from '../../shared/models/api-error.model';
import { errorInterceptor } from './error.interceptor';

describe('Italian HTTP errors', () => {
  let http: HttpClient;
  let requests: HttpTestingController;
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
    requests = TestBed.inject(HttpTestingController);
  });
  afterEach(() => requests.verify());

  it.each([
    [401, 'AUTHENTICATION_REQUIRED', 'Authentication required', 'La sessione è scaduta'],
    [401, 'INVALID_CREDENTIALS', 'Invalid credentials', 'non corretti'],
    [409, 'USERNAME_TAKEN', 'Username is already taken', 'già in uso'],
    [400, 'VALIDATION_ERROR', 'newPassword must be between 8 and 128 characters', 'da 8 a 128'],
    [400, 'VALIDATION_ERROR', 'Unknown validation detail', 'Controlla i dati'],
    [503, 'FUTURE_ERROR', 'English upstream failure', 'temporaneamente non disponibile'],
    [409, 'FUTURE_ERROR', 'English upstream failure', 'Operazione non riuscita'],
  ])('localizes %s %s while preserving error identity', (status, code, message, expected) => {
    let received: ApiError | undefined;
    http.get('/api/example').subscribe({ error: (error) => (received = error) });
    requests
      .expectOne('/api/example')
      .flush({ error: { code, message } }, { status, statusText: 'Error' });
    expect(received).toBeInstanceOf(ApiError);
    expect(received?.code).toBe(code);
    expect(received?.status).toBe(status);
    expect(received?.message).toContain(expected);
    expect(clearUser).toHaveBeenCalledTimes(code === 'AUTHENTICATION_REQUIRED' ? 1 : 0);
  });

  it('handles offline requests without changing authentication', () => {
    let received: ApiError | undefined;
    http.get('/api/example').subscribe({ error: (error) => (received = error) });
    requests.expectOne('/api/example').error(new ProgressEvent('error'));
    expect(received?.code).toBe('NETWORK_ERROR');
    expect(received?.status).toBe(0);
    expect(received?.message).toContain('Controlla la connessione');
    expect(clearUser).not.toHaveBeenCalled();
  });

  it('does not display HTML returned by a proxy', () => {
    let received: ApiError | undefined;
    http.get('/api/example').subscribe({ error: (error) => (received = error) });
    requests
      .expectOne('/api/example')
      .flush('<h1>Bad gateway</h1>', { status: 502, statusText: 'Bad gateway' });
    expect(received?.message).toContain('errore del server');
    expect(received?.message).not.toContain('Bad gateway');
  });
});

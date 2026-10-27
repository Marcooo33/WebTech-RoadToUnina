import { italianErrorMessage } from './italian-errors';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ApiError } from '../../shared/models/api-error.model';
import { AuthService } from '../auth/auth.service';

interface BackendErrorBody {
  error?: { code?: string; message?: string };
}

// Converts every failed HTTP response into an ApiError so components never
// touch HttpErrorResponse directly. A 401 also resets local auth state.
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);

  return next(req).pipe(
    catchError((error: unknown) => {
      const apiError = toApiError(error);

      // Rejected/expired session: drop local auth state so the UI reflects it.
      if (apiError.status === 401 && apiError.code === 'AUTHENTICATION_REQUIRED') {
        auth.clearUser();
      }

      return throwError(() => apiError);
    }),
  );
};

function toApiError(error: unknown): ApiError {
  if (!(error instanceof HttpErrorResponse)) {
    return new ApiError(0, 'UNKNOWN_ERROR', 'Si è verificato un errore imprevisto.');
  }

  // status 0 => the request never reached the server (offline, CORS, DNS…).
  if (error.status === 0) {
    return new ApiError(
      0,
      'NETWORK_ERROR',
      'Impossibile contattare il server. Controlla la connessione e riprova.',
    );
  }

  const body = error.error as BackendErrorBody | string | null;
  const parsed = typeof body === 'object' && body !== null ? body.error : undefined;

  const code = parsed?.code ?? 'INTERNAL_ERROR';
  return new ApiError(error.status, code, italianErrorMessage(code, error.status, parsed?.message));
}

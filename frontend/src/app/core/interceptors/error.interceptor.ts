import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ApiError } from '../../shared/models/api-error.model';
import { AuthService } from '../auth/auth.service';

interface BackendErrorBody {
  error?: { code?: string; message?: string };
}

/**
 * Converts every failed HTTP response into an {@link ApiError} with the stable
 * `{ error: { code, message } }` shape from docs/api.md §2.5, so components
 * never touch `HttpErrorResponse` directly. A `401` additionally resets local
 * auth state.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);

  return next(req).pipe(
    catchError((error: unknown) => {
      const apiError = toApiError(error);

      // A rejected/expired session — drop local auth state so the UI reflects it.
      if (apiError.status === 401 && apiError.code === 'AUTHENTICATION_REQUIRED') {
        auth.clearUser();
      }

      return throwError(() => apiError);
    }),
  );
};

function toApiError(error: unknown): ApiError {
  if (!(error instanceof HttpErrorResponse)) {
    return new ApiError(0, 'UNKNOWN_ERROR', 'An unexpected error occurred.');
  }

  // status 0 => the request never reached the server (offline, CORS, DNS…).
  if (error.status === 0) {
    return new ApiError(
      0,
      'NETWORK_ERROR',
      'Cannot reach the server. Check your connection and try again.',
    );
  }

  const body = error.error as BackendErrorBody | string | null;
  const parsed = typeof body === 'object' && body !== null ? body.error : undefined;

  if (parsed?.message) {
    return new ApiError(
      error.status,
      parsed.code ?? 'INTERNAL_ERROR',
      parsed.message,
    );
  }

  // No standard envelope (e.g. a proxy returned a 502 with an HTML/empty body).
  // Never surface Angular's raw "Http failure response for …" string to the user.
  const fallback =
    error.status >= 500
      ? 'The server is temporarily unavailable. Please try again.'
      : 'Request failed. Please try again.';

  return new ApiError(error.status, parsed?.code ?? 'INTERNAL_ERROR', fallback);
}

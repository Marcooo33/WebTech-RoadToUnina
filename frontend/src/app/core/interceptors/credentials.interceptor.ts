import { HttpInterceptorFn } from '@angular/common/http';

/**
 * Ensures every request carries cookies. Authentication is a JWT in an HttpOnly
 * cookie (docs/api.md §2.3); the browser only attaches it cross-context when
 * `withCredentials` is set. Harmless for the same-origin dev proxy, required if
 * the API is ever served from another origin.
 */
export const credentialsInterceptor: HttpInterceptorFn = (req, next) =>
  next(req.clone({ withCredentials: true }));

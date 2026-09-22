import { HttpInterceptorFn } from '@angular/common/http';

// Auth is a JWT in an HttpOnly cookie. The browser only sends it across
// origins if withCredentials is set; harmless for the same-origin dev proxy.
export const credentialsInterceptor: HttpInterceptorFn = (req, next) =>
  next(req.clone({ withCredentials: true }));

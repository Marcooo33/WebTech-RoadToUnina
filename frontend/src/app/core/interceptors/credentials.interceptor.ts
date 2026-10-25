import { HttpInterceptorFn } from '@angular/common/http';

// Auth is a JWT in an HttpOnly cookie. The browser only sends it across
// origins if withCredentials is set; harmless for the same-origin dev proxy.
export const credentialsInterceptor: HttpInterceptorFn = (req, next) => {
  const protectedRequest =
    req.url.startsWith('/api/guest-games') || /^\/api\/auth\/(login|register)$/.test(req.url);
  return next(
    req.clone({
      withCredentials: true,
      ...(protectedRequest ? { setHeaders: { 'X-Requested-With': 'ROADTOUNINA' } } : {}),
    }),
  );
};

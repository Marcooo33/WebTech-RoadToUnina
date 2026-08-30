/**
 * Base path for every backend call.
 *
 * Relative on purpose: in development the Angular dev server proxies `/api` to
 * the Express backend (`frontend/proxy.conf.json`); in production the SPA is
 * expected to be served from the same origin as the API (reverse proxy).
 */
export const API_BASE = '/api';

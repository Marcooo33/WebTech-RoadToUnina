// Relative on purpose: the Angular dev server proxies /api to the Express
// backend (frontend/proxy.conf.json), and in production the SPA is served
// from the same origin as the API.
export const API_BASE = '/api';

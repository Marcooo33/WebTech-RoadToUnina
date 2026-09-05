/**
 * Normalized client-side representation of a backend error response.
 *
 * The backend always returns `{ error: { code, message } }` (docs/api.md §2.5).
 * The HTTP error interceptor converts every failed request into an instance of
 * this class so components have a single shape to handle.
 */
export class ApiError extends Error {
  constructor(
    /** HTTP status code (`0` for network/transport failures). */
    readonly status: number,
    /** Machine-readable code from docs/api.md §2.6, or a synthetic fallback. */
    readonly code: string,
    /** Human-readable summary safe to show to the user. */
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** True when the failure was a missing/invalid/expired session. */
  get isAuthError(): boolean {
    return this.status === 401;
  }
}

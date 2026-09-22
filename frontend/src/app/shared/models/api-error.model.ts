// Backend errors always come back as { error: { code, message } }. The HTTP
// interceptor wraps every failed request into this class so components deal
// with one shape.
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isAuthError(): boolean {
    return this.status === 401;
  }
}

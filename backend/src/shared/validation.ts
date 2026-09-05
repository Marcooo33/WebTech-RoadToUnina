import { ApiError, ErrorCode } from "./errors.js";

/**
 * A 400 the error middleware renders as
 * `{ error: { code: "VALIDATION_ERROR", message } }`.
 *
 * HTTP request input is validated explicitly at the controller boundary with
 * small `parse*` functions per module (`*.validation.ts`); each throws this when
 * the untrusted body / query / route param does not match what the endpoint
 * accepts. Domain rules stay in the services.
 */
export function validationError(message: string): ApiError {
  return new ApiError(400, ErrorCode.VALIDATION_ERROR, message);
}

/** Narrows an untrusted JSON value to a plain object, rejecting `null` and arrays. */
export function asObject(
  value: unknown,
  message = "Invalid request body",
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw validationError(message);
  }

  return value as Record<string, unknown>;
}

/**
 * Rejects the request body if it carries any key not in `allowed`. A write
 * endpoint only reads the fields it documents, so an unexpected field means the
 * client is trying to set server-authoritative state (`status`, `clickCount`, a
 * `version`, …) and the request is refused rather than silently ignored.
 */
export function rejectUnknownKeys(
  body: Record<string, unknown>,
  allowed: readonly string[],
  message: string,
): void {
  for (const key of Object.keys(body)) {
    if (!allowed.includes(key)) {
      throw validationError(message);
    }
  }
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True for a canonical 8-4-4-4-12 hex UUID (the `users.id` / `games.id` column type). */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

/**
 * Parses an optional positive-integer query-string parameter (`page`, `limit`).
 * Express query values are always strings; only a bare decimal with no leading
 * zero, sign, fraction or exponent is accepted. Returns `fallback` when absent.
 */
export function parsePositiveIntParam(
  value: unknown,
  field: string,
  options: { fallback: number; max?: number },
): number {
  if (value === undefined) {
    return options.fallback;
  }

  if (typeof value !== "string" || !/^[1-9][0-9]*$/.test(value)) {
    throw validationError(`Invalid ${field}`);
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed)) {
    throw validationError(`Invalid ${field}`);
  }

  if (options.max !== undefined && parsed > options.max) {
    throw validationError(`${field} must not exceed ${options.max}`);
  }

  return parsed;
}

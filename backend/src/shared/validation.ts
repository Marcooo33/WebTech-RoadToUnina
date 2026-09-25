import { ApiError, ErrorCode } from "./errors.js";

/** 400 thrown by the `parse*` functions when request input is invalid. */
export function validationError(message: string): ApiError {
  return new ApiError(400, ErrorCode.VALIDATION_ERROR, message);
}

/** Narrows an untrusted value to a plain object (no `null`, no arrays). */
export function asObject(
  value: unknown,
  message = "Invalid request body",
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw validationError(message);
  }

  return value as Record<string, unknown>;
}

/** Rejects the body if it contains any key not in `allowed`. */
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

/** True for a canonical 8-4-4-4-12 hex UUID. */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

/** Parses an optional positive-integer query param; `fallback` when absent. */
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

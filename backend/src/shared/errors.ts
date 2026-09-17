export const ErrorCode = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_JSON: "INVALID_JSON",
  NOT_FOUND: "NOT_FOUND",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  AUTHENTICATION_REQUIRED: "AUTHENTICATION_REQUIRED",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  USERNAME_TAKEN: "USERNAME_TAKEN",
  EMAIL_TAKEN: "EMAIL_TAKEN",
  GAME_NOT_FOUND: "GAME_NOT_FOUND",
  GAME_LIMIT_REACHED: "GAME_LIMIT_REACHED",
  GAME_NOT_IN_PROGRESS: "GAME_NOT_IN_PROGRESS",
  GAME_STATE_CHANGED: "GAME_STATE_CHANGED",
  INVALID_MOVE: "INVALID_MOVE",
  BACKTRACK_NOT_ALLOWED: "BACKTRACK_NOT_ALLOWED",
  BACKTRACK_LIMIT_REACHED: "BACKTRACK_LIMIT_REACHED",
  WIKIPEDIA_UNAVAILABLE: "WIKIPEDIA_UNAVAILABLE",
  NO_STARTING_PAGE: "NO_STARTING_PAGE",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface ErrorBody {
  error: {
    code: ErrorCode;
    message: string;
  };
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function errorBody(code: ErrorCode, message: string): ErrorBody {
  return { error: { code, message } };
}

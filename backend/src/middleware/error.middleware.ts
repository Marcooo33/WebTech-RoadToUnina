import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { ApiError, ErrorCode, errorBody } from "../shared/errors.js";

function isJsonParseError(error: unknown): boolean {
  if (!(error instanceof SyntaxError)) {
    return false;
  }

  return (error as { type?: string }).type === "entity.parse.failed";
}

export function errorMiddleware(
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof ApiError) {
    res.status(error.status).json(errorBody(error.code, error.message, error.details));
    return;
  }

  if (error instanceof ZodError) {
    const details = error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));

    res.status(400).json(errorBody(ErrorCode.VALIDATION_ERROR, "Invalid request", details));
    return;
  }

  if (isJsonParseError(error)) {
    res.status(400).json(errorBody(ErrorCode.INVALID_JSON, "Malformed JSON body"));
    return;
  }

  console.error(error);
  res.status(500).json(errorBody(ErrorCode.INTERNAL_ERROR, "Internal server error"));
}

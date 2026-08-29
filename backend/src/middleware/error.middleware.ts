import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { WikipediaError } from "../modules/wikipedia/wikipedia.errors.js";
import { ApiError, ErrorCode, errorBody } from "../shared/errors.js";

// Upstream MediaWiki failures must not surface as an opaque 500. Gameplay and
// game creation depend on a live external service; its failure modes map to
// dedicated 5xx codes so the client can tell "try again" from a real bug.
function wikipediaApiError(error: WikipediaError): ApiError {
  if (error.kind === "NO_SUITABLE_STARTING_PAGE") {
    return new ApiError(
      503,
      ErrorCode.NO_STARTING_PAGE,
      "Could not find a suitable starting page. Please try again.",
    );
  }

  return new ApiError(
    502,
    ErrorCode.WIKIPEDIA_UNAVAILABLE,
    "The Wikipedia service is currently unavailable. Please try again.",
  );
}

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

  if (error instanceof WikipediaError) {
    console.error(error);
    const apiError = wikipediaApiError(error);
    res
      .status(apiError.status)
      .json(errorBody(apiError.code, apiError.message));
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

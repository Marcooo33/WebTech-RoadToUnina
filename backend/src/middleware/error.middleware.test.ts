import assert from "node:assert/strict";
import { test } from "node:test";
import { errorMiddleware } from "./error.middleware.js";
import { WikipediaError } from "../modules/wikipedia/wikipedia.errors.js";
import { ApiError, ErrorCode } from "../shared/errors.js";

interface MockResponse {
  statusCode: number;
  body: unknown;
  headersSent: boolean;
  status: (code: number) => MockResponse;
  json: (body: unknown) => MockResponse;
}

function mockResponse(): MockResponse {
  return {
    statusCode: 200,
    body: undefined,
    headersSent: false,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
}

test("maps ApiError to its status and body", () => {
  const res = mockResponse();
  const error = new ApiError(404, ErrorCode.NOT_FOUND, "Route not found");

  errorMiddleware(error, {} as never, res as never, () => {});

  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.body, {
    error: { code: "NOT_FOUND", message: "Route not found" },
  });
});

test("maps a validation ApiError to 400 VALIDATION_ERROR", () => {
  const res = mockResponse();

  errorMiddleware(
    new ApiError(400, ErrorCode.VALIDATION_ERROR, "Invalid move request"),
    {} as never,
    res as never,
    () => {},
  );

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, {
    error: { code: "VALIDATION_ERROR", message: "Invalid move request" },
  });
});

test("maps JSON parse errors to 400 INVALID_JSON", () => {
  const error = new SyntaxError("Unexpected token");
  (error as unknown as { type: string }).type = "entity.parse.failed";
  const res = mockResponse();

  errorMiddleware(error, {} as never, res as never, () => {});

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, {
    error: { code: "INVALID_JSON", message: "Malformed JSON body" },
  });
});

test("maps an upstream MediaWiki failure to 502 WIKIPEDIA_UNAVAILABLE without leaking details", () => {
  const res = mockResponse();
  const originalConsoleError = console.error;
  console.error = () => {};

  try {
    errorMiddleware(
      new WikipediaError("NETWORK", "connect ECONNREFUSED 10.0.0.1:443"),
      {} as never,
      res as never,
      () => {},
    );
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(res.statusCode, 502);
  assert.deepEqual(res.body, {
    error: {
      code: "WIKIPEDIA_UNAVAILABLE",
      message: "The Wikipedia service is currently unavailable. Please try again.",
    },
  });
});

test("maps a missing suitable starting page to 503 NO_STARTING_PAGE", () => {
  const res = mockResponse();
  const originalConsoleError = console.error;
  console.error = () => {};

  try {
    errorMiddleware(
      new WikipediaError("NO_SUITABLE_STARTING_PAGE", "exhausted attempts"),
      {} as never,
      res as never,
      () => {},
    );
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(res.statusCode, 503);
  assert.equal((res.body as { error: { code: string } }).error.code, "NO_STARTING_PAGE");
});

test("maps unknown errors to 500 INTERNAL_ERROR without leaking details", () => {
  const res = mockResponse();

  errorMiddleware(new Error("secret internal detail"), {} as never, res as never, () => {});

  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, {
    error: { code: "INTERNAL_ERROR", message: "Internal server error" },
  });
});

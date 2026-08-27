import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import { errorMiddleware } from "./error.middleware.js";
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

test("maps ZodError to 400 VALIDATION_ERROR with details", () => {
  const schema = z.object({ name: z.string() });
  const result = schema.safeParse({});
  const res = mockResponse();

  errorMiddleware(result.error, {} as never, res as never, () => {});

  assert.equal(res.statusCode, 400);
  const body = res.body as { error: { code: string; details: unknown[] } };
  assert.equal(body.error.code, "VALIDATION_ERROR");
  assert.equal(body.error.details.length, 1);
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

test("maps unknown errors to 500 INTERNAL_ERROR without leaking details", () => {
  const res = mockResponse();

  errorMiddleware(new Error("secret internal detail"), {} as never, res as never, () => {});

  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, {
    error: { code: "INTERNAL_ERROR", message: "Internal server error" },
  });
});

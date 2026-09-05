import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiError, ErrorCode, errorBody } from "./errors.js";

test("ApiError carries status, code and message", () => {
  const error = new ApiError(404, ErrorCode.NOT_FOUND, "Route not found");

  assert.equal(error.status, 404);
  assert.equal(error.code, "NOT_FOUND");
  assert.equal(error.message, "Route not found");
});

test("errorBody builds the standard error shape", () => {
  const body = errorBody(ErrorCode.NOT_FOUND, "Route not found");

  assert.deepEqual(body, {
    error: { code: "NOT_FOUND", message: "Route not found" },
  });
});

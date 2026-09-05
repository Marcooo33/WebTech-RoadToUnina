import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiError, ErrorCode } from "./errors.js";
import {
  asObject,
  isUuid,
  parsePositiveIntParam,
  rejectUnknownKeys,
  validationError,
} from "./validation.js";

test("validationError is a 400 VALIDATION_ERROR ApiError", () => {
  const error = validationError("Invalid request");

  assert.ok(error instanceof ApiError);
  assert.equal(error.status, 400);
  assert.equal(error.code, ErrorCode.VALIDATION_ERROR);
  assert.equal(error.message, "Invalid request");
});

test("asObject accepts a plain object and rejects null / arrays / primitives", () => {
  assert.deepEqual(asObject({ a: 1 }), { a: 1 });

  for (const value of [null, undefined, [], "x", 3, true]) {
    assert.throws(() => asObject(value), (error: unknown) => error instanceof ApiError);
  }
});

test("rejectUnknownKeys throws on any key outside the allow-list", () => {
  assert.doesNotThrow(() =>
    rejectUnknownKeys({ mode: "CLICK" }, ["mode", "difficulty"], "nope"),
  );
  assert.throws(
    () => rejectUnknownKeys({ mode: "CLICK", status: "x" }, ["mode"], "nope"),
    /nope/,
  );
});

test("isUuid only accepts a canonical 8-4-4-4-12 hex UUID", () => {
  assert.equal(isUuid("2b2c1f8e-6a6a-4b2b-9f1e-1a2b3c4d5e6f"), true);
  assert.equal(isUuid("not-a-uuid"), false);
  assert.equal(isUuid(123), false);
});

test("parsePositiveIntParam returns the fallback when the value is absent", () => {
  assert.equal(parsePositiveIntParam(undefined, "page", { fallback: 1 }), 1);
});

test("parsePositiveIntParam parses a canonical decimal string", () => {
  assert.equal(parsePositiveIntParam("25", "limit", { fallback: 10 }), 25);
});

test("parsePositiveIntParam rejects non-canonical, non-positive or oversized values", () => {
  for (const value of ["0", "-1", "1.0", "01", "abc", "", "1e2", "+1", 5]) {
    assert.throws(
      () => parsePositiveIntParam(value, "page", { fallback: 1 }),
      (error: unknown) => error instanceof ApiError,
      `expected ${JSON.stringify(value)} to be rejected`,
    );
  }

  assert.throws(
    () => parsePositiveIntParam("9007199254740992", "page", { fallback: 1 }),
    /Invalid page/,
  );
  assert.throws(
    () => parsePositiveIntParam("101", "limit", { fallback: 10, max: 100 }),
    /must not exceed 100/,
  );
});

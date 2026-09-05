import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiError } from "../../shared/errors.js";
import { parseHistoryListQuery } from "./history.validation.js";

test("parseHistoryListQuery applies default page and limit", () => {
  assert.deepEqual(parseHistoryListQuery({}), { page: 1, limit: 20 });
});

test("parseHistoryListQuery keeps optional mode and difficulty filters", () => {
  assert.deepEqual(parseHistoryListQuery({ mode: "CLICK" }), {
    mode: "CLICK",
    page: 1,
    limit: 20,
  });
  assert.deepEqual(
    parseHistoryListQuery({ mode: "TIME", difficulty: "HARD", page: "3", limit: "50" }),
    { mode: "TIME", difficulty: "HARD", page: 3, limit: 50 },
  );
});

test("parseHistoryListQuery rejects lower-case enum filters (case-sensitive)", () => {
  assert.throws(() => parseHistoryListQuery({ mode: "click" }), ApiError);
  assert.throws(() => parseHistoryListQuery({ difficulty: "hard" }), ApiError);
});

test("parseHistoryListQuery rejects a limit above 100", () => {
  assert.throws(() => parseHistoryListQuery({ limit: "101" }), ApiError);
});

test("parseHistoryListQuery rejects non-canonical or out-of-range page/limit", () => {
  for (const value of ["0", "-1", "1.0", "01", "abc", "", "1e2", "+1"]) {
    assert.throws(
      () => parseHistoryListQuery({ page: value }),
      ApiError,
      `expected page=${JSON.stringify(value)} to be rejected`,
    );
  }
  assert.throws(
    () => parseHistoryListQuery({ page: "9007199254740992" }),
    ApiError,
  );
});

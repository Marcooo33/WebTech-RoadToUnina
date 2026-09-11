import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiError } from "../../shared/errors.js";
import { parseHistoryQuery } from "./history.validation.js";

test("parseHistoryQuery requires difficulty and defaults pagination", () => {
  assert.deepEqual(parseHistoryQuery({ difficulty: "EASY" }), {
    difficulty: "EASY",
    page: 1,
    limit: 20,
  });
});

test("parseHistoryQuery parses canonical page and limit values", () => {
  assert.deepEqual(
    parseHistoryQuery({ difficulty: "HARD", page: "3", limit: "50" }),
    { difficulty: "HARD", page: 3, limit: 50 },
  );
});

test("parseHistoryQuery rejects a missing or invalid difficulty", () => {
  assert.throws(() => parseHistoryQuery({}), ApiError);
  assert.throws(() => parseHistoryQuery({ difficulty: "hard" }), ApiError);
  assert.throws(
    () => parseHistoryQuery({ difficulty: "IMPOSSIBLE" }),
    ApiError,
  );
});

test("parseHistoryQuery rejects invalid pagination", () => {
  for (const value of ["0", "-1", "1.0", "01", "abc", "", "1e2", "+1"]) {
    assert.throws(
      () => parseHistoryQuery({ difficulty: "EASY", page: value }),
      ApiError,
      `expected page=${JSON.stringify(value)} to be rejected`,
    );
  }
  assert.throws(
    () => parseHistoryQuery({ difficulty: "EASY", limit: "101" }),
    ApiError,
  );
});

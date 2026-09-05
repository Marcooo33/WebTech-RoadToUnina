import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiError } from "../../shared/errors.js";
import { parseLeaderboardQuery } from "./leaderboards.validation.js";

test("parseLeaderboardQuery requires difficulty and defaults limit to 10", () => {
  assert.deepEqual(parseLeaderboardQuery({ difficulty: "EASY" }), {
    difficulty: "EASY",
    limit: 10,
  });
});

test("parseLeaderboardQuery rejects a missing or invalid difficulty", () => {
  assert.throws(() => parseLeaderboardQuery({}), ApiError);
  assert.throws(() => parseLeaderboardQuery({ difficulty: "easy" }), ApiError);
  assert.throws(
    () => parseLeaderboardQuery({ difficulty: "IMPOSSIBLE" }),
    ApiError,
  );
});

test("parseLeaderboardQuery parses a canonical limit string", () => {
  assert.deepEqual(parseLeaderboardQuery({ difficulty: "HARD", limit: "25" }), {
    difficulty: "HARD",
    limit: 25,
  });
});

test("parseLeaderboardQuery rejects a limit above 100 or non-canonical", () => {
  assert.throws(
    () => parseLeaderboardQuery({ difficulty: "EASY", limit: "101" }),
    ApiError,
  );
  for (const value of ["0", "-1", "1.0", "01", "abc", "", "1e2", "+1"]) {
    assert.throws(
      () => parseLeaderboardQuery({ difficulty: "EASY", limit: value }),
      ApiError,
      `expected limit=${JSON.stringify(value)} to be rejected`,
    );
  }
});

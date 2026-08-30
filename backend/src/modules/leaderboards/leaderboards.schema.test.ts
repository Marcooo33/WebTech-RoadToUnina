import assert from "node:assert/strict";
import { test } from "node:test";
import { leaderboardQuerySchema } from "./leaderboards.schema.js";

test("leaderboardQuerySchema requires difficulty and defaults limit to 10", () => {
  assert.deepEqual(leaderboardQuerySchema.parse({ difficulty: "EASY" }), {
    difficulty: "EASY",
    limit: 10,
  });
});

test("leaderboardQuerySchema rejects a missing or invalid difficulty", () => {
  assert.equal(leaderboardQuerySchema.safeParse({}).success, false);
  assert.equal(
    leaderboardQuerySchema.safeParse({ difficulty: "easy" }).success,
    false,
  );
  assert.equal(
    leaderboardQuerySchema.safeParse({ difficulty: "IMPOSSIBLE" }).success,
    false,
  );
});

test("leaderboardQuerySchema parses a canonical limit string", () => {
  assert.deepEqual(
    leaderboardQuerySchema.parse({ difficulty: "HARD", limit: "25" }),
    { difficulty: "HARD", limit: 25 },
  );
  assert.deepEqual(
    leaderboardQuerySchema.parse({ difficulty: "MEDIUM", limit: "100" }),
    { difficulty: "MEDIUM", limit: 100 },
  );
});

test("leaderboardQuerySchema rejects a limit above 100 or non-canonical", () => {
  assert.equal(
    leaderboardQuerySchema.safeParse({ difficulty: "EASY", limit: "101" }).success,
    false,
  );
  for (const value of ["0", "-1", "1.0", "01", "abc", "", "1e2", "+1"]) {
    assert.equal(
      leaderboardQuerySchema.safeParse({ difficulty: "EASY", limit: value })
        .success,
      false,
      `expected limit=${JSON.stringify(value)} to be rejected`,
    );
  }
});

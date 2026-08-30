import assert from "node:assert/strict";
import { test } from "node:test";
import { roundAverage, toBestResult } from "./stats.service.js";

test("roundAverage rounds to the requested precision", () => {
  assert.equal(roundAverage(12.44, 1), 12.4);
  assert.equal(roundAverage(12.45, 1), 12.5);
  assert.equal(roundAverage(379_999.6, 0), 380_000);
  assert.equal(roundAverage(8, 1), 8);
});

test("roundAverage passes null/undefined through (no data for the mode)", () => {
  assert.equal(roundAverage(null, 1), null);
  assert.equal(roundAverage(undefined, 0), null);
});

test("toBestResult maps a row to its DTO and serializes completedAt", () => {
  assert.deepEqual(
    toBestResult({
      id: "g1",
      difficulty: "EASY",
      clickCount: 8,
      effectivePlayTimeMs: 300_000,
      completedAt: new Date("2026-08-28T10:20:00.000Z"),
    }),
    {
      gameId: "g1",
      difficulty: "EASY",
      clickCount: 8,
      effectivePlayTimeMs: 300_000,
      completedAt: "2026-08-28T10:20:00.000Z",
    },
  );
});

test("toBestResult returns null when the user has no completed game in the mode", () => {
  assert.equal(toBestResult(null), null);
});

test("toBestResult throws on a completed row without completedAt", () => {
  assert.throws(
    () =>
      toBestResult({
        id: "bad",
        difficulty: "HARD",
        clickCount: 1,
        effectivePlayTimeMs: 1,
        completedAt: null,
      }),
    /has no completedAt/,
  );
});

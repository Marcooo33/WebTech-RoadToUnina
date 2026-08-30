import assert from "node:assert/strict";
import { test } from "node:test";
import { toLeaderboardEntries } from "./leaderboards.service.js";

function row(
  id: string,
  clickCount: number,
  effectivePlayTimeMs: number,
  username = "player",
) {
  return {
    id,
    clickCount,
    effectivePlayTimeMs,
    completedAt: new Date("2026-08-28T10:20:00.000Z"),
    user: { username },
  };
}

test("toLeaderboardEntries assigns sequential 1-based ranks in list order", () => {
  const entries = toLeaderboardEntries([
    row("a", 3, 100_000, "alice"),
    row("b", 5, 90_000, "bob"),
    row("c", 5, 95_000, "carol"),
  ]);

  assert.deepEqual(
    entries.map((e) => [e.rank, e.gameId]),
    [
      [1, "a"],
      [2, "b"],
      [3, "c"],
    ],
  );
});

test("toLeaderboardEntries maps username and metrics, serializes completedAt", () => {
  const [entry] = toLeaderboardEntries([row("g1", 8, 300_000, "marco")]);

  assert.deepEqual(entry, {
    rank: 1,
    gameId: "g1",
    username: "marco",
    clickCount: 8,
    effectivePlayTimeMs: 300_000,
    completedAt: "2026-08-28T10:20:00.000Z",
  });
});

test("toLeaderboardEntries gives tied scores consecutive distinct ranks", () => {
  const entries = toLeaderboardEntries([row("a", 4, 50_000), row("b", 4, 50_000)]);
  assert.deepEqual(
    entries.map((e) => e.rank),
    [1, 2],
  );
});

test("toLeaderboardEntries throws on a completed row without completedAt", () => {
  assert.throws(
    () =>
      toLeaderboardEntries([
        { ...row("bad", 1, 1), completedAt: null } as never,
      ]),
    /has no completedAt/,
  );
});

test("toLeaderboardEntries returns an empty list unchanged", () => {
  assert.deepEqual(toLeaderboardEntries([]), []);
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { toHistoryEntries } from "./history.service.js";

function row(
  id: string,
  clickCount: number,
  effectivePlayTimeMs: number,
  username = "player",
  deletedAt: Date | null = null,
) {
  return {
    id,
    clickCount,
    effectivePlayTimeMs,
    completedAt: new Date("2026-08-28T10:20:00.000Z"),
    user: { username, deletedAt },
  };
}

test("toHistoryEntries assigns ranks relative to the page offset", () => {
  const entries = toHistoryEntries(
    [row("a", 3, 100_000), row("b", 5, 90_000)],
    21,
  );

  assert.deepEqual(
    entries.map((entry) => [entry.rank, entry.gameId]),
    [
      [21, "a"],
      [22, "b"],
    ],
  );
});

test("toHistoryEntries hides a deleted user's internal username", () => {
  const [entry] = toHistoryEntries(
    [row("g1", 8, 300_000, "del_internal", new Date())],
    1,
  );

  assert.equal(entry.username, "Deleted user");
});

test("toHistoryEntries maps the public player and score fields", () => {
  const [entry] = toHistoryEntries([row("g1", 8, 300_000, "marco")], 1);

  assert.deepEqual(entry, {
    rank: 1,
    gameId: "g1",
    username: "marco",
    clickCount: 8,
    effectivePlayTimeMs: 300_000,
    completedAt: "2026-08-28T10:20:00.000Z",
  });
});

test("toHistoryEntries rejects a completed row without completedAt", () => {
  assert.throws(
    () => toHistoryEntries([{ ...row("bad", 1, 1), completedAt: null }], 1),
    /has no completedAt/,
  );
});

test("toHistoryEntries returns an empty page unchanged", () => {
  assert.deepEqual(toHistoryEntries([], 41), []);
});

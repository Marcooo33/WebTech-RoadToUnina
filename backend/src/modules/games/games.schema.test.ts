import assert from "node:assert/strict";
import { test } from "node:test";
import {
  backtrackSchema,
  createGameSchema,
  deleteGameQuerySchema,
  gameParamsSchema,
  listGamesQuerySchema,
  moveSchema,
} from "./games.schema.js";

test("createGameSchema accepts a valid CLICK / EASY game", () => {
  const result = createGameSchema.safeParse({
    mode: "CLICK",
    difficulty: "EASY",
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.deepEqual(result.data, { mode: "CLICK", difficulty: "EASY" });
  }
});

test("createGameSchema accepts TIME / HARD", () => {
  const result = createGameSchema.safeParse({
    mode: "TIME",
    difficulty: "HARD",
  });

  assert.equal(result.success, true);
});

test("createGameSchema rejects an invalid mode", () => {
  assert.equal(
    createGameSchema.safeParse({ mode: "CLICKING", difficulty: "EASY" }).success,
    false,
  );
});

test("createGameSchema rejects an invalid difficulty", () => {
  assert.equal(
    createGameSchema.safeParse({ mode: "CLICK", difficulty: "EXTREME" }).success,
    false,
  );
});

test("createGameSchema rejects missing fields", () => {
  assert.equal(createGameSchema.safeParse({ mode: "CLICK" }).success, false);
  assert.equal(createGameSchema.safeParse({ difficulty: "EASY" }).success, false);
  assert.equal(createGameSchema.safeParse({}).success, false);
});

test("createGameSchema rejects lower-case enum values (case-sensitive)", () => {
  assert.equal(
    createGameSchema.safeParse({ mode: "click", difficulty: "EASY" }).success,
    false,
  );
  assert.equal(
    createGameSchema.safeParse({ mode: "CLICK", difficulty: "easy" }).success,
    false,
  );
});

test("createGameSchema rejects unknown client-supplied fields", () => {
  assert.equal(
    createGameSchema.safeParse({
      mode: "CLICK",
      difficulty: "EASY",
      userId: "00000000-0000-0000-0000-000000000000",
    }).success,
    false,
  );

  assert.equal(
    createGameSchema.safeParse({
      mode: "CLICK",
      difficulty: "EASY",
      status: "COMPLETED",
    }).success,
    false,
  );

  assert.equal(
    createGameSchema.safeParse({
      mode: "CLICK",
      difficulty: "EASY",
      clickCount: 100,
    }).success,
    false,
  );
});

test("listGamesQuerySchema accepts an optional status filter", () => {
  assert.deepEqual(listGamesQuerySchema.parse({}), {});
  assert.deepEqual(listGamesQuerySchema.parse({ status: "IN_PROGRESS" }), {
    status: "IN_PROGRESS",
  });
  assert.deepEqual(listGamesQuerySchema.parse({ status: "COMPLETED" }), {
    status: "COMPLETED",
  });
});

test("listGamesQuerySchema rejects an invalid status filter", () => {
  assert.equal(listGamesQuerySchema.safeParse({ status: "DONE" }).success, false);
  assert.equal(
    listGamesQuerySchema.safeParse({ status: "in_progress" }).success,
    false,
  );
});

test("gameParamsSchema accepts a valid UUID gameId", () => {
  const id = "2b2c1f8e-6a6a-4b2b-9f1e-1a2b3c4d5e6f";
  assert.deepEqual(gameParamsSchema.parse({ gameId: id }), { gameId: id });
});

test("gameParamsSchema rejects an invalid gameId", () => {
  assert.equal(gameParamsSchema.safeParse({ gameId: "not-a-uuid" }).success, false);
});

test("deleteGameQuerySchema accepts canonical non-negative integer versions", () => {
  assert.deepEqual(deleteGameQuerySchema.parse({ version: "0" }), { version: 0 });
  assert.deepEqual(deleteGameQuerySchema.parse({ version: "1" }), { version: 1 });
  assert.deepEqual(deleteGameQuerySchema.parse({ version: "42" }), { version: 42 });
  assert.deepEqual(deleteGameQuerySchema.parse({ version: "10" }), { version: 10 });
  assert.deepEqual(deleteGameQuerySchema.parse({ version: "123" }), { version: 123 });
});

test("deleteGameQuerySchema rejects a missing version", () => {
  assert.equal(deleteGameQuerySchema.safeParse({}).success, false);
});

test("deleteGameQuerySchema rejects empty and whitespace-only versions", () => {
  assert.equal(deleteGameQuerySchema.safeParse({ version: "" }).success, false);
  assert.equal(deleteGameQuerySchema.safeParse({ version: " " }).success, false);
  assert.equal(
    deleteGameQuerySchema.safeParse({ version: "   " }).success,
    false,
  );
});

test("deleteGameQuerySchema rejects non-canonical numeric representations", () => {
  for (const value of ["1.0", "1e3", "+1", "-1", "01", "00", "1.5"]) {
    assert.equal(
      deleteGameQuerySchema.safeParse({ version: value }).success,
      false,
      `expected ${value} to be rejected`,
    );
  }
});

test("deleteGameQuerySchema rejects non-numeric versions", () => {
  for (const value of ["abc", "1a", "0x10", "Infinity"]) {
    assert.equal(
      deleteGameQuerySchema.safeParse({ version: value }).success,
      false,
      `expected ${value} to be rejected`,
    );
  }
});

test("deleteGameQuerySchema rejects versions exceeding the safe integer range", () => {
  const tooBig = "9007199254740992";
  assert.equal(deleteGameQuerySchema.safeParse({ version: tooBig }).success, false);
});

test("moveSchema accepts a valid toPageId and version", () => {
  const result = moveSchema.safeParse({ toPageId: 123456, version: 6 });

  assert.equal(result.success, true);
  if (result.success) {
    assert.deepEqual(result.data, { toPageId: 123456, version: 6 });
  }
});

test("moveSchema rejects a missing toPageId or version", () => {
  assert.equal(moveSchema.safeParse({ version: 0 }).success, false);
  assert.equal(moveSchema.safeParse({ toPageId: 123 }).success, false);
  assert.equal(moveSchema.safeParse({}).success, false);
});

test("moveSchema rejects a non-positive or non-integer toPageId", () => {
  for (const toPageId of [0, -1, 1.5, Number.NaN, "123", null]) {
    assert.equal(
      moveSchema.safeParse({ toPageId, version: 0 }).success,
      false,
      `expected toPageId=${String(toPageId)} to be rejected`,
    );
  }
});

test("moveSchema rejects an invalid version", () => {
  for (const version of [-1, 0.5, Number.NaN, "0", null, 9007199254740992]) {
    assert.equal(
      moveSchema.safeParse({ toPageId: 123, version }).success,
      false,
      `expected version=${String(version)} to be rejected`,
    );
  }
});

test("moveSchema rejects undocumented client-supplied fields", () => {
  assert.equal(
    moveSchema.safeParse({
      toPageId: 123,
      version: 0,
      clickCount: 100,
    }).success,
    false,
  );

  assert.equal(
    moveSchema.safeParse({
      toPageId: 123,
      version: 0,
      userId: "00000000-0000-0000-0000-000000000000",
    }).success,
    false,
  );

  assert.equal(
    moveSchema.safeParse({ toPageId: 123, version: 0, status: "COMPLETED" })
      .success,
    false,
  );
});

test("backtrackSchema accepts a valid version", () => {
  assert.deepEqual(backtrackSchema.parse({ version: 0 }), { version: 0 });
  assert.deepEqual(backtrackSchema.parse({ version: 6 }), { version: 6 });
});

test("backtrackSchema rejects a missing or invalid version", () => {
  assert.equal(backtrackSchema.safeParse({}).success, false);
  assert.equal(backtrackSchema.safeParse({ version: -1 }).success, false);
  assert.equal(backtrackSchema.safeParse({ version: 0.5 }).success, false);
  assert.equal(backtrackSchema.safeParse({ version: "0" }).success, false);
});

test("backtrackSchema rejects undocumented client-supplied fields", () => {
  assert.equal(
    backtrackSchema.safeParse({ version: 0, clickCount: 5 }).success,
    false,
  );
});

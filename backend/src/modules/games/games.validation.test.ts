import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiError } from "../../shared/errors.js";
import {
  parseCreateGameInput,
  parseGameId,
  parseGameStatusFilter,
  parseMoveInput,
} from "./games.validation.js";

test("parseCreateGameInput accepts a valid mode / difficulty pair", () => {
  assert.deepEqual(
    parseCreateGameInput({ mode: "CLICK", difficulty: "EASY" }),
    {
      mode: "CLICK",
      difficulty: "EASY",
    },
  );
  assert.deepEqual(parseCreateGameInput({ mode: "TIME", difficulty: "HARD" }), {
    mode: "TIME",
    difficulty: "HARD",
  });
});

test("parseCreateGameInput rejects invalid, missing or lower-case enum values", () => {
  for (const body of [
    { mode: "CLICKING", difficulty: "EASY" },
    { mode: "CLICK", difficulty: "EXTREME" },
    { mode: "click", difficulty: "EASY" },
    { mode: "CLICK", difficulty: "easy" },
    { mode: "CLICK" },
    { difficulty: "EASY" },
    {},
  ]) {
    assert.throws(
      () => parseCreateGameInput(body),
      ApiError,
      `expected ${JSON.stringify(body)} to be rejected`,
    );
  }
});

test("parseCreateGameInput rejects client-supplied authoritative fields", () => {
  for (const extra of [
    { userId: "x" },
    { status: "COMPLETED" },
    { clickCount: 1 },
  ]) {
    assert.throws(
      () =>
        parseCreateGameInput({ mode: "CLICK", difficulty: "EASY", ...extra }),
      ApiError,
    );
  }
});

test("parseGameStatusFilter accepts the two statuses or undefined", () => {
  assert.equal(parseGameStatusFilter(undefined), undefined);
  assert.equal(parseGameStatusFilter("IN_PROGRESS"), "IN_PROGRESS");
  assert.equal(parseGameStatusFilter("COMPLETED"), "COMPLETED");
  assert.throws(() => parseGameStatusFilter("DONE"), ApiError);
  assert.throws(() => parseGameStatusFilter("in_progress"), ApiError);
});

test("parseGameId accepts a UUID and rejects anything else", () => {
  const id = "2b2c1f8e-6a6a-4b2b-9f1e-1a2b3c4d5e6f";
  assert.equal(parseGameId(id), id);
  assert.throws(() => parseGameId("not-a-uuid"), ApiError);
});

test("parseMoveInput normalizes a title and accepts no authoritative fields", () => {
  assert.deepEqual(parseMoveInput({ toTitle: "  università__di_Napoli " }), {
    toTitle: "Università di Napoli",
  });
});

test("parseMoveInput rejects missing, malformed and oversized titles", () => {
  for (const toTitle of [
    0,
    null,
    undefined,
    {},
    [],
    "",
    "   ",
    "A|B",
    "A#B",
    "A\nB",
    "x".repeat(256),
    "à".repeat(128),
  ]) {
    assert.throws(() => parseMoveInput({ toTitle }), ApiError);
  }
  assert.throws(() => parseMoveInput({}), ApiError);
});

test("parseMoveInput rejects page IDs, version and authoritative counters", () => {
  assert.throws(() => parseMoveInput({ toPageId: 123 }), ApiError);
  assert.throws(
    () => parseMoveInput({ toTitle: "Napoli", version: 0 }),
    ApiError,
  );
  assert.throws(
    () => parseMoveInput({ toTitle: "Napoli", clickCount: 1 }),
    ApiError,
  );
});

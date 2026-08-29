import assert from "node:assert/strict";
import { test } from "node:test";
import { historyListQuerySchema } from "./history.schema.js";

test("historyListQuerySchema applies default page and limit", () => {
  assert.deepEqual(historyListQuerySchema.parse({}), { page: 1, limit: 20 });
});

test("historyListQuerySchema accepts optional mode and difficulty filters", () => {
  assert.deepEqual(historyListQuerySchema.parse({ mode: "CLICK" }), {
    mode: "CLICK",
    page: 1,
    limit: 20,
  });
  assert.deepEqual(
    historyListQuerySchema.parse({ mode: "TIME", difficulty: "HARD" }),
    { mode: "TIME", difficulty: "HARD", page: 1, limit: 20 },
  );
});

test("historyListQuerySchema rejects lower-case enum filters (case-sensitive)", () => {
  assert.equal(historyListQuerySchema.safeParse({ mode: "click" }).success, false);
  assert.equal(
    historyListQuerySchema.safeParse({ difficulty: "hard" }).success,
    false,
  );
});

test("historyListQuerySchema parses canonical page and limit strings", () => {
  assert.deepEqual(historyListQuerySchema.parse({ page: "3", limit: "50" }), {
    page: 3,
    limit: 50,
  });
  assert.deepEqual(historyListQuerySchema.parse({ limit: "100" }), {
    page: 1,
    limit: 100,
  });
});

test("historyListQuerySchema rejects a limit above 100", () => {
  assert.equal(historyListQuerySchema.safeParse({ limit: "101" }).success, false);
});

test("historyListQuerySchema rejects non-positive or non-canonical page/limit", () => {
  for (const value of ["0", "-1", "1.0", "01", "abc", "", " ", "1e2", "+1"]) {
    assert.equal(
      historyListQuerySchema.safeParse({ page: value }).success,
      false,
      `expected page=${JSON.stringify(value)} to be rejected`,
    );
    assert.equal(
      historyListQuerySchema.safeParse({ limit: value }).success,
      false,
      `expected limit=${JSON.stringify(value)} to be rejected`,
    );
  }
});

test("historyListQuerySchema rejects page/limit beyond the safe integer range", () => {
  assert.equal(
    historyListQuerySchema.safeParse({ page: "9007199254740992" }).success,
    false,
  );
});

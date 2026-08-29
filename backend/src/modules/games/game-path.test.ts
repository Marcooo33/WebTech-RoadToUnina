import assert from "node:assert/strict";
import { test } from "node:test";
import { reconstructActivePath, type ActivePathMove } from "./game-path.js";
import type { PageRefDto } from "./games.types.js";

const start: PageRefDto = { pageId: 1, title: "A" };

function move(type: ActivePathMove["type"], pageId: number, title: string): ActivePathMove {
  return { type, toPageId: pageId, toPageTitle: title };
}

test("reconstructs an empty path as just the start page", () => {
  assert.deepEqual(reconstructActivePath(start, []), [
    { pageId: 1, title: "A" },
  ]);
});

test("reconstructs a pure navigation path", () => {
  const moves = [
    move("NAVIGATION", 2, "B"),
    move("NAVIGATION", 3, "C"),
    move("NAVIGATION", 4, "D"),
  ];

  assert.deepEqual(reconstructActivePath(start, moves), [
    { pageId: 1, title: "A" },
    { pageId: 2, title: "B" },
    { pageId: 3, title: "C" },
    { pageId: 4, title: "D" },
  ]);
});

test("backtracking pops the previous active node", () => {
  const moves = [
    move("NAVIGATION", 2, "B"),
    move("NAVIGATION", 3, "C"),
    move("NAVIGATION", 4, "D"),
    move("BACKTRACK", 3, "C"),
  ];

  assert.deepEqual(reconstructActivePath(start, moves), [
    { pageId: 1, title: "A" },
    { pageId: 2, title: "B" },
    { pageId: 3, title: "C" },
  ]);
});

test("navigation after backtracking appends to the active path", () => {
  const moves = [
    move("NAVIGATION", 2, "B"),
    move("NAVIGATION", 3, "C"),
    move("NAVIGATION", 4, "D"),
    move("BACKTRACK", 3, "C"),
    move("NAVIGATION", 5, "E"),
  ];

  assert.deepEqual(reconstructActivePath(start, moves), [
    { pageId: 1, title: "A" },
    { pageId: 2, title: "B" },
    { pageId: 3, title: "C" },
    { pageId: 5, title: "E" },
  ]);
});

test("navigating to a previously visited page is still a NAVIGATION push", () => {
  const moves = [
    move("NAVIGATION", 2, "B"),
    move("NAVIGATION", 3, "C"),
    move("NAVIGATION", 2, "B"),
  ];

  assert.deepEqual(reconstructActivePath(start, moves), [
    { pageId: 1, title: "A" },
    { pageId: 2, title: "B" },
    { pageId: 3, title: "C" },
    { pageId: 2, title: "B" },
  ]);
});

test("backtracking never pops below the start page", () => {
  const moves = [
    move("BACKTRACK", 1, "A"),
    move("BACKTRACK", 1, "A"),
  ];

  assert.deepEqual(reconstructActivePath(start, moves), [
    { pageId: 1, title: "A" },
  ]);
});

/**
 * Turns a validated route plus a plan entry into the exact `Game` and
 * `GameMove` rows to insert.
 *
 * This module is pure and holds every consistency rule of the seed:
 *
 * - `clickCount` is the number of NAVIGATION moves, `backtrackCount` the number
 *   of BACKTRACK moves. They are counted, never assigned.
 * - the difficulty backtrack rules are re-checked against the application's own
 *   constants (`MEDIUM_BACKTRACK_LIMIT`, HARD forbids backtracking);
 * - `currentPage*` is the last page of the reconstructed active path, so a
 *   COMPLETED game necessarily sits on the target;
 * - COMPLETED rows carry `completedAt` and null timing timestamps, matching the
 *   `games_completion_consistency` CHECK and what `completionTimingData` leaves
 *   behind;
 * - IN_PROGRESS rows carry no `completedAt` and null `playStartedAt` /
 *   `lastHeartbeatAt`, which `game-timing.ts` reads as "no pending interval",
 *   so the first real resume starts a fresh authoritative interval;
 * - move `sequence` is contiguous from 1 and move timestamps are strictly
 *   increasing inside `[startedAt, completedAt]`;
 * - `effectivePlayTimeMs` is always below the wall-clock span, because idle
 *   time is excluded from it.
 */

import type { Prisma } from "../../generated/prisma/client.js";
import {
  MAX_IN_PROGRESS_GAMES,
  MEDIUM_BACKTRACK_LIMIT,
} from "../../modules/games/games.service.js";
import { TARGET_PAGE_ID } from "../../config/game.js";
import type { DemoGamePlan } from "./demo-games.js";
import type { ResolvedRoute, ResolvedStep } from "./resolve-routes.js";

export class DemoPlanError extends Error {}

export interface BuiltGame {
  readonly game: Prisma.GameUncheckedCreateInput;
  readonly moves: Prisma.GameMoveUncheckedCreateInput[];
  readonly username: string;
}

const DAY_MS = 86_400_000;
/** Safety margin so an in-progress game never has a move in the future. */
const NOW_MARGIN_MS = 60_000;

/** Idle time the player spent reading — excluded from effective play time. */
function idlePaddingMs(effectivePlayTimeMs: number): number {
  return Math.round(effectivePlayTimeMs * 0.4) + 9_000;
}

function planStartedAt(plan: DemoGamePlan, now: Date): Date {
  const started = new Date(now.getTime() - plan.daysAgo * DAY_MS);
  started.setHours(plan.startHour, plan.startMinute, 0, 0);
  return started;
}

function checkBacktrackRules(
  plan: DemoGamePlan,
  backtrackCount: number,
): void {
  if (plan.difficulty === "HARD" && backtrackCount > 0) {
    throw new DemoPlanError(
      `Plan for "${plan.username}" uses route "${plan.routeId}" with ` +
        `${backtrackCount} backtrack(s) on HARD, where backtracking is forbidden`,
    );
  }
  if (plan.difficulty === "MEDIUM" && backtrackCount > MEDIUM_BACKTRACK_LIMIT) {
    throw new DemoPlanError(
      `Plan for "${plan.username}" uses route "${plan.routeId}" with ` +
        `${backtrackCount} backtracks on MEDIUM, above the limit of ${MEDIUM_BACKTRACK_LIMIT}`,
    );
  }
}

function selectedSteps(
  plan: DemoGamePlan,
  route: ResolvedRoute,
): readonly ResolvedStep[] {
  if (plan.stopAfterSteps === undefined) {
    return route.steps;
  }
  if (plan.stopAfterSteps < 0 || plan.stopAfterSteps >= route.steps.length) {
    throw new DemoPlanError(
      `Plan for "${plan.username}": stopAfterSteps ${plan.stopAfterSteps} must be ` +
        `between 0 and ${route.steps.length - 1} for route "${plan.routeId}", ` +
        `otherwise the game would not be in progress`,
    );
  }
  return route.steps.slice(0, plan.stopAfterSteps);
}

export function buildGame(
  plan: DemoGamePlan,
  route: ResolvedRoute,
  userId: string,
  gameId: string,
  now: Date,
): BuiltGame {
  const steps = selectedSteps(plan, route);
  const isCompleted = plan.stopAfterSteps === undefined;

  const clickCount = steps.filter((step) => step.type === "NAVIGATION").length;
  const backtrackCount = steps.filter((step) => step.type === "BACKTRACK").length;
  checkBacktrackRules(plan, backtrackCount);

  const lastStep = steps[steps.length - 1];
  const currentPage = lastStep ? lastStep.to : route.start;

  if (isCompleted && currentPage.pageId !== TARGET_PAGE_ID) {
    throw new DemoPlanError(
      `Plan for "${plan.username}": completed route "${plan.routeId}" does not ` +
        `end on the target page`,
    );
  }
  if (!isCompleted && currentPage.pageId === TARGET_PAGE_ID) {
    throw new DemoPlanError(
      `Plan for "${plan.username}": in-progress route "${plan.routeId}" already ` +
        `sits on the target page`,
    );
  }

  const spanMs = plan.effectivePlayTimeMs + idlePaddingMs(plan.effectivePlayTimeMs);
  let startedAt = planStartedAt(plan, now);
  // Never let a seeded timestamp land in the future.
  const latestEnd = now.getTime() - NOW_MARGIN_MS;
  if (startedAt.getTime() + spanMs > latestEnd) {
    startedAt = new Date(latestEnd - spanMs);
  }

  const moves: Prisma.GameMoveUncheckedCreateInput[] = steps.map((step, index) => ({
    gameId,
    sequence: index + 1,
    type: step.type,
    fromPageId: step.from.pageId,
    fromPageTitle: step.from.title,
    toPageId: step.to.pageId,
    toPageTitle: step.to.title,
    createdAt: new Date(
      startedAt.getTime() + Math.round((spanMs * (index + 1)) / steps.length),
    ),
  }));

  const game: Prisma.GameUncheckedCreateInput = {
    id: gameId,
    userId,
    mode: plan.mode,
    difficulty: plan.difficulty,
    status: isCompleted ? "COMPLETED" : "IN_PROGRESS",
    startPageId: route.start.pageId,
    startPageTitle: route.start.title,
    currentPageId: currentPage.pageId,
    currentPageTitle: currentPage.title,
    clickCount,
    backtrackCount,
    effectivePlayTimeMs: plan.effectivePlayTimeMs,
    // No pending play interval: completion clears both, and an in-progress
    // seeded game must look like one nobody is currently playing.
    playStartedAt: null,
    lastHeartbeatAt: null,
    startedAt,
    completedAt: isCompleted
      ? new Date(startedAt.getTime() + spanMs)
      : null,
    createdAt: startedAt,
  };

  return { game, moves, username: plan.username };
}

/** Plan-wide invariants that a single game cannot check on its own. */
export function checkPlanInvariants(built: readonly BuiltGame[]): void {
  const inProgressPerUser = new Map<string, number>();
  for (const entry of built) {
    if (entry.game.status !== "IN_PROGRESS") continue;
    const count = (inProgressPerUser.get(entry.username) ?? 0) + 1;
    inProgressPerUser.set(entry.username, count);
    if (count > MAX_IN_PROGRESS_GAMES) {
      throw new DemoPlanError(
        `"${entry.username}" would have ${count} in-progress games, above the ` +
          `application limit of ${MAX_IN_PROGRESS_GAMES}`,
      );
    }
  }

  const combinations = new Set(
    built
      .filter((entry) => entry.game.status === "COMPLETED")
      .map((entry) => `${entry.game.mode} ${entry.game.difficulty}`),
  );
  const expected = ["CLICK", "TIME"].flatMap((mode) =>
    ["EASY", "MEDIUM", "HARD"].map((difficulty) => `${mode} ${difficulty}`),
  );
  const missing = expected.filter((combination) => !combinations.has(combination));
  if (missing.length > 0) {
    throw new DemoPlanError(
      `No completed game for leaderboard combination(s): ${missing.join(", ")}`,
    );
  }
}

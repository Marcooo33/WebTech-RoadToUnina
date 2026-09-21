/**
 * Resolves the curated demo routes against live it.wikipedia.org and validates
 * every hop through the application's own `WikipediaService`.
 *
 * This is deliberately not a crawler: it never searches for a path, it only
 * checks the hand-written fixtures still hold. `resolveNavigation` is exactly
 * the gate `GamesService.move` uses, so eligibility rules are honoured without
 * duplicating any MediaWiki logic. The only extra behaviour here is pacing and
 * a longer backoff, because a seed run issues its hops back-to-back and gets
 * rate limited far more easily than a human player.
 */

import { TARGET_PAGE_ID, TARGET_PAGE_TITLE } from "../../config/game.js";
import { WikipediaService } from "../../modules/wikipedia/wikipedia.service.js";
import type { WikipediaPageIdentity } from "../../modules/wikipedia/wikipedia.types.js";
import type { DemoRoute } from "./demo-routes.js";

const PACING_MS = 2_000;
const MAX_ATTEMPTS = 5;
const RETRY_BASE_MS = 15_000;

export interface ResolvedStep {
  readonly type: "NAVIGATION" | "BACKTRACK";
  readonly from: WikipediaPageIdentity;
  readonly to: WikipediaPageIdentity;
}

export interface ResolvedRoute {
  readonly id: string;
  readonly start: WikipediaPageIdentity;
  readonly steps: readonly ResolvedStep[];
}

export class DemoRouteError extends Error {}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Retries transient MediaWiki failures (rate limiting, network blips). */
async function withRetry<T>(
  description: string,
  operation: () => Promise<T>,
  log: (message: string) => void,
): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= MAX_ATTEMPTS) {
        throw new DemoRouteError(
          `${description} failed after ${MAX_ATTEMPTS} attempts: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
      const delay = RETRY_BASE_MS * attempt;
      log(`  retrying ${description} in ${delay / 1000}s (${
        error instanceof Error ? error.message : String(error)
      })`);
      await sleep(delay);
    }
  }
}

/**
 * Walks one route, maintaining the reconstructed active path exactly like
 * `modules/games/game-path.ts`: a BACKTRACK pops the path, and the next
 * navigation is validated from the page that became current after the pop.
 */
async function resolveRoute(
  route: DemoRoute,
  wikipedia: WikipediaService,
  log: (message: string) => void,
): Promise<ResolvedRoute> {
  const start = await withRetry(
    `resolving start page "${route.startTitle}"`,
    () => wikipedia.resolvePage(route.startTitle),
    log,
  );
  if (start === null) {
    throw new DemoRouteError(
      `Route "${route.id}": start page "${route.startTitle}" does not exist on it.wikipedia.org`,
    );
  }
  if (start.pageId === TARGET_PAGE_ID) {
    throw new DemoRouteError(
      `Route "${route.id}": the start page must not be the target page`,
    );
  }

  const path: WikipediaPageIdentity[] = [start];
  const steps: ResolvedStep[] = [];

  for (const [index, step] of route.steps.entries()) {
    const current = path[path.length - 1]!;

    if ("backtrack" in step) {
      if (path.length <= 1) {
        throw new DemoRouteError(
          `Route "${route.id}" step ${index + 1}: cannot backtrack from the start page`,
        );
      }
      path.pop();
      steps.push({ type: "BACKTRACK", from: current, to: path[path.length - 1]! });
      continue;
    }

    await sleep(PACING_MS);
    const destination = await withRetry(
      `hop "${current.title}" -> "${step.navigateTo}"`,
      () => wikipedia.resolveNavigation(current.pageId, step.navigateTo),
      log,
    );
    if (destination === null) {
      throw new DemoRouteError(
        `Route "${route.id}" step ${index + 1}: "${step.navigateTo}" is not an ` +
          `eligible playable link from "${current.title}" any more. ` +
          `Edit backend/src/scripts/seed-demo/demo-routes.ts and pick a valid hop.`,
      );
    }
    path.push(destination);
    steps.push({ type: "NAVIGATION", from: current, to: destination });
  }

  const final = path[path.length - 1]!;
  if (final.pageId !== TARGET_PAGE_ID) {
    throw new DemoRouteError(
      `Route "${route.id}" ends on "${final.title}" (${final.pageId}) instead of ` +
        `the configured target "${TARGET_PAGE_TITLE}" (${TARGET_PAGE_ID})`,
    );
  }

  log(
    `  OK ${route.id}: ${start.title} -> … -> ${final.title} ` +
      `(${steps.filter((s) => s.type === "NAVIGATION").length} navigations, ` +
      `${steps.filter((s) => s.type === "BACKTRACK").length} backtracks)`,
  );

  return { id: route.id, start, steps };
}

export async function resolveRoutes(
  routes: readonly DemoRoute[],
  log: (message: string) => void,
  wikipedia: WikipediaService = new WikipediaService(),
): Promise<Map<string, ResolvedRoute>> {
  const resolved = new Map<string, ResolvedRoute>();
  for (const route of routes) {
    resolved.set(route.id, await resolveRoute(route, wikipedia, log));
  }
  return resolved;
}

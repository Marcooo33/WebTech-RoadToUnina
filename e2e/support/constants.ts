import { TARGET_PAGE_ID, TARGET_PAGE_TITLE } from "../../backend/src/config/game.js";

/**
 * The few stable facts the specs assert against. The full deterministic page
 * graph lives in `backend/src/testing/e2e-wikipedia.ts` (the single source of
 * truth); this file only names the handful of pages the tests walk through.
 *
 * The target page id/title are imported from the backend config so this file
 * cannot drift from it.
 */

export const START_PAGE = { pageId: 4100, title: "Partenope (sirena)" } as const;

export const TARGET_PAGE = {
  pageId: TARGET_PAGE_ID,
  title: TARGET_PAGE_TITLE,
} as const;

export const PAGE = {
  golfoDiNapoli: { pageId: 4101, title: "Golfo di Napoli" },
  storiaDiNapoli: { pageId: 4102, title: "Storia di Napoli" },
  napoli: { pageId: 4104, title: "Napoli" },
  campania: { pageId: 4105, title: "Campania" },
} as const;

/** Shortest winning route from the start page: 3 navigation clicks, no backtracks
 *  (so it is valid for every difficulty). */
export const WIN_PATH = [PAGE.golfoDiNapoli, PAGE.napoli, TARGET_PAGE] as const;

/**
 * A route long enough to exercise the MEDIUM 3-backtrack limit without ever
 * standing on the start page: 4100 -> 4101 -> 4102 -> 4104 -> 4105.
 */
export const DEEP_PATH = [
  PAGE.golfoDiNapoli,
  PAGE.storiaDiNapoli,
  PAGE.napoli,
  PAGE.campania,
] as const;

/** A page id that is never linked from the start page (forged-move check). */
export const UNLINKED_PAGE_ID = 999999;

/**
 * Leaderboard rankings are global and derived from every completed game, so a
 * spec that completes a game and then asserts it appears on the leaderboard must
 * own a (mode, difficulty) bucket that no other completing spec touches. Current
 * assignment:
 *   - completion.spec.ts        -> CLICK / EASY
 *   - public.spec.ts (history)  -> TIME  / HARD
 *   - public.spec.ts (board)    -> CLICK / MEDIUM
 * Any new completing spec must pick its own unused bucket or not assert rank.
 */

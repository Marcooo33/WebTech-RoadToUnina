import { TARGET_PAGE_ID, TARGET_PAGE_TITLE } from "../../backend/src/config/game.js";

/**
 * Pages the specs assert on. The full graph lives in
 * `backend/src/testing/e2e-wikipedia.ts`; target id/title come from backend config.
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
} as const;

/** Shortest winning route from the start page: 3 navigation clicks, no backtracks
 *  (so it is valid for every difficulty). */
export const WIN_PATH = [PAGE.golfoDiNapoli, PAGE.napoli, TARGET_PAGE] as const;

/**
 * Rankings are global, so each completing spec uses its own (mode, difficulty)
 * bucket: completion.spec.ts -> CLICK/EASY, public.spec.ts -> TIME/HARD.
 */

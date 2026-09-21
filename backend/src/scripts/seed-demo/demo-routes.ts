/**
 * Curated Wikipedia routes for the production demo seed.
 *
 * Every route is a hand-picked sequence of real it.wikipedia.org articles that
 * ends on the configured ROADTOUNINA target. Nothing here is trusted: the seed
 * resolves each title and validates every NAVIGATION hop through the existing
 * `WikipediaService` before touching the database (see `resolve-routes.ts`).
 *
 * BACKTRACK steps consume no API call — they pop the reconstructed active path
 * exactly like `modules/games/game-path.ts` does, and the following navigation
 * is validated from the page that became current after the pop.
 *
 * A route is reused across several seeded games (different players, modes,
 * difficulties, dates and play times). Click counts are always derived from the
 * actual moves, so click-score variety comes from these genuinely different
 * route shapes, never from adjusted counters.
 */

export type RouteStep = { readonly navigateTo: string } | { readonly backtrack: true };

export interface DemoRoute {
  readonly id: string;
  readonly startTitle: string;
  readonly steps: readonly RouteStep[];
}

const TARGET = "Università degli Studi di Napoli Federico II";

function nav(...titles: readonly string[]): RouteStep[] {
  return titles.map((navigateTo) => ({ navigateTo }));
}

const BACK: RouteStep = { backtrack: true };

export const DEMO_ROUTES: readonly DemoRoute[] = [
  // --- Short direct routes (2 navigations) -------------------------------
  {
    id: "roma-napoli",
    startTitle: "Roma",
    steps: nav("Napoli", TARGET),
  },
  {
    id: "pizza-napoli",
    startTitle: "Pizza",
    steps: nav("Napoli", TARGET),
  },
  {
    id: "limoncello-campania",
    startTitle: "Limoncello",
    steps: nav("Campania", TARGET),
  },
  {
    id: "vesuvio-campania",
    startTitle: "Vesuvio",
    steps: nav("Campania", TARGET),
  },
  {
    id: "spaghetti-toto",
    startTitle: "Spaghetti",
    steps: nav("Totò", TARGET),
  },

  // --- Medium routes (3 navigations) -------------------------------------
  {
    id: "caruso-roma-napoli",
    startTitle: "Enrico Caruso",
    steps: nav("Roma", "Napoli", TARGET),
  },
  {
    id: "loren-roma-campania",
    startTitle: "Sophia Loren",
    steps: nav("Roma", "Campania", TARGET),
  },
  {
    id: "croce-roma-toto",
    startTitle: "Benedetto Croce",
    steps: nav("Roma", "Totò", TARGET),
  },
  {
    id: "maradona-ssc-napoli",
    startTitle: "Diego Armando Maradona",
    steps: nav("Società Sportiva Calcio Napoli", "Napoli", TARGET),
  },
  {
    id: "caserta-vesuvio-campania",
    startTitle: "Reggia di Caserta",
    steps: nav("Vesuvio", "Campania", TARGET),
  },

  // --- Long routes (4-5 navigations), also used for in-progress prefixes --
  {
    id: "spaghetti-caserta-roma-napoli",
    startTitle: "Spaghetti",
    steps: nav("Reggia di Caserta", "Roma", "Napoli", TARGET),
  },
  {
    id: "pizza-mozzarella-campania-vesuvio-napoli",
    startTitle: "Pizza",
    steps: nav("Mozzarella di bufala campana", "Campania", "Vesuvio", "Napoli", TARGET),
  },

  // --- Routes with backtracking ------------------------------------------
  // EASY/MEDIUM only. HARD games never reference these (checked in build-rows).
  {
    id: "roma-toto-backtrack",
    startTitle: "Roma",
    steps: [...nav("Totò", "Pulcinella"), BACK, ...nav(TARGET)],
  },
  {
    id: "vesuvio-mozzarella-backtrack",
    startTitle: "Vesuvio",
    steps: [...nav("Mozzarella di bufala campana"), BACK, ...nav("Campania", TARGET)],
  },
  {
    id: "campania-double-backtrack",
    startTitle: "Campania",
    steps: [
      ...nav("Pizza"),
      BACK,
      ...nav("Roma"),
      BACK,
      ...nav("Napoli", TARGET),
    ],
  },
  {
    id: "spaghetti-triple-backtrack",
    startTitle: "Spaghetti",
    steps: [
      ...nav("Campania"),
      BACK,
      ...nav("Totò", "Pulcinella"),
      BACK,
      ...nav("Roma"),
      BACK,
      ...nav(TARGET),
    ],
  },
];

export function findRoute(id: string): DemoRoute {
  const route = DEMO_ROUTES.find((candidate) => candidate.id === id);
  if (!route) {
    throw new Error(`Unknown demo route id "${id}"`);
  }
  return route;
}

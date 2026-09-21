/**
 * The planned demo dataset: 45 COMPLETED games and 10 IN_PROGRESS games spread
 * unevenly over 11 players, all six mode/difficulty combinations and several
 * past days.
 *
 * A plan entry says *who* played *which curated route*, in which mode and
 * difficulty, how much effective play time the server would have accumulated,
 * and when. It never states a click or backtrack count: those are derived from
 * the route's actual moves in `build-rows.ts`.
 *
 * `stopAfterSteps` marks an IN_PROGRESS game: only the first N steps of the
 * (fully validated) route are materialised, so the remaining hops are known to
 * be playable live.
 */

import type { GameDifficulty, GameMode } from "../../generated/prisma/client.js";

export interface DemoGamePlan {
  readonly username: string;
  readonly routeId: string;
  readonly mode: GameMode;
  readonly difficulty: GameDifficulty;
  /** Server-authoritative effective play time. Deliberately irregular. */
  readonly effectivePlayTimeMs: number;
  /** Whole days before the seed run when the game started. */
  readonly daysAgo: number;
  /** Local start time of day, to spread games across the day. */
  readonly startHour: number;
  readonly startMinute: number;
  /** Present => IN_PROGRESS, materialising only the first N route steps. */
  readonly stopAfterSteps?: number;
}

export const DEMO_COMPLETED_GAMES: readonly DemoGamePlan[] = [
  // --- CLICK / EASY (8) --------------------------------------------------
  { username: "alex", routeId: "roma-napoli", mode: "CLICK", difficulty: "EASY", effectivePlayTimeMs: 58_430, daysAgo: 12, startHour: 21, startMinute: 14 },
  { username: "giulia", routeId: "pizza-napoli", mode: "CLICK", difficulty: "EASY", effectivePlayTimeMs: 71_205, daysAgo: 11, startHour: 9, startMinute: 47 },
  { username: "demo", routeId: "caruso-roma-napoli", mode: "CLICK", difficulty: "EASY", effectivePlayTimeMs: 64_980, daysAgo: 9, startHour: 18, startMinute: 2 },
  { username: "sara", routeId: "vesuvio-mozzarella-backtrack", mode: "CLICK", difficulty: "EASY", effectivePlayTimeMs: 112_365, daysAgo: 8, startHour: 15, startMinute: 33 },
  { username: "matteo", routeId: "limoncello-campania", mode: "CLICK", difficulty: "EASY", effectivePlayTimeMs: 95_710, daysAgo: 7, startHour: 22, startMinute: 51 },
  { username: "chiara", routeId: "spaghetti-triple-backtrack", mode: "CLICK", difficulty: "EASY", effectivePlayTimeMs: 233_890, daysAgo: 6, startHour: 11, startMinute: 26 },
  { username: "lorenzo", routeId: "loren-roma-campania", mode: "CLICK", difficulty: "EASY", effectivePlayTimeMs: 88_150, daysAgo: 4, startHour: 19, startMinute: 8 },
  { username: "valentina", routeId: "pizza-mozzarella-campania-vesuvio-napoli", mode: "CLICK", difficulty: "EASY", effectivePlayTimeMs: 176_425, daysAgo: 2, startHour: 13, startMinute: 41 },

  // --- CLICK / MEDIUM (7) ------------------------------------------------
  { username: "davide", routeId: "spaghetti-toto", mode: "CLICK", difficulty: "MEDIUM", effectivePlayTimeMs: 49_675, daysAgo: 13, startHour: 10, startMinute: 19 },
  { username: "elena", routeId: "vesuvio-campania", mode: "CLICK", difficulty: "MEDIUM", effectivePlayTimeMs: 83_940, daysAgo: 10, startHour: 17, startMinute: 55 },
  { username: "demo", routeId: "roma-toto-backtrack", mode: "CLICK", difficulty: "MEDIUM", effectivePlayTimeMs: 101_520, daysAgo: 8, startHour: 20, startMinute: 37 },
  { username: "simone", routeId: "campania-double-backtrack", mode: "CLICK", difficulty: "MEDIUM", effectivePlayTimeMs: 154_300, daysAgo: 6, startHour: 8, startMinute: 23 },
  { username: "alex", routeId: "croce-roma-toto", mode: "CLICK", difficulty: "MEDIUM", effectivePlayTimeMs: 77_265, daysAgo: 5, startHour: 23, startMinute: 6 },
  { username: "giulia", routeId: "maradona-ssc-napoli", mode: "CLICK", difficulty: "MEDIUM", effectivePlayTimeMs: 121_880, daysAgo: 3, startHour: 14, startMinute: 12 },
  { username: "sara", routeId: "roma-napoli", mode: "CLICK", difficulty: "MEDIUM", effectivePlayTimeMs: 66_395, daysAgo: 1, startHour: 16, startMinute: 44 },

  // --- CLICK / HARD (7) --------------------------------------------------
  { username: "lorenzo", routeId: "pizza-napoli", mode: "CLICK", difficulty: "HARD", effectivePlayTimeMs: 44_130, daysAgo: 12, startHour: 12, startMinute: 31 },
  { username: "demo", routeId: "roma-napoli", mode: "CLICK", difficulty: "HARD", effectivePlayTimeMs: 57_845, daysAgo: 9, startHour: 21, startMinute: 49 },
  { username: "matteo", routeId: "limoncello-campania", mode: "CLICK", difficulty: "HARD", effectivePlayTimeMs: 69_220, daysAgo: 7, startHour: 7, startMinute: 58 },
  { username: "chiara", routeId: "caserta-vesuvio-campania", mode: "CLICK", difficulty: "HARD", effectivePlayTimeMs: 104_755, daysAgo: 6, startHour: 18, startMinute: 27 },
  { username: "davide", routeId: "caruso-roma-napoli", mode: "CLICK", difficulty: "HARD", effectivePlayTimeMs: 91_605, daysAgo: 4, startHour: 22, startMinute: 15 },
  { username: "valentina", routeId: "spaghetti-caserta-roma-napoli", mode: "CLICK", difficulty: "HARD", effectivePlayTimeMs: 142_970, daysAgo: 3, startHour: 10, startMinute: 3 },
  { username: "elena", routeId: "vesuvio-campania", mode: "CLICK", difficulty: "HARD", effectivePlayTimeMs: 81_340, daysAgo: 1, startHour: 19, startMinute: 52 },

  // --- TIME / EASY (8) ---------------------------------------------------
  { username: "simone", routeId: "roma-napoli", mode: "TIME", difficulty: "EASY", effectivePlayTimeMs: 38_215, daysAgo: 14, startHour: 20, startMinute: 9 },
  { username: "demo", routeId: "pizza-napoli", mode: "TIME", difficulty: "EASY", effectivePlayTimeMs: 46_580, daysAgo: 11, startHour: 16, startMinute: 22 },
  { username: "alex", routeId: "spaghetti-toto", mode: "TIME", difficulty: "EASY", effectivePlayTimeMs: 61_745, daysAgo: 10, startHour: 9, startMinute: 36 },
  { username: "sara", routeId: "roma-toto-backtrack", mode: "TIME", difficulty: "EASY", effectivePlayTimeMs: 118_030, daysAgo: 8, startHour: 23, startMinute: 18 },
  { username: "elena", routeId: "loren-roma-campania", mode: "TIME", difficulty: "EASY", effectivePlayTimeMs: 72_910, daysAgo: 6, startHour: 13, startMinute: 5 },
  { username: "matteo", routeId: "campania-double-backtrack", mode: "TIME", difficulty: "EASY", effectivePlayTimeMs: 165_275, daysAgo: 5, startHour: 11, startMinute: 47 },
  { username: "chiara", routeId: "limoncello-campania", mode: "TIME", difficulty: "EASY", effectivePlayTimeMs: 53_460, daysAgo: 3, startHour: 18, startMinute: 59 },
  { username: "lorenzo", routeId: "caruso-roma-napoli", mode: "TIME", difficulty: "EASY", effectivePlayTimeMs: 87_695, daysAgo: 2, startHour: 21, startMinute: 28 },

  // --- TIME / MEDIUM (8) -------------------------------------------------
  { username: "demo", routeId: "vesuvio-campania", mode: "TIME", difficulty: "MEDIUM", effectivePlayTimeMs: 34_905, daysAgo: 12, startHour: 17, startMinute: 41 },
  { username: "giulia", routeId: "roma-napoli", mode: "TIME", difficulty: "MEDIUM", effectivePlayTimeMs: 59_180, daysAgo: 11, startHour: 22, startMinute: 7 },
  { username: "davide", routeId: "maradona-ssc-napoli", mode: "TIME", difficulty: "MEDIUM", effectivePlayTimeMs: 76_540, daysAgo: 9, startHour: 8, startMinute: 54 },
  { username: "valentina", routeId: "vesuvio-mozzarella-backtrack", mode: "TIME", difficulty: "MEDIUM", effectivePlayTimeMs: 128_365, daysAgo: 7, startHour: 15, startMinute: 12 },
  { username: "simone", routeId: "croce-roma-toto", mode: "TIME", difficulty: "MEDIUM", effectivePlayTimeMs: 68_725, daysAgo: 5, startHour: 19, startMinute: 33 },
  { username: "alex", routeId: "spaghetti-triple-backtrack", mode: "TIME", difficulty: "MEDIUM", effectivePlayTimeMs: 214_110, daysAgo: 4, startHour: 12, startMinute: 26 },
  { username: "elena", routeId: "pizza-napoli", mode: "TIME", difficulty: "MEDIUM", effectivePlayTimeMs: 47_390, daysAgo: 2, startHour: 10, startMinute: 48 },
  { username: "matteo", routeId: "spaghetti-caserta-roma-napoli", mode: "TIME", difficulty: "MEDIUM", effectivePlayTimeMs: 139_845, daysAgo: 1, startHour: 20, startMinute: 21 },

  // --- TIME / HARD (7) ---------------------------------------------------
  { username: "chiara", routeId: "roma-napoli", mode: "TIME", difficulty: "HARD", effectivePlayTimeMs: 42_265, daysAgo: 13, startHour: 18, startMinute: 16 },
  { username: "demo", routeId: "spaghetti-toto", mode: "TIME", difficulty: "HARD", effectivePlayTimeMs: 63_715, daysAgo: 10, startHour: 21, startMinute: 3 },
  { username: "lorenzo", routeId: "vesuvio-campania", mode: "TIME", difficulty: "HARD", effectivePlayTimeMs: 51_030, daysAgo: 8, startHour: 9, startMinute: 29 },
  { username: "sara", routeId: "caserta-vesuvio-campania", mode: "TIME", difficulty: "HARD", effectivePlayTimeMs: 97_480, daysAgo: 6, startHour: 14, startMinute: 57 },
  { username: "davide", routeId: "pizza-mozzarella-campania-vesuvio-napoli", mode: "TIME", difficulty: "HARD", effectivePlayTimeMs: 183_620, daysAgo: 4, startHour: 16, startMinute: 38 },
  { username: "giulia", routeId: "limoncello-campania", mode: "TIME", difficulty: "HARD", effectivePlayTimeMs: 58_095, daysAgo: 2, startHour: 23, startMinute: 11 },
  { username: "simone", routeId: "caruso-roma-napoli", mode: "TIME", difficulty: "HARD", effectivePlayTimeMs: 84_355, daysAgo: 1, startHour: 12, startMinute: 45 },
];

/**
 * IN_PROGRESS games. The two demo entries deliberately stop 3-4 valid hops
 * short of the target so the live presentation has room to keep playing.
 */
export const DEMO_IN_PROGRESS_GAMES: readonly DemoGamePlan[] = [
  // demo: 4 hops still to play (currently on "Mozzarella di bufala campana").
  { username: "demo", routeId: "pizza-mozzarella-campania-vesuvio-napoli", mode: "CLICK", difficulty: "MEDIUM", effectivePlayTimeMs: 39_450, daysAgo: 1, startHour: 20, startMinute: 34, stopAfterSteps: 1 },
  // demo: 3 hops still to play (currently on "Reggia di Caserta").
  { username: "demo", routeId: "spaghetti-caserta-roma-napoli", mode: "TIME", difficulty: "HARD", effectivePlayTimeMs: 26_780, daysAgo: 0, startHour: 9, startMinute: 12, stopAfterSteps: 1 },

  { username: "alex", routeId: "caruso-roma-napoli", mode: "CLICK", difficulty: "EASY", effectivePlayTimeMs: 31_205, daysAgo: 5, startHour: 17, startMinute: 26, stopAfterSteps: 1 },
  { username: "giulia", routeId: "campania-double-backtrack", mode: "TIME", difficulty: "EASY", effectivePlayTimeMs: 44_615, daysAgo: 4, startHour: 21, startMinute: 43, stopAfterSteps: 2 },
  { username: "lorenzo", routeId: "maradona-ssc-napoli", mode: "CLICK", difficulty: "HARD", effectivePlayTimeMs: 18_940, daysAgo: 3, startHour: 11, startMinute: 8, stopAfterSteps: 1 },
  { username: "sara", routeId: "pizza-mozzarella-campania-vesuvio-napoli", mode: "TIME", difficulty: "MEDIUM", effectivePlayTimeMs: 57_330, daysAgo: 3, startHour: 19, startMinute: 51 , stopAfterSteps: 2 },
  { username: "davide", routeId: "croce-roma-toto", mode: "CLICK", difficulty: "MEDIUM", effectivePlayTimeMs: 22_875, daysAgo: 2, startHour: 15, startMinute: 17, stopAfterSteps: 1 },
  { username: "chiara", routeId: "spaghetti-caserta-roma-napoli", mode: "TIME", difficulty: "HARD", effectivePlayTimeMs: 63_490, daysAgo: 2, startHour: 22, startMinute: 35, stopAfterSteps: 2 },
  // A game created but never played: no moves, no accumulated time.
  { username: "matteo", routeId: "loren-roma-campania", mode: "TIME", difficulty: "EASY", effectivePlayTimeMs: 0, daysAgo: 1, startHour: 13, startMinute: 2, stopAfterSteps: 0 },
  { username: "valentina", routeId: "vesuvio-mozzarella-backtrack", mode: "CLICK", difficulty: "EASY", effectivePlayTimeMs: 35_760, daysAgo: 1, startHour: 18, startMinute: 29, stopAfterSteps: 2 },
];

export const DEMO_GAMES: readonly DemoGamePlan[] = [
  ...DEMO_COMPLETED_GAMES,
  ...DEMO_IN_PROGRESS_GAMES,
];

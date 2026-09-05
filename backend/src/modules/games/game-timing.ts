import type { Game } from "../../generated/prisma/client.js";

/**
 * Effective play time — the small, server-authoritative timing helper.
 *
 * There is no persistent play-session entity. A game carries three fields
 * (docs/game-rules.md §12, docs/database.md §8):
 *
 * - `effectivePlayTimeMs` — play time already finalized/accounted;
 * - `playStartedAt`       — start of the current unfinalized play interval
 *                           (`null` when nothing is pending);
 * - `lastHeartbeatAt`     — most recent proof the player was active (a heartbeat,
 *                           or a valid move/backtrack).
 *
 * These functions return the `data` fragment a caller folds into a single
 * `prisma.game.update`. They never touch the database themselves.
 */

type TimingState = Pick<
  Game,
  "effectivePlayTimeMs" | "playStartedAt" | "lastHeartbeatAt"
>;

/**
 * Length of the pending (unfinalized) interval, bounded by the last proof of
 * activity. `0` when there is nothing pending or the timestamps are inconsistent.
 */
export function pendingIntervalMs(
  playStartedAt: Date | null,
  lastHeartbeatAt: Date | null,
): number {
  if (!playStartedAt || !lastHeartbeatAt) {
    return 0;
  }
  return Math.max(0, lastHeartbeatAt.getTime() - playStartedAt.getTime());
}

/**
 * Open / resume: finalize any pending interval up to its last heartbeat, then
 * start a fresh interval at `now`. This is what makes an unexpectedly closed
 * browser only cost time up to its final heartbeat — the offline gap is never
 * counted.
 */
export function resumeIntervalData(state: TimingState, now: Date) {
  return {
    effectivePlayTimeMs:
      state.effectivePlayTimeMs +
      pendingIntervalMs(state.playStartedAt, state.lastHeartbeatAt),
    playStartedAt: now,
    lastHeartbeatAt: now,
  };
}

/**
 * Heartbeat / valid gameplay action: record that the player is active right now.
 * `playStartedAt` is only set here defensively — the resume flow normally
 * establishes it first.
 */
export function activityData(state: Pick<Game, "playStartedAt">, now: Date) {
  return {
    lastHeartbeatAt: now,
    ...(state.playStartedAt ? {} : { playStartedAt: now }),
  };
}

/**
 * Completion: the winning move proves the player is active now, so the final
 * interval is accounted up to `now`. After this the game has no pending interval.
 */
export function completionTimingData(playStartedAt: Date | null, now: Date) {
  return {
    effectivePlayTimeMs: { increment: pendingIntervalMs(playStartedAt, now) },
    playStartedAt: null,
    lastHeartbeatAt: null,
  };
}

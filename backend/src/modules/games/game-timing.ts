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
 * - `lastHeartbeatAt`     — most recent proof the current playable interval was
 *                           active; transitions reset it with the new interval.
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
export function resumeIntervalData(
  state: TimingState,
  now: Date,
  maximumPreviousBoundary?: Date,
) {
  const lastHeartbeatAt =
    maximumPreviousBoundary &&
    state.lastHeartbeatAt &&
    state.lastHeartbeatAt > maximumPreviousBoundary
      ? maximumPreviousBoundary
      : state.lastHeartbeatAt;

  return {
    effectivePlayTimeMs:
      state.effectivePlayTimeMs +
      pendingIntervalMs(state.playStartedAt, lastHeartbeatAt),
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
 * Successful article transition: account play only up to the server-observed
 * action boundary, then start a fresh interval once the destination article is
 * ready. MediaWiki work between the two timestamps is deliberately excluded.
 */
export function transitionTimingData(
  playStartedAt: Date | null,
  actionStartedAt: Date,
  restartedAt: Date,
) {
  return {
    effectivePlayTimeMs: {
      increment: pendingIntervalMs(playStartedAt, actionStartedAt),
    },
    playStartedAt: restartedAt,
    lastHeartbeatAt: restartedAt,
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

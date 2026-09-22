import type { Game } from "../../generated/prisma/client.js";

// Server-authoritative timing helpers. There is no separate play-session
// table; a game just carries three fields:
//   effectivePlayTimeMs - play time already finalized
//   playStartedAt        - start of the current, not-yet-finalized interval
//                           (null when nothing is pending)
//   lastHeartbeatAt       - last proof that interval was actually active;
//                           reset whenever a new interval starts
//
// Each function below only returns the `data` fragment for a
// prisma.game.update; none of them touch the database themselves.

type TimingState = Pick<
  Game,
  "effectivePlayTimeMs" | "playStartedAt" | "lastHeartbeatAt"
>;

// Length of the pending (unfinalized) interval, bounded by the last proof of
// activity. Returns 0 when there is nothing pending or the timestamps don't
// make sense.
export function pendingIntervalMs(
  playStartedAt: Date | null,
  lastHeartbeatAt: Date | null,
): number {
  if (!playStartedAt || !lastHeartbeatAt) {
    return 0;
  }
  return Math.max(0, lastHeartbeatAt.getTime() - playStartedAt.getTime());
}

// Open/resume: finalize any pending interval up to its last heartbeat, then
// start a fresh interval at `now`. If the browser was closed unexpectedly,
// this is why the offline gap never gets counted: play time only advances up
// to the last heartbeat that was actually received.
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

// Heartbeat / valid gameplay action: record that the player is active right
// now. playStartedAt is only set here as a fallback; the resume flow
// normally establishes it first.
export function activityData(state: Pick<Game, "playStartedAt">, now: Date) {
  return {
    lastHeartbeatAt: now,
    ...(state.playStartedAt ? {} : { playStartedAt: now }),
  };
}

// Successful article transition: account play only up to the moment the
// server received the action, then start a fresh interval once the
// destination article is ready. Time spent waiting on MediaWiki in between is
// intentionally not counted.
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

// Completion: the winning move proves the player is active now, so the final
// interval is accounted up to `now`, leaving no pending interval behind.
export function completionTimingData(playStartedAt: Date | null, now: Date) {
  return {
    effectivePlayTimeMs: { increment: pendingIntervalMs(playStartedAt, now) },
    playStartedAt: null,
    lastHeartbeatAt: null,
  };
}

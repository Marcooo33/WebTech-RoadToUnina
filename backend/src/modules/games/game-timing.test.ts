import assert from "node:assert/strict";
import { test } from "node:test";
import {
  activityData,
  completionTimingData,
  pendingIntervalMs,
  resumeIntervalData,
} from "./game-timing.js";

const at = (iso: string) => new Date(iso);

test("pendingIntervalMs returns the bounded interval length", () => {
  assert.equal(
    pendingIntervalMs(at("2026-01-01T18:00:00Z"), at("2026-01-01T18:07:00Z")),
    7 * 60_000,
  );
});

test("pendingIntervalMs is 0 when nothing is pending or timestamps are inconsistent", () => {
  assert.equal(pendingIntervalMs(null, at("2026-01-01T18:07:00Z")), 0);
  assert.equal(pendingIntervalMs(at("2026-01-01T18:00:00Z"), null), 0);
  assert.equal(pendingIntervalMs(null, null), 0);
  // last heartbeat before start (clock weirdness) never goes negative
  assert.equal(
    pendingIntervalMs(at("2026-01-01T18:07:00Z"), at("2026-01-01T18:00:00Z")),
    0,
  );
});

test("resumeIntervalData finalizes the previous interval up to its last heartbeat and restarts now", () => {
  // 18:00 opened, 18:07 last heartbeat, browser vanished, reopened 18:37.
  const now = at("2026-01-01T18:37:00Z");
  const data = resumeIntervalData(
    {
      effectivePlayTimeMs: 120_000,
      playStartedAt: at("2026-01-01T18:00:00Z"),
      lastHeartbeatAt: at("2026-01-01T18:07:00Z"),
    },
    now,
  );

  // only 7 minutes added — the 30-minute offline gap is not counted
  assert.equal(data.effectivePlayTimeMs, 120_000 + 7 * 60_000);
  assert.equal(data.playStartedAt, now);
  assert.equal(data.lastHeartbeatAt, now);
});

test("resumeIntervalData on a brand-new game adds nothing and starts the first interval", () => {
  const now = at("2026-01-01T18:00:00Z");
  const data = resumeIntervalData(
    { effectivePlayTimeMs: 0, playStartedAt: null, lastHeartbeatAt: null },
    now,
  );

  assert.equal(data.effectivePlayTimeMs, 0);
  assert.equal(data.playStartedAt, now);
  assert.equal(data.lastHeartbeatAt, now);
});

test("activityData advances the heartbeat and only sets playStartedAt when missing", () => {
  const now = at("2026-01-01T18:10:00Z");

  assert.deepEqual(activityData({ playStartedAt: at("2026-01-01T18:00:00Z") }, now), {
    lastHeartbeatAt: now,
  });

  assert.deepEqual(activityData({ playStartedAt: null }, now), {
    lastHeartbeatAt: now,
    playStartedAt: now,
  });
});

test("completionTimingData accounts the final interval up to now and clears pending state", () => {
  const now = at("2026-01-01T18:37:00Z");
  const data = completionTimingData(at("2026-01-01T18:30:00Z"), now);

  assert.deepEqual(data, {
    effectivePlayTimeMs: { increment: 7 * 60_000 },
    playStartedAt: null,
    lastHeartbeatAt: null,
  });
});

test("completionTimingData with no pending interval increments by 0", () => {
  const data = completionTimingData(null, at("2026-01-01T18:37:00Z"));
  assert.deepEqual(data.effectivePlayTimeMs, { increment: 0 });
});

test("effective time stays monotonic across resume + completion", () => {
  let effective = 0;
  // interval 1: 18:00 -> hb 18:05
  let state = {
    effectivePlayTimeMs: effective,
    playStartedAt: at("2026-01-01T18:00:00Z"),
    lastHeartbeatAt: at("2026-01-01T18:05:00Z"),
  };
  // reopen at 18:20 (gap not counted)
  const resumed = resumeIntervalData(state, at("2026-01-01T18:20:00Z"));
  effective = resumed.effectivePlayTimeMs;
  assert.equal(effective, 5 * 60_000);
  // win at 18:23
  const done = completionTimingData(resumed.playStartedAt, at("2026-01-01T18:23:00Z"));
  effective += done.effectivePlayTimeMs.increment;
  assert.equal(effective, 8 * 60_000);
  assert.ok(effective >= 0);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  GuestGamesService,
  GUEST_TTL_MS,
  MAX_GUEST_MOVES,
  GUEST_REQUEST_LIMIT,
  GUEST_REQUEST_WINDOW_MS,
} from "../src/modules/guest-games/guest-games.service.js";
import { createE2EWikipediaService } from "../src/testing/e2e-wikipedia.js";
import type {
  GameWithMoves,
  GuestGameState,
} from "../src/modules/games/games.types.js";
function fixture(capacity = 500) {
  let clock = Date.parse("2026-01-01T00:00:00Z");
  const wiki = createE2EWikipediaService();
  const saved: GameWithMoves[] = [];
  const service = new GuestGamesService(
    wiki,
    async (game) => {
      saved.push(structuredClone(game));
    },
    () => new Date(clock),
    capacity,
  );
  return {
    service,
    wiki,
    saved,
    advance: (ms: number) => {
      clock += ms;
    },
  };
}
async function win(
  service: GuestGamesService,
  token: string,
  state: GuestGameState,
) {
  state = await service.get(token, state.game.id);
  for (const title of [
    "Golfo di Napoli",
    "Napoli",
    "Università degli Studi di Napoli Federico II",
  ])
    state = await service.move(token, state.game.id, state.revision, title);
  return state;
}
test("CLICK/EASY only; one game; stale replacement; failed replacement preserves state; no persistence before claim", async () => {
  const { service, wiki, saved } = fixture();
  const token = GuestGamesService.newToken();
  const state = await service.create(token);
  assert.equal(state.game.mode, "CLICK");
  assert.equal(state.game.difficulty, "EASY");
  assert.equal(saved.length, 0);
  await assert.rejects(service.create(token), { code: "GUEST_GAME_EXISTS" });
  await assert.rejects(
    service.create(token, { gameId: state.game.id, revision: 999 }),
    { code: "GUEST_GAME_CHANGED" },
  );
  wiki.getStartingPage = async () => {
    throw new Error("offline");
  };
  await assert.rejects(
    service.create(token, { gameId: state.game.id, revision: state.revision }),
  );
  assert.equal(service.summary(token).game?.id, state.game.id);
});
test("timing excludes article loading; pause, reopen and failed moves preserve current semantics", async () => {
  const { service, wiki, advance } = fixture();
  const token = "timing";
  let state = await service.create(token);
  const article = wiki.getArticle;
  wiki.getArticle = async (id) => {
    advance(9000);
    return article(id);
  };
  state = await service.get(token, state.game.id);
  advance(1000);
  state = await service.move(
    token,
    state.game.id,
    state.revision,
    "Golfo di Napoli",
  );
  assert.equal(state.game.effectivePlayTimeMs, 1000);
  advance(2000);
  await assert.rejects(
    service.move(token, state.game.id, state.revision, "invalid"),
    { code: "INVALID_MOVE" },
  );
  advance(1000);
  await service.pause(token, state.game.id, state.revision);
  assert.equal(service.summary(token).game?.effectivePlayTimeMs, 4000);
  state = await service.get(token, state.game.id);
  advance(50_000);
  state = await service.get(token, state.game.id); // unclosed interval is discarded
  assert.equal(state.game.effectivePlayTimeMs, 4000);
});
test("TTL ignores summaries, articles, stale and invalid actions; never revives expired games", async () => {
  const { service, advance } = fixture();
  const token = "ttl";
  let state = await service.create(token);
  state = await service.get(token, state.game.id);
  const expires = state.expiresAt;
  advance(GUEST_TTL_MS - 1);
  assert.equal(service.summary(token).expiresAt, expires);
  await service.article(token, state.game.id);
  await assert.rejects(service.move(token, state.game.id, -1, "Napoli"), {
    code: "GUEST_GAME_CHANGED",
  });
  await assert.rejects(
    service.move(token, state.game.id, state.revision, "invalid"),
    { code: "INVALID_MOVE" },
  );
  assert.equal(service.summary(token).expiresAt, expires);
  advance(1);
  service.cleanup();
  assert.equal(service.summary(token).game, null);
  await assert.rejects(service.get(token, state.game.id), {
    code: "GAME_NOT_FOUND",
  });
});
test("accepted moves, pause and result opening renew TTL; paused no-op does not", async () => {
  const { service, advance } = fixture();
  const token = "activity";
  let state = await service.create(token);
  advance(1000);
  state = await service.get(token, state.game.id);
  let expires = state.expiresAt;
  advance(1000);
  state = await service.move(
    token,
    state.game.id,
    state.revision,
    "Golfo di Napoli",
  );
  assert.ok(state.expiresAt > expires);
  expires = state.expiresAt;
  advance(1000);
  await service.pause(token, state.game.id, state.revision);
  const summary = service.summary(token);
  assert.ok(summary.expiresAt! > expires);
  advance(1000);
  await service.pause(token, state.game.id, summary.revision!);
  assert.equal(service.summary(token).expiresAt, summary.expiresAt);
});
test("stale tabs and delayed pause cannot change newer state; backtracks retain the full history", async () => {
  const { service } = fixture();
  const token = "tabs";
  const created = await service.create(token);
  const tab1 = await service.get(token, created.game.id);
  let tab2 = await service.get(token, created.game.id);
  await assert.rejects(service.pause(token, created.game.id, tab1.revision), {
    code: "GUEST_GAME_CHANGED",
  });
  tab2 = await service.move(
    token,
    created.game.id,
    tab2.revision,
    "Golfo di Napoli",
  );
  tab2 = await service.move(token, created.game.id, tab2.revision);
  assert.equal(tab2.game.clickCount, 1);
  assert.equal(tab2.game.backtrackCount, 1);
  assert.equal(tab2.game.moves.length, 2);
  assert.equal(tab2.game.path.length, 1);
  await assert.rejects(
    service.move(token, created.game.id, tab1.revision, "Golfo di Napoli"),
    { code: "GUEST_GAME_CHANGED" },
  );
});
test("authenticated resume rejection has no mutation; explicit discard removes unfinished game", async () => {
  const { service } = fixture();
  const state = await service.create("auth");
  const before = service.summary("auth");
  await assert.rejects(service.get("auth", state.game.id, true), {
    code: "GUEST_PLAY_REQUIRES_ANONYMOUS",
  });
  assert.deepEqual(service.summary("auth"), before);
  await service.discard("auth", state.game.id, state.revision);
  assert.equal(service.summary("auth").game, null);
});
test("victory remains claimable; same-owner replay; different-owner rejection; receipt expires without renewal", async () => {
  const { service, saved, advance } = fixture();
  let state = await service.create("claim");
  state = await win(service, "claim", state);
  assert.equal(state.game.status, "COMPLETED");
  assert.equal(saved.length, 0);
  assert.equal((await service.get("claim", state.game.id)).article, null);
  await service.claim("claim", state.game.id, "user");
  assert.equal(saved.length, 1);
  assert.equal(saved[0].moves.length, 3);
  assert.equal(saved[0].playStartedAt, null);
  const expires = service.expiresAt("claim");
  advance(1000);
  assert.equal(
    (await service.claim("claim", state.game.id, "user")).replay,
    true,
  );
  assert.equal(service.expiresAt("claim"), expires);
  await assert.rejects(service.claim("claim", state.game.id, "other"), {
    code: "GUEST_GAME_ALREADY_CLAIMED",
  });
  advance(GUEST_TTL_MS);
  await assert.rejects(service.claim("claim", state.game.id, "user"), {
    code: "GAME_NOT_FOUND",
  });
});
test("failed claim retains result for retry; concurrent claim/discard/replacement cannot race", async () => {
  let fail = true;
  let release!: () => void;
  let entered!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  const service = new GuestGamesService(
    createE2EWikipediaService(),
    async () => {
      if (fail) throw new Error("temporary database failure");
      entered();
      await wait;
    },
  );
  let state = await service.create("retry");
  state = await win(service, "retry", state);
  await assert.rejects(service.claim("retry", state.game.id, "user"), {
    code: "GUEST_CLAIM_FAILED",
  });
  assert.equal(service.summary("retry").game?.status, "COMPLETED");
  fail = false;
  const claim = service.claim("retry", state.game.id, "user");
  await started;
  await assert.rejects(service.claim("retry", state.game.id, "user"), {
    code: "GUEST_GAME_BUSY",
  });
  await assert.rejects(
    service.discard("retry", state.game.id, state.revision),
    { code: "GUEST_GAME_BUSY" },
  );
  await assert.rejects(service.create("retry"), { code: "GUEST_GAME_BUSY" });
  release();
  await claim;
});
test("capacity, cleanup, creation throttle, wrong identity and backend restart", async () => {
  const { service, advance } = fixture(1);
  const state = await service.create("one");
  await assert.rejects(service.create("two"), {
    code: "GUEST_CAPACITY_REACHED",
  });
  await assert.rejects(service.get("wrong", state.game.id), {
    code: "GAME_NOT_FOUND",
  });
  for (let i = 0; i < 10; i++) service.throttle("ip");
  assert.throws(() => service.throttle("ip"), { code: "GUEST_RATE_LIMITED" });
  advance(GUEST_TTL_MS);
  service.cleanup();
  service.throttle("ip");
  await service.create("two");
  const fresh = fixture().service;
  await assert.rejects(fresh.get("one", state.game.id), {
    code: "GAME_NOT_FOUND",
  });
});

test("post-authentication cleanup refuses a completed game even at its current revision", async () => {
  const { service, saved } = fixture();
  let state = await service.create("completed");
  state = await win(service, "completed", state);
  await assert.rejects(
    service.discard("completed", state.game.id, state.revision, true),
    { code: "GUEST_GAME_CHANGED" },
  );
  assert.equal(service.summary("completed").game?.status, "COMPLETED");
  await service.claim("completed", state.game.id, "user");
  assert.equal(saved.length, 1);
  assert.equal(
    (await service.claim("completed", state.game.id, "user")).replay,
    true,
  );
});

for (const replace of [false, true]) {
  test(`summary reports delayed ${replace ? "replacement" : "creation"} as busy until resolved`, async () => {
    const { service, wiki } = fixture();
    const original = replace ? await service.create("pending") : null;
    const startingPage = wiki.getStartingPage.bind(wiki);
    let release!: () => void;
    wiki.getStartingPage = async () => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return startingPage();
    };
    const creating = service.create(
      "pending",
      original
        ? {
            gameId: original.game.id,
            revision: original.revision,
          }
        : undefined,
    );
    assert.throws(() => service.summary("pending"), {
      code: "GUEST_GAME_BUSY",
    });
    release();
    const created = await creating;
    assert.equal(service.summary("pending").game?.id, created.game.id);
    await service.discard("pending", created.game.id, created.revision, true);
    assert.equal(service.summary("pending").game, null);
  });
}

test("failed delayed replacement preserves a completed result for claim", async () => {
  const { service, wiki, saved } = fixture();
  let original = await service.create("replacement");
  original = await win(service, "replacement", original);
  const before = service.summary("replacement");
  let fail!: () => void;
  wiki.getStartingPage = () =>
    new Promise((_resolve, reject) => {
      fail = () => reject(new Error("Wikipedia unavailable"));
    });
  const replacing = service.create("replacement", {
    gameId: original.game.id,
    revision: original.revision,
  });
  assert.throws(() => service.summary("replacement"), {
    code: "GUEST_GAME_BUSY",
  });
  fail();
  await assert.rejects(replacing);
  assert.deepEqual(service.summary("replacement"), before);
  await service.claim("replacement", original.game.id, "user");
  assert.equal(saved.length, 1);
});

test("guest request window rejects excess requests without mutation and resets at the boundary", async () => {
  const { service, advance } = fixture();
  let state = await service.create("limited");
  for (let i = 0; i < GUEST_REQUEST_LIMIT; i++) {
    await assert.rejects(
      service.move("limited", state.game.id, -1, "invalid"),
      {
        code: "GUEST_GAME_CHANGED",
      },
    );
  }
  const before = service.summary("limited");
  await assert.rejects(service.get("limited", state.game.id), {
    code: "GUEST_RATE_LIMITED",
    status: 429,
  });
  assert.deepEqual(service.summary("limited"), before);
  // Another guest has an independent allowance.
  const other = await service.create("other");
  await service.get("other", other.game.id);
  advance(GUEST_REQUEST_WINDOW_MS - 1);
  await assert.rejects(service.get("limited", state.game.id), {
    code: "GUEST_RATE_LIMITED",
  });
  advance(1);
  state = await win(service, "limited", state);
  // Claim and replay remain available even when the gameplay window is exhausted.
  for (let i = 4; i < GUEST_REQUEST_LIMIT; i++)
    await service.article("limited", state.game.id);
  await assert.rejects(service.article("limited", state.game.id), {
    code: "GUEST_RATE_LIMITED",
  });
  await service.claim("limited", state.game.id, "user");
  assert.equal(
    (await service.claim("limited", state.game.id, "user")).replay,
    true,
  );
});

test("move cap preserves history, permits completion on the last move, and permits replacement", async () => {
  const { service, advance, saved } = fixture();
  let capped = await service.create("capped");
  let winner = await service.create("winner");
  // Alternate navigation and backtracking, returning to the starting page.
  for (let i = 0; i < MAX_GUEST_MOVES; i++) {
    advance(GUEST_REQUEST_WINDOW_MS);
    capped = await service.move(
      "capped",
      capped.game.id,
      capped.revision,
      i % 2 === 0 ? "Golfo di Napoli" : undefined,
    );
    if (i < MAX_GUEST_MOVES - 4)
      winner = await service.move(
        "winner",
        winner.game.id,
        winner.revision,
        i % 2 === 0 ? "Golfo di Napoli" : undefined,
      );
  }
  const before = service.summary("capped");
  await assert.rejects(
    service.move("capped", capped.game.id, capped.revision, "Golfo di Napoli"),
    {
      code: "GUEST_MOVE_LIMIT_REACHED",
    },
  );
  assert.deepEqual(service.summary("capped"), before);
  assert.equal(
    (await service.get("capped", capped.game.id)).game.moves.length,
    MAX_GUEST_MOVES,
  );

  for (const title of [
    "Golfo di Napoli",
    "Storia di Napoli",
    "Napoli",
    "Università degli Studi di Napoli Federico II",
  ])
    winner = await service.move(
      "winner",
      winner.game.id,
      winner.revision,
      title,
    );
  await service.claim("winner", winner.game.id, "user");
  assert.equal(saved[0].moves.length, MAX_GUEST_MOVES);
  const summary = service.summary("capped");
  const replacement = await service.create("capped", {
    gameId: capped.game.id,
    revision: summary.revision!,
  });
  assert.equal(replacement.game.moves.length, 0);
});

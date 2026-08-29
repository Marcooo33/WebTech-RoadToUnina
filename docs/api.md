# ROADTOUNINA — API Contract

## 1. Purpose

This document defines the REST contract for the entire initial application. It is the source of truth for the frontend/backend interface and is implemented progressively by Milestones 5–15.

The contract is consistent with:

- `docs/architecture.md` — Express backend is authoritative; Angular requests actions only;
- `docs/game-rules.md` — game rules, difficulty, sessions, leaderboards;
- `docs/database.md` — Prisma entities and enums.

No endpoint trusts the frontend for authoritative game state. Every resource's ownership is derived from the authenticated identity, never from a client-supplied `userId`.

---

## 2. Conventions

### 2.1 Base path

All application endpoints live under:

```text
/api
```

The only exception is the infrastructure health check:

```text
GET /health
```

which remains outside `/api`.

### 2.2 Content type

Requests and responses use `application/json` unless stated otherwise.

- Requests with a body MUST send `Content-Type: application/json`.
- Malformed JSON bodies are rejected with `400 INVALID_JSON`.
- Responses set `Content-Type: application/json`.

### 2.3 Authentication

Authentication uses a **JWT stored in an HttpOnly cookie** (chosen over a `Bearer` header to keep the token out of JavaScript reach while avoiding a server-side session table).

- Cookie name: `access_token`.
- Cookie attributes:
  - `HttpOnly` (always);
  - `SameSite=Lax` (always);
  - `Secure` (production);
  - `Path=/`.
- The JWT `sub` claim carries the authenticated user's UUID.
- Expiry is configurable through environment configuration (the exact value is decided in Milestone 5); the contract does not depend on a specific lifetime.

The browser sends the cookie automatically; Angular does not manage an `Authorization` header. Frontend HTTP calls must be configured to send cookies (dev proxy or `withCredentials`).

**Logout** clears the cookie. The initial version is stateless: the server does not maintain a token blacklist. A token remains cryptographically valid until it expires, but the client discards it on logout.

**CSRF note:** with cookie-based auth, state-changing endpoints are CSRF-relevant. The initial mitigation is `SameSite=Lax` combined with a strict CORS origin allowlist and JSON-only bodies. A dedicated CSRF token is intentionally out of scope for the initial version.

### 2.4 Success responses

Success responses return the resource or a structured list object **directly**, without a generic envelope.

- Single resource → the resource object itself.
- Lists → an object containing `items` plus pagination metadata (see §2.7).
- `204 No Content` is used where there is no body (delete, logout).

### 2.5 Error responses

Every error uses the standard shape established by the Milestone 3 backend foundation (`src/shared/errors.ts`):

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request",
    "details": [ { "path": "body.username", "message": "Required" } ]
  }
}
```

- `code` — machine-readable error code (see §2.6);
- `message` — human-readable summary;
- `details` — optional; present for validation errors (array of `{ path, message }`) and anywhere else that benefits from structured context.

### 2.6 Error codes

The following codes extend the four already implemented in Milestone 3 (`VALIDATION_ERROR`, `INVALID_JSON`, `NOT_FOUND`, `INTERNAL_ERROR`). The new codes are documented here and implemented in later milestones.

| HTTP | Code | Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Request body/query/path failed validation. |
| 400 | `INVALID_JSON` | Request body is not valid JSON. |
| 401 | `AUTHENTICATION_REQUIRED` | Missing, invalid, or expired token. |
| 401 | `INVALID_CREDENTIALS` | Login identifier or password is incorrect. |
| 403 | `FORBIDDEN` | Authenticated but not permitted (never used for Game ownership). |
| 404 | `NOT_FOUND` | Unknown route or non-existent public resource. |
| 404 | `GAME_NOT_FOUND` | Game does not exist **or** is not owned by the authenticated user. |
| 409 | `USERNAME_TAKEN` | Username is already registered. |
| 409 | `EMAIL_TAKEN` | Email is already registered. |
| 409 | `STALE_VERSION` | `Game.version` mismatch (optimistic concurrency conflict). |
| 409 | `GAME_LIMIT_REACHED` | User already has 10 `IN_PROGRESS` games. |
| 409 | `GAME_NOT_IN_PROGRESS` | Operation requires an `IN_PROGRESS` game (e.g. deleting a completed game). |
| 409 | `NO_ACTIVE_SESSION` | Gameplay action requires an `ACTIVE` session and none exists. |
| 422 | `INVALID_MOVE` | Requested target page is not a valid playable link from the current page. |
| 422 | `BACKTRACK_NOT_ALLOWED` | Backtracking is forbidden for `HARD` difficulty, or is impossible because the active path is already at the starting page. |
| 422 | `BACKTRACK_LIMIT_REACHED` | `MEDIUM` backtracking limit (3) has been reached. |
| 500 | `INTERNAL_ERROR` | Unexpected server error (details are never exposed). |

Rules:

- `FORBIDDEN` MUST NOT be used to distinguish ownership of `Game` resources. A game that does not exist or is not owned by the caller is always reported as `404 GAME_NOT_FOUND`.
- `409 Conflict` is reserved for state conflicts (version mismatch, duplicates, limits, non-`IN_PROGRESS` status, missing active session).
- `422 Unprocessable Entity` is reserved for syntactically valid requests that violate a game rule (invalid move, backtracking rules).

### 2.7 Pagination

Used only by the public history list (`GET /api/history`).

- Offset-based:
  - `page` (1-based, default `1`);
  - `limit` (default `20`, max `100`).
- Response includes `page`, `limit`, `total`, and `items`.

`GET /api/games` and leaderboards are not paginated (a user has at most 10 in-progress games; leaderboards return a fixed top-`N`).

### 2.8 Enum serialization

Enums serialize as their Prisma string values, uppercase:

- `GameMode`: `CLICK`, `TIME`
- `GameDifficulty`: `EASY`, `MEDIUM`, `HARD`
- `GameStatus`: `IN_PROGRESS`, `COMPLETED`
- `GameMoveType`: `NAVIGATION`, `BACKTRACK`
- `GameSessionStatus`: `ACTIVE`, `ENDED`, `EXPIRED`

Request bodies/query parameters use the same uppercase strings. Validation is case-sensitive.

### 2.9 Date/time serialization

All timestamps are ISO 8601 strings in UTC, with millisecond precision, e.g.:

```text
2026-08-28T10:15:30.000Z
```

### 2.10 ID representation

- Database primary keys (`User.id`, `Game.id`, `GameMove.id`, `GameSession.id`) are **UUID strings**.
- MediaWiki page identifiers (`startPageId`, `currentPageId`, `fromPageId`, `toPageId`, and any `pageId`) are **integers** (MediaWiki `pageid`).

The frontend never supplies MediaWiki titles or URLs for authoritative navigation; it supplies page ids, which the backend validates.

### 2.11 Version / optimistic concurrency

Every `Game` has a numeric `version`, starting at `0`.

- Mutations that change navigation state (`move`, `backtrack`) MUST include the `version` the client believes is current.
- If the supplied `version` does not match the persisted `Game.version`, the backend rejects with `409 STALE_VERSION` and does not mutate state.
- On success the `version` increments, and the response returns the new `version`.
- `DELETE /api/games/:gameId` REQUIRES a `version` supplied as a query parameter (`?version=<expectedVersion>`); a mismatch returns `409 STALE_VERSION`. There is no request body on delete.
- Session lifecycle may change `effectivePlayTimeMs` (and therefore `version`); session endpoints return the current `gameVersion` so the client stays in sync. A successful heartbeat does not change the `Game` row and therefore does not bump `version`; however, finalizing an expired session (see §6.2 and §9.3) does update `effectivePlayTimeMs` and increment `version`.

### 2.12 Authority rules

The frontend MUST NOT send authoritative values. In particular the backend never accepts from the client:

- `clickCount`;
- `backtrackCount`;
- `effectivePlayTimeMs`;
- `status` (game completion);
- `currentPageId` / `currentPageTitle` (current page);
- score or ranking values;
- `userId` for ownership.

The frontend sends **requested actions** (e.g. "navigate to page id `X`", "backtrack", "start a session") and the backend validates and applies them. Victory, counters, timing, and completion are always decided server-side.

---

## 3. Data Transfer Objects

DTOs are defined explicitly; raw Prisma models are not exposed, and `passwordHash` (or any credential material) is never serialized.

### 3.1 UserSummaryDto

Public representation of a player. Excludes email and any credential fields.

```json
{
  "id": "7d9f0c1e-…",
  "username": "marco",
  "avatarUrl": "https://…" 
}
```

`avatarUrl` is `null` when unset.

### 3.2 UserProfileDto

The authenticated user's own profile (returned only for the current user).

```json
{
  "id": "7d9f0c1e-…",
  "username": "marco",
  "email": "marco@example.com",
  "avatarUrl": null,
  "createdAt": "2026-08-28T10:00:00.000Z"
}
```

### 3.3 PageRef

A reference to a Wikipedia page on the active path.

```json
{
  "pageId": 123456,
  "title": "Università degli Studi di Napoli Federico II"
}
```

### 3.4 GameMoveDto

A single chronological game event.

```json
{
  "sequence": 1,
  "type": "NAVIGATION",
  "fromPageId": 100,
  "fromPageTitle": "…",
  "toPageId": 200,
  "toPageTitle": "…",
  "createdAt": "2026-08-28T10:01:00.000Z"
}
```

### 3.5 GameListItemDto

Item in the current user's game list.

```json
{
  "id": "…",
  "mode": "CLICK",
  "difficulty": "EASY",
  "status": "IN_PROGRESS",
  "startPageTitle": "…",
  "currentPageId": 200,
  "currentPageTitle": "…",
  "clickCount": 4,
  "backtrackCount": 1,
  "effectivePlayTimeMs": 84000,
  "version": 6,
  "startedAt": "2026-08-28T10:00:00.000Z",
  "completedAt": null,
  "hasActiveSession": true
}
```

### 3.6 GameDto

Full representation of an owned game (used to resume).

```json
{
  "id": "…",
  "mode": "CLICK",
  "difficulty": "EASY",
  "status": "IN_PROGRESS",
  "startPageId": 100,
  "startPageTitle": "…",
  "currentPageId": 200,
  "currentPageTitle": "…",
  "clickCount": 4,
  "backtrackCount": 1,
  "effectivePlayTimeMs": 84000,
  "version": 6,
  "startedAt": "2026-08-28T10:00:00.000Z",
  "completedAt": null,
  "createdAt": "2026-08-28T10:00:00.000Z",
  "path": [
    { "pageId": 100, "title": "…" },
    { "pageId": 150, "title": "…" },
    { "pageId": 200, "title": "…" }
  ],
  "moves": [
    { "sequence": 1, "type": "NAVIGATION", "fromPageId": 100, "fromPageTitle": "…", "toPageId": 150, "toPageTitle": "…", "createdAt": "…" }
  ],
  "activeSession": {
    "id": "…",
    "gameId": "…",
    "status": "ACTIVE",
    "startedAt": "2026-08-28T10:05:00.000Z",
    "endedAt": null,
    "lastHeartbeatAt": "2026-08-28T10:06:30.000Z"
  }
}
```

`path` is the reconstructed active path (start page → current page). `moves` is the complete chronological event history. `activeSession` is `null` when no `ACTIVE` session exists.

### 3.7 SessionDto

```json
{
  "id": "…",
  "gameId": "…",
  "status": "ACTIVE",
  "startedAt": "2026-08-28T10:05:00.000Z",
  "endedAt": null,
  "lastHeartbeatAt": "2026-08-28T10:06:30.000Z"
}
```

### 3.8 SessionResponseDto

Returned by every session operation so the client stays in sync with authoritative timing/version.

```json
{
  "session": { "…": "SessionDto" },
  "effectivePlayTimeMs": 84000,
  "gameVersion": 7
}
```

### 3.9 ArticleDto

The current article representation for the active game.

```json
{
  "gameId": "…",
  "pageId": 200,
  "title": "…",
  "version": 6,
  "contentHtml": "<p>sanitized content…</p>",
  "links": [
    { "pageId": 123456, "title": "…" },
    { "pageId": 789012, "title": "…" }
  ]
}
```

- `contentHtml` is normalized and sanitized HTML; external/non-playable links are removed.
- `links` lists the playable internal Wikipedia links. The frontend maps clicks on these to a move request using `pageId`.
- `version` mirrors the current `Game.version` so the client can use it for the next move.

### 3.10 CompletedGameSummaryDto

Item in the public history list.

```json
{
  "gameId": "…",
  "mode": "CLICK",
  "difficulty": "MEDIUM",
  "clickCount": 12,
  "effectivePlayTimeMs": 420000,
  "startPageTitle": "…",
  "completedAt": "2026-08-28T10:20:00.000Z",
  "player": {
    "id": "…",
    "username": "marco",
    "avatarUrl": null
  }
}
```

### 3.11 CompletedGameDetailDto

Public detail of a completed game.

```json
{
  "gameId": "…",
  "mode": "CLICK",
  "difficulty": "MEDIUM",
  "clickCount": 12,
  "backtrackCount": 2,
  "effectivePlayTimeMs": 420000,
  "startPageId": 100,
  "startPageTitle": "…",
  "completedAt": "2026-08-28T10:20:00.000Z",
  "path": [
    { "pageId": 100, "title": "…" },
    { "pageId": 123456, "title": "Università degli Studi di Napoli Federico II" }
  ],
  "moves": [
    { "sequence": 1, "type": "NAVIGATION", "fromPageId": 100, "fromPageTitle": "…", "toPageId": 123456, "toPageTitle": "…", "createdAt": "…" }
  ],
  "player": {
    "id": "…",
    "username": "marco",
    "avatarUrl": null
  }
}
```

### 3.12 LeaderboardEntryDto

Ranking entry. Both metrics are always present; ordering differs by leaderboard (§7.2).

```json
{
  "rank": 1,
  "gameId": "…",
  "username": "marco",
  "clickCount": 8,
  "effectivePlayTimeMs": 300000,
  "completedAt": "2026-08-28T10:20:00.000Z"
}
```

### 3.13 StatisticsDto

Personal statistics derived from the current user's completed/ongoing games.

```json
{
  "completedGames": 5,
  "inProgressGames": 2,
  "bestClick": {
    "gameId": "…",
    "difficulty": "EASY",
    "clickCount": 8,
    "effectivePlayTimeMs": 300000,
    "completedAt": "2026-08-28T10:20:00.000Z"
  },
  "bestTime": {
    "gameId": "…",
    "difficulty": "HARD",
    "clickCount": 15,
    "effectivePlayTimeMs": 210000,
    "completedAt": "2026-08-27T15:30:00.000Z"
  },
  "averageClicks": 12.4,
  "averageEffectiveTimeMs": 380000
}
```

`bestClick`/`bestTime` are `null` when the user has no completed games in the relevant mode. Averages are `null` when there is no data for the relevant mode.

---

## 4. Authentication

### 4.1 Register

```http
POST /api/auth/register
```

**Auth:** none.

**Body:**

```json
{
  "username": "marco",
  "email": "marco@example.com",
  "password": "secret"
}
```

| Field | Type | Constraints |
|---|---|---|
| `username` | string | required, 3–30 chars, unique |
| `email` | string | required, valid email, unique (normalized) |
| `password` | string | required, minimum length decided in Milestone 5 |

**Success:** `201 Created`. Sets the `access_token` cookie and returns the created `UserProfileDto`.

**Errors:**

- `400 VALIDATION_ERROR` — invalid/missing fields;
- `409 USERNAME_TAKEN` — username already exists;
- `409 EMAIL_TAKEN` — email already exists.

### 4.2 Login

```http
POST /api/auth/login
```

**Auth:** none.

**Body:**

```json
{
  "identifier": "marco",
  "password": "secret"
}
```

| Field | Type | Constraints |
|---|---|---|
| `identifier` | string | required; either username or email |
| `password` | string | required |

**Success:** `200 OK`. Sets the `access_token` cookie and returns the `UserProfileDto`.

**Errors:**

- `400 VALIDATION_ERROR` — missing fields;
- `401 INVALID_CREDENTIALS` — wrong identifier or password.

### 4.3 Logout

```http
POST /api/auth/logout
```

**Auth:** required.

**Body:** none.

**Success:** `204 No Content`. Clears the `access_token` cookie.

**Errors:**

- `401 AUTHENTICATION_REQUIRED` — not authenticated.

### 4.4 Current authenticated user

```http
GET /api/auth/me
```

**Auth:** required.

**Success:** `200 OK` with `UserProfileDto`.

**Errors:**

- `401 AUTHENTICATION_REQUIRED` — not authenticated.

This endpoint is also the "profile" endpoint used by the Profile/Statistics surface (§8.1).

---

## 5. Games

All game endpoints are authenticated. Ownership is derived from the authenticated identity; a game not owned by the caller is indistinguishable from a missing game (`404 GAME_NOT_FOUND`).

### 5.1 Create game

```http
POST /api/games
```

**Auth:** required.

**Body:**

```json
{
  "mode": "CLICK",
  "difficulty": "EASY"
}
```

| Field | Type | Constraints |
|---|---|---|
| `mode` | `GameMode` | required |
| `difficulty` | `GameDifficulty` | required |

**Behavior:** the backend selects a random eligible starting page (MediaWiki), sets status `IN_PROGRESS`, counters `0`, `version 0`, and persists the game. Only `mode` and `difficulty` come from the client.

**Success:** `201 Created` with `GameDto`.

**Errors:**

- `400 VALIDATION_ERROR`;
- `401 AUTHENTICATION_REQUIRED`;
- `409 GAME_LIMIT_REACHED` — user already has 10 `IN_PROGRESS` games.

### 5.2 List current user's games

```http
GET /api/games
```

**Auth:** required.

**Query parameters:**

| Param | Type | Default | Notes |
|---|---|---|---|
| `status` | `GameStatus` | omitted | optional filter (`IN_PROGRESS` \| `COMPLETED`) |

**Success:** `200 OK`.

```json
{
  "items": [ { "…": "GameListItemDto" } ]
}
```

**Errors:** `401 AUTHENTICATION_REQUIRED`, `400 VALIDATION_ERROR`.

### 5.3 Get owned game

```http
GET /api/games/:gameId
```

**Auth:** required.

**Path parameters:** `gameId` (UUID).

**Success:** `200 OK` with `GameDto` (full resume payload, including `path`, `moves`, `activeSession`).

**Errors:**

- `400 VALIDATION_ERROR` — invalid `gameId`;
- `401 AUTHENTICATION_REQUIRED`;
- `404 GAME_NOT_FOUND` — not found or not owned.

### 5.4 Delete owned IN_PROGRESS game

```http
DELETE /api/games/:gameId?version=<expectedVersion>
```

**Auth:** required.

**Path parameters:** `gameId` (UUID).

**Query parameters:**

| Param | Type | Constraints |
|---|---|---|
| `version` | integer | **required**; expected `Game.version` |

**Body:** none.

**Behavior:** only the owner may delete, and only when status is `IN_PROGRESS`. Moves and sessions cascade. Completed games are never deletable. The expected `version` is validated before deletion.

**Success:** `204 No Content`.

**Errors:**

- `400 VALIDATION_ERROR`;
- `401 AUTHENTICATION_REQUIRED`;
- `404 GAME_NOT_FOUND`;
- `409 GAME_NOT_IN_PROGRESS` — game is `COMPLETED`;
- `409 STALE_VERSION` — supplied `version` mismatch.

### 5.5 Get current article

```http
GET /api/games/:gameId/article
```

**Auth:** required.

**Path parameters:** `gameId` (UUID).

**Behavior:** returns the sanitized, sandboxed representation of the game's current Wikipedia article plus its playable internal links. This does not change game state (no counter/version change).

**Success:** `200 OK` with `ArticleDto`.

**Errors:**

- `400 VALIDATION_ERROR`;
- `401 AUTHENTICATION_REQUIRED`;
- `404 GAME_NOT_FOUND`.

### 5.6 Navigation move

```http
POST /api/games/:gameId/moves
```

**Auth:** required.

**Path parameters:** `gameId` (UUID).

**Body:**

```json
{
  "toPageId": 123456,
  "version": 6
}
```

| Field | Type | Constraints |
|---|---|---|
| `toPageId` | integer | required; target MediaWiki page id |
| `version` | integer | required; expected `Game.version` |

**Behavior:** the backend verifies ownership, `IN_PROGRESS` status, an `ACTIVE` session, and the expected version; then verifies `toPageId` is reachable through a valid internal link from the current page. On success it stores a `NAVIGATION` `GameMove`, increments `clickCount` and `version`, updates the current page, and checks for victory. Backtracking does not count here.

**Success:** `200 OK` with the updated `GameDto` (including the new `version` and, when the target is reached, `status: COMPLETED` and `completedAt`).

**Errors:**

- `400 VALIDATION_ERROR`;
- `401 AUTHENTICATION_REQUIRED`;
- `404 GAME_NOT_FOUND`;
- `409 STALE_VERSION`;
- `409 GAME_NOT_IN_PROGRESS` — game already completed;
- `409 NO_ACTIVE_SESSION` — no `ACTIVE` session (see §9.3 expiration behavior);
- `422 INVALID_MOVE` — target not a valid playable link from the current page.

### 5.7 Backtrack

```http
POST /api/games/:gameId/backtrack
```

**Auth:** required.

**Path parameters:** `gameId` (UUID).

**Body:**

```json
{
  "version": 6
}
```

| Field | Type | Constraints |
|---|---|---|
| `version` | integer | required; expected `Game.version` |

**Behavior:** a dedicated action separate from navigation. On success the backend stores a `BACKTRACK` `GameMove`, moves the active path one step back, increments `backtrackCount` and `version`. It does **not** increment `clickCount`. When the active path contains only the starting page there is no previous page to return to, so backtracking is rejected with `BACKTRACK_NOT_ALLOWED`.

Difficulty enforcement:

- `EASY` — unlimited;
- `MEDIUM` — at most 3 (rejects the 4th);
- `HARD` — rejected.

**Success:** `200 OK` with the updated `GameDto`.

**Errors:**

- `400 VALIDATION_ERROR`;
- `401 AUTHENTICATION_REQUIRED`;
- `404 GAME_NOT_FOUND`;
- `409 STALE_VERSION`;
- `409 GAME_NOT_IN_PROGRESS`;
- `409 NO_ACTIVE_SESSION`;
- `422 BACKTRACK_NOT_ALLOWED` — `HARD` difficulty, or the active path is already at the starting page;
- `422 BACKTRACK_LIMIT_REACHED` — `MEDIUM` already used 3 backtracks.

---

## 6. Game Sessions

Sessions are persistent records (`GameSession`). A game has at most one `ACTIVE` session. The frontend timer is display-only; the backend owns effective play time.

The session is scoped to the game: the backend always operates on the game's current `ACTIVE` session (never on a client-supplied session id).

### 6.1 Start / resume session

```http
POST /api/games/:gameId/session
```

**Auth:** required.

**Path parameters:** `gameId` (UUID).

**Body:** none.

**Behavior (idempotent):**

- If an `ACTIVE` session already exists, return it (refresh/resume and cross-device hand-off reuse the same session; no second `ACTIVE` session is created).
- If the previous `ACTIVE` session has expired (heartbeat timeout), finalize it first using `lastHeartbeatAt` for effective-time accounting (see §9.3), then create a new `ACTIVE` session.
- If no `ACTIVE` session exists, create one.

**Success:** `200 OK` with `SessionResponseDto`.

**Errors:** `400 VALIDATION_ERROR`, `401 AUTHENTICATION_REQUIRED`, `404 GAME_NOT_FOUND`, `409 GAME_NOT_IN_PROGRESS`.

### 6.2 Heartbeat

```http
POST /api/games/:gameId/session/heartbeat
```

**Auth:** required.

**Path parameters:** `gameId` (UUID).

**Body:** none.

**Behavior:** updates `lastHeartbeatAt` of the current `ACTIVE` session. A successful heartbeat does not change the `Game` row, so `version` is not bumped.

If the heartbeat discovers that the `ACTIVE` session has already exceeded the heartbeat timeout, the backend:

1. finalizes the session as `EXPIRED`, using `lastHeartbeatAt` (not the detection moment) as the effective end for time accounting;
2. updates `Game.effectivePlayTimeMs` and increments `Game.version` accordingly;
3. returns `409 NO_ACTIVE_SESSION`.

**Success:** `200 OK` with `SessionResponseDto` (`gameVersion` unchanged).

**Errors:** `400 VALIDATION_ERROR`, `401 AUTHENTICATION_REQUIRED`, `404 GAME_NOT_FOUND`, `409 NO_ACTIVE_SESSION` (no `ACTIVE` session, or the session expired as described above).

### 6.3 End session

```http
POST /api/games/:gameId/session/end
```

**Auth:** required.

**Path parameters:** `gameId` (UUID).

**Body:** none.

**Behavior:** explicitly ends the current `ACTIVE` session, computes its duration, accumulates it into `Game.effectivePlayTimeMs`, and bumps `Game.version`. A `beforeunload` browser event is not the sole mechanism for this (it is unreliable); heartbeat expiry is the fallback.

**Success:** `200 OK` with `SessionResponseDto` (session now `ENDED`, updated `effectivePlayTimeMs` and `gameVersion`).

**Errors:** `400 VALIDATION_ERROR`, `401 AUTHENTICATION_REQUIRED`, `404 GAME_NOT_FOUND`, `409 NO_ACTIVE_SESSION`.

---

## 7. Public History & Leaderboards

These endpoints are public (no auth). They expose only `COMPLETED` games. `IN_PROGRESS` games can never appear.

### 7.1 Public history

#### 7.1.1 List completed games

```http
GET /api/history
```

**Auth:** none.

**Query parameters:**

| Param | Type | Default | Notes |
|---|---|---|---|
| `mode` | `GameMode` | omitted | optional filter |
| `difficulty` | `GameDifficulty` | omitted | optional filter |
| `page` | integer | `1` | 1-based |
| `limit` | integer | `20` | max `100` |

**Behavior:** returns completed games only, ordered by `completedAt` descending.

**Success:** `200 OK`.

```json
{
  "items": [ { "…": "CompletedGameSummaryDto" } ],
  "page": 1,
  "limit": 20,
  "total": 137
}
```

**Errors:** `400 VALIDATION_ERROR`.

#### 7.1.2 Get completed game details

```http
GET /api/history/:gameId
```

**Auth:** none.

**Path parameters:** `gameId` (UUID).

**Behavior:** returns detail for a completed game only.

**Success:** `200 OK` with `CompletedGameDetailDto`.

**Errors:**

- `400 VALIDATION_ERROR`;
- `404 NOT_FOUND` — the game does not exist or is not `COMPLETED` (in-progress games are never exposed).

### 7.2 Leaderboards

Two endpoints, one per mode, each filtered by `difficulty`. Rankings are derived from completed `Game` records; there is no `Leaderboard` table.

```http
GET /api/leaderboards/click
GET /api/leaderboards/time
```

**Auth:** none.

**Query parameters:**

| Param | Type | Default | Notes |
|---|---|---|---|
| `difficulty` | `GameDifficulty` | **required** | EASY \| MEDIUM \| HARD |
| `limit` | integer | `10` | max `100` |

**Ordering:**

- `click` → `clickCount ASC`, tie-break `effectivePlayTimeMs ASC`;
- `time` → `effectivePlayTimeMs ASC`, tie-break `clickCount ASC`.

Only `COMPLETED` games participate. Rankings are per difficulty.

**Success:** `200 OK`.

```json
{
  "mode": "CLICK",
  "difficulty": "EASY",
  "items": [
    {
      "rank": 1,
      "gameId": "…",
      "username": "marco",
      "clickCount": 8,
      "effectivePlayTimeMs": 300000,
      "completedAt": "2026-08-28T10:20:00.000Z"
    }
  ]
}
```

**Errors:** `400 VALIDATION_ERROR` (including a missing/invalid `difficulty`).

---

## 8. Profile / Statistics

### 8.1 Profile

Reuses the current-user endpoint `GET /api/auth/me` (§4.4). Returns `UserProfileDto`.

### 8.2 Personal statistics

```http
GET /api/me/stats
```

**Auth:** required.

**Success:** `200 OK` with `StatisticsDto`.

**Errors:** `401 AUTHENTICATION_REQUIRED`.

---

## 9. Cross-cutting behavior

### 9.1 Ownership

Ownership of a `Game` is always derived from the authenticated identity, never from a request field. Requests for games that do not exist or that the caller does not own return `404 GAME_NOT_FOUND` (never `403`).

### 9.2 Optimistic concurrency

`move`, `backtrack`, and `delete` carry the client's expected `version`. A mismatch returns `409 STALE_VERSION` and never overwrites newer state. Clients reload authoritative state (`GET /api/games/:gameId`) to recover.

### 9.3 Session expiration during gameplay

If a gameplay request (`move` or `backtrack`) finds that the game's `ACTIVE` session has exceeded the heartbeat timeout, the backend:

1. finalizes the expired session, using `lastHeartbeatAt` (not the detection moment) as the effective end for time accounting;
2. updates `Game.effectivePlayTimeMs` and increments `Game.version` (this mutation is applied even though the gameplay action itself is rejected);
3. rejects the gameplay action with `409 NO_ACTIVE_SESSION`.

The client then re-fetches authoritative state and starts a fresh session (`POST /api/games/:gameId/session`) before retrying the action. This keeps effective play time fair (technical detection delay is not counted) and is enforced server-side.

### 9.4 Completion

Victory is decided server-side when a `NAVIGATION` reaches the configured target page id (`Università degli Studi di Napoli Federico II`). Completion sets `COMPLETED`, `completedAt`, ends any `ACTIVE` session, and finalizes `effectivePlayTimeMs`. The frontend cannot mark a game completed directly. Once completed, the game becomes eligible for public history and leaderboards, and further moves/backtracks are rejected with `409 GAME_NOT_IN_PROGRESS`.

---

## 10. Consistency checklist

This contract has been checked against the approved documents:

- **Game rules** — two statuses only; 10-game limit; CLICK/TIME modes; EASY/MEDIUM/HARD backtracking rules; navigation only through validated internal links; backtracking does not increment clicks; effective time excludes downtime; one active session; server-side victory; completed games only in public surfaces.
- **Database** — endpoints map 1:1 onto `User`, `Game`, `GameMove`, `GameSession` and the five enums; no `Leaderboard`, `UserStatistics`, or `WikipediaPage` tables are assumed; leaderboards/statistics are derived from `Game` records; `passwordHash` is never exposed; `version` starts at `0`.
- **Architecture** — Express authoritative; Angular requests actions; ownership from authentication; no client-authoritative game state; MediaWiki navigation controlled by ROADTOUNINA; heartbeat-based sessions; no iframe navigation.
- **Milestone 3 error shape** — all errors use `{ error: { code, message, details? } }`; existing codes are preserved and extended, not changed.

This contract defines the interface for Milestones 5–15 without implementing any of them.

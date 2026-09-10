# ROADTOUNINA — API Contract

## 1. Purpose

This document defines the REST contract for the entire initial application. It is the source of truth for the frontend/backend interface and is implemented progressively by Milestones 5–15.

The contract is consistent with:

- `docs/architecture.md` — Express backend is authoritative; Angular requests actions only;
- `docs/game-rules.md` — game rules, difficulty, effective play time, leaderboards;
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
    "message": "toTitle must be a valid Wikipedia article title (maximum 255 UTF-8 bytes)"
  }
}
```

- `code` — machine-readable error code (see §2.6);
- `message` — human-readable summary. For a `VALIDATION_ERROR` it names the field or rule that failed.

HTTP inputs (body, query, route params) are validated explicitly at the backend
boundary with small per-module TypeScript parsing functions (`*.validation.ts`).
A failed check produces the `VALIDATION_ERROR` shape above; domain rules stay in
the services and produce their own codes (§2.6).

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
| 409 | `GAME_LIMIT_REACHED` | User already has 10 `IN_PROGRESS` games. |
| 409 | `GAME_NOT_IN_PROGRESS` | Operation requires an `IN_PROGRESS` game (e.g. a move/backtrack/heartbeat/delete on a completed game). |
| 422 | `INVALID_MOVE` | Requested target page is not a valid playable link from the current page. |
| 422 | `BACKTRACK_NOT_ALLOWED` | Backtracking is forbidden for `HARD` difficulty, or is impossible because the active path is already at the starting page. |
| 422 | `BACKTRACK_LIMIT_REACHED` | `MEDIUM` backtracking limit (3) has been reached. |
| 500 | `INTERNAL_ERROR` | Unexpected server error (details are never exposed). |
| 502 | `WIKIPEDIA_UNAVAILABLE` | An upstream MediaWiki request failed or returned an unusable response; the action can be retried. |
| 503 | `NO_STARTING_PAGE` | No suitable random starting page could be found after the bounded number of attempts; game creation can be retried. |

Rules:

- `FORBIDDEN` MUST NOT be used to distinguish ownership of `Game` resources. A game that does not exist or is not owned by the caller is always reported as `404 GAME_NOT_FOUND`.
- `409 Conflict` is reserved for state conflicts (duplicates, limits, non-`IN_PROGRESS` status).
- `422 Unprocessable Entity` is reserved for syntactically valid requests that violate a game rule (invalid move, backtracking rules).
- `502`/`503` are reserved for upstream MediaWiki failures (`WIKIPEDIA_UNAVAILABLE`, `NO_STARTING_PAGE`); they indicate a transient dependency problem, not a client error or an internal bug, and the request may be retried.

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

Request bodies/query parameters use the same uppercase strings. Validation is case-sensitive.

### 2.9 Date/time serialization

All timestamps are ISO 8601 strings in UTC, with millisecond precision, e.g.:

```text
2026-08-28T10:15:30.000Z
```

### 2.10 ID representation

- Database primary keys (`User.id`, `Game.id`, `GameMove.id`) are **UUID strings**.
- MediaWiki page identifiers (`startPageId`, `currentPageId`, `fromPageId`, `toPageId`, and any `pageId`) are **integers** (MediaWiki `pageid`).

Navigation requests supply a normalized Wikipedia article title (`toTitle`), never a URL or an authoritative page ID. The backend verifies that the clicked title is a playable link from the current article, then resolves that selected title to its canonical page ID. Game state, paths and persisted moves retain canonical page IDs.

### 2.11 Concurrency

There is no optimistic-concurrency `version` field. `move`, `backtrack`, `delete`
and `heartbeat` carry no version or session id — the backend authorizes each
request from the authenticated identity and the game's current persisted state
(ownership, `IN_PROGRESS`, valid link, difficulty rules). Simultaneous multi-tab /
multi-device editing is not a project requirement; ordinary database transactions
protect integrity for the single-player flow.

### 2.12 Authority rules

The frontend MUST NOT send authoritative values. In particular the backend never accepts from the client:

- `clickCount`;
- `backtrackCount`;
- `effectivePlayTimeMs`, `playStartedAt`, `lastHeartbeatAt`;
- `status` (game completion);
- `currentPageId` / `currentPageTitle` (current page);
- score or ranking values;
- `userId` for ownership.

The frontend sends **requested actions** (e.g. "follow the link titled `Informatica`", "backtrack", "heartbeat") and the backend validates and applies them. Victory, counters, timing, and completion are always decided server-side.

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
  "startedAt": "2026-08-28T10:00:00.000Z",
  "completedAt": null
}
```

`effectivePlayTimeMs` on a list item is the finalized total so far; it does not
include time in a currently-open interval.

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
  "playStartedAt": "2026-08-28T10:05:00.000Z",
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
  ]
}
```

`path` is the reconstructed active path (start page → current page). `moves` is
the complete chronological event history.

`effectivePlayTimeMs` is the finalized total. For an `IN_PROGRESS` game,
`playStartedAt` is the start of the interval currently being timed (the backend
sets it when the game is opened — see §5.3); the client animates
`effectivePlayTimeMs + (now - baseline)` locally for display. For a `COMPLETED`
game `effectivePlayTimeMs` is final and `playStartedAt` is `null`. The internal
`lastHeartbeatAt` bookkeeping field is not exposed.

### 3.7 ArticleDto

The current article representation for the active game.

```json
{
  "gameId": "…",
  "pageId": 200,
  "title": "…",
  "contentHtml": "<p>sanitized content…</p>",
  "links": [{ "title": "Informatica" }, { "title": "Unina" }]
}
```

- `contentHtml` is normalized and sanitized HTML; external/non-playable links are removed.
- `links` lists unique playable source titles extracted from the HTML that survives sanitization. It does not contain IDs or eagerly resolved redirect destinations.
- Playable anchors are `<a data-page-title="Informatica">…</a>` with no `href`. Angular intercepts them and sends the title as `toTitle`.
- A redirect link retains its clicked title (e.g. `Unina`) until the backend resolves it during a move. Links that become missing or resolve outside the main namespace are rejected at that point.
- The client checks `pageId` against the game's `currentPageId` and reloads if they disagree.

### 3.8 CompletedGameSummaryDto

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

### 3.9 CompletedGameDetailDto

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

### 3.10 LeaderboardEntryDto

Ranking entry. Both metrics are always present; ordering differs by leaderboard (§6.2).

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

### 3.11 StatisticsDto

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

This endpoint is also the "profile" endpoint used by the Profile/Statistics surface (§7.1).

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

**Behavior:** the backend selects a random eligible starting page (MediaWiki), sets status `IN_PROGRESS`, counters and `effectivePlayTimeMs` to `0`, `playStartedAt` / `lastHeartbeatAt` to `null`, and persists the game. Only `mode` and `difficulty` come from the client.

**Success:** `201 Created` with `GameDto`.

**Errors:**

- `400 VALIDATION_ERROR`;
- `401 AUTHENTICATION_REQUIRED`;
- `409 GAME_LIMIT_REACHED` — user already has 10 `IN_PROGRESS` games;
- `503 NO_STARTING_PAGE` — no suitable starting page was found; retry.

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

**Behavior:** returns the full resume payload (`path`, `moves`, timing fields).
For an `IN_PROGRESS` game owned by the caller this is also the **resume flow**:
the backend finalizes any pending play interval up to its last heartbeat and
starts a fresh interval (`playStartedAt = lastHeartbeatAt = now`), so the returned
`effectivePlayTimeMs` / `playStartedAt` are current. A `COMPLETED` game is
returned unchanged. There is no separate "start session" request.

**Success:** `200 OK` with `GameDto`.

**Errors:**

- `400 VALIDATION_ERROR` — invalid `gameId`;
- `401 AUTHENTICATION_REQUIRED`;
- `404 GAME_NOT_FOUND` — not found or not owned.

### 5.4 Delete owned IN_PROGRESS game

```http
DELETE /api/games/:gameId
```

**Auth:** required.

**Path parameters:** `gameId` (UUID).

**Body:** none. **Query parameters:** none.

**Behavior:** only the owner may delete, and only when status is `IN_PROGRESS`. Moves cascade. Completed games are never deletable.

**Success:** `204 No Content`.

**Errors:**

- `400 VALIDATION_ERROR`;
- `401 AUTHENTICATION_REQUIRED`;
- `404 GAME_NOT_FOUND`;
- `409 GAME_NOT_IN_PROGRESS` — game is `COMPLETED`.

### 5.5 Get current article

```http
GET /api/games/:gameId/article
```

**Auth:** required.

**Path parameters:** `gameId` (UUID).

**Behavior:** returns the sanitized, sandboxed representation of the game's current Wikipedia article plus its playable internal links. This does not change navigation state or counters.

**Success:** `200 OK` with `ArticleDto`.

**Errors:**

- `400 VALIDATION_ERROR`;
- `401 AUTHENTICATION_REQUIRED`;
- `404 GAME_NOT_FOUND`;
- `502 WIKIPEDIA_UNAVAILABLE` — the upstream MediaWiki fetch failed; retry.

### 5.6 Navigation move

```http
POST /api/games/:gameId/moves
```

**Auth:** required.

**Path parameters:** `gameId` (UUID).

**Body:**

```json
{
  "toTitle": "Informatica"
}
```

| Field     | Type   | Constraints                                                           |
| --------- | ------ | --------------------------------------------------------------------- |
| `toTitle` | string | required; normalized Wikipedia article title; maximum 255 UTF-8 bytes |

Titles use Unicode NFC, spaces instead of underscores, trimmed/collapsed spaces and Italian Wikipedia's first-letter capitalization; the remaining letters are case-sensitive. The parser decodes URL escapes once when extracting HTML links. The request contains a title, so the REST boundary does not URL-decode it. Empty titles, control characters, `|#<>[]{}` and oversized titles are validation errors. Unknown fields, including `toPageId` and `version`, are rejected.

**Behavior:** the backend verifies ownership and `IN_PROGRESS` status, then checks the normalized `toTitle` against the playable source titles of the current sanitized article. A forged title returns `INVALID_MOVE` before any target resolution, even if it is the canonical destination of a different, reachable redirect. Only a reachable clicked title is resolved through MediaWiki's normalization/redirect mappings; missing or non-main-namespace destinations return `INVALID_MOVE`. In one transaction the backend stores a `NAVIGATION` `GameMove` using the resolved canonical ID/title, increments `clickCount`, updates the current page, refreshes `lastHeartbeatAt` (the move is proof of activity), and checks the canonical ID for victory — on victory it also finalizes `effectivePlayTimeMs` and clears the timing fields. Backtracking does not count here.

**Success:** `200 OK` with the updated `GameDto` (when the target is reached, `status: COMPLETED`, `completedAt` set, `playStartedAt: null`).

**Errors:**

- `400 VALIDATION_ERROR`;
- `401 AUTHENTICATION_REQUIRED`;
- `404 GAME_NOT_FOUND`;
- `409 GAME_NOT_IN_PROGRESS` — game already completed;
- `422 INVALID_MOVE` — target not a valid playable link from the current page;
- `502 WIKIPEDIA_UNAVAILABLE` — the upstream MediaWiki link resolution failed; retry.

### 5.7 Backtrack

```http
POST /api/games/:gameId/backtrack
```

**Auth:** required.

**Path parameters:** `gameId` (UUID).

**Body:** none (`{}` or empty).

**Behavior:** a dedicated action separate from navigation. In one transaction the backend stores a `BACKTRACK` `GameMove`, moves the active path one step back, increments `backtrackCount`, and refreshes `lastHeartbeatAt`. It does **not** increment `clickCount`. When the active path contains only the starting page there is no previous page to return to, so backtracking is rejected with `BACKTRACK_NOT_ALLOWED`.

Difficulty enforcement:

- `EASY` — unlimited;
- `MEDIUM` — at most 3 (rejects the 4th);
- `HARD` — rejected.

**Success:** `200 OK` with the updated `GameDto`.

**Errors:**

- `400 VALIDATION_ERROR`;
- `401 AUTHENTICATION_REQUIRED`;
- `404 GAME_NOT_FOUND`;
- `409 GAME_NOT_IN_PROGRESS`;
- `422 BACKTRACK_NOT_ALLOWED` — `HARD` difficulty, or the active path is already at the starting page;
- `422 BACKTRACK_LIMIT_REACHED` — `MEDIUM` already used 3 backtracks.

### 5.8 Heartbeat

```http
POST /api/games/:gameId/heartbeat
```

**Auth:** required.

**Path parameters:** `gameId` (UUID).

**Body:** none (`{}` or empty).

**Behavior:** the only timing-specific endpoint. It records that the owner is
still actively playing by setting `lastHeartbeatAt = now` on the game (and
`playStartedAt = now` if none is set). It is **not a session**: nothing is
created, no other field changes, and it carries no session id or version. The
frontend sends it roughly every 12 s while the game page is open. A stale
`lastHeartbeatAt` triggers no state transition — it only bounds the play interval
the next time the game is opened (§5.3).

**Success:** `204 No Content`.

**Errors:**

- `400 VALIDATION_ERROR`;
- `401 AUTHENTICATION_REQUIRED`;
- `404 GAME_NOT_FOUND`;
- `409 GAME_NOT_IN_PROGRESS` — the game is `COMPLETED`; its `effectivePlayTimeMs` is already final.

---

## 6. Public History & Leaderboards

These endpoints are public (no auth). They expose only `COMPLETED` games. `IN_PROGRESS` games can never appear.

### 6.1 Public history

#### 6.1.1 List completed games

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

#### 6.1.2 Get completed game details

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

### 6.2 Leaderboards

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

When entries are still tied after the mode's tie-break, the order is fully
determined by `completedAt ASC`, then `gameId ASC` (the earlier achiever ranks
higher). `rank` is the 1-based position in the returned list; tied entries
receive consecutive distinct ranks, not a shared rank.

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

## 7. Profile / Statistics

### 7.1 Profile

Reuses the current-user endpoint `GET /api/auth/me` (§4.4). Returns `UserProfileDto`.

### 7.2 Personal statistics

```http
GET /api/me/stats
```

**Auth:** required.

**Success:** `200 OK` with `StatisticsDto`.

**Errors:** `401 AUTHENTICATION_REQUIRED`.

---

## 8. Cross-cutting behavior

### 8.1 Ownership

Ownership of a `Game` is always derived from the authenticated identity, never from a request field. Requests for games that do not exist or that the caller does not own return `404 GAME_NOT_FOUND` (never `403`).

### 8.2 Concurrency

There is no `version` field and no session id on any request. `move`, `backtrack`
and `delete` are authorized from the authenticated identity plus the game's
current persisted state. Ordinary transactions keep integrity; a rare race for
the next move-sequence number is resolved by recomputing and retrying once.
Simultaneous multi-tab / multi-device editing is not specially coordinated.

### 8.3 Effective play time

Server-authoritative, tracked with `Game.effectivePlayTimeMs`, `Game.playStartedAt`
and `Game.lastHeartbeatAt` (see `docs/game-rules.md` §12 and `docs/database.md`
§7). Opening an in-progress game (`GET /api/games/:id`) finalizes any pending
interval up to its last heartbeat and starts a new one; the heartbeat
(`POST /api/games/:id/heartbeat`) and every valid move/backtrack refresh
`lastHeartbeatAt`; the winning move finalizes the last interval. Time after a
browser disappears is never counted — there is no expiration process.

### 8.4 Completion

Victory is decided server-side when a `NAVIGATION` reaches the configured target page id (`Università degli Studi di Napoli Federico II`). In one transaction completion sets `COMPLETED`, `completedAt`, folds the final interval into `effectivePlayTimeMs`, and clears `playStartedAt` / `lastHeartbeatAt`. The frontend cannot mark a game completed directly. Once completed, the game becomes eligible for public history and leaderboards, and further moves/backtracks/heartbeats are rejected with `409 GAME_NOT_IN_PROGRESS`.

---

## 9. Consistency checklist

This contract has been checked against the approved documents:

- **Game rules** — two statuses only; 10-game limit; CLICK/TIME modes; EASY/MEDIUM/HARD backtracking rules; navigation only through validated internal links; backtracking does not increment clicks; effective time excludes idle/offline time; server-side victory; completed games only in public surfaces.
- **Database** — endpoints map 1:1 onto `User`, `Game`, `GameMove` and their enums; effective play time is three fields on `Game`, not a table; no `Leaderboard`, `UserStatistics`, or `WikipediaPage` tables are assumed; leaderboards/statistics are derived from `Game` records; `passwordHash` is never exposed; there is no `version` field.
- **Architecture** — Express authoritative; Angular requests actions; ownership from authentication; no client-authoritative game state; MediaWiki navigation controlled by ROADTOUNINA; a minimal heartbeat updates timing only; no iframe navigation.
- **Milestone 3 error shape** — all errors use `{ error: { code, message } }`.

This contract defines the interface for Milestones 5–15 without implementing any of them.

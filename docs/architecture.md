# ROADTOUNINA — Architecture

## 1. Architectural Style

ROADTOUNINA uses a **modular monolith**.

Do not introduce microservices.

The application consists of:

- Angular single-page application;
- Node.js + Express REST backend written in TypeScript;
- PostgreSQL hosted on Supabase;
- Prisma ORM;
- MediaWiki API as the external article source.

The frontend and backend live in separate repository directories.

---

## 2. Repository Structure

Target high-level layout:

```text
roadtounina/
├── frontend/
├── backend/
├── docs/
│   ├── game-rules.md
│   ├── architecture.md
│   ├── database.md
│   ├── api.md
│   └── milestones.md
├── AGENTS.md
├── README.md
└── .gitignore
```

Do not convert the repository to microservices or introduce additional application repositories.

---

## 3. Technology Stack

### Frontend

- Angular
- TypeScript
- Angular Router
- Angular HttpClient
- Reactive Forms
- CSS
- standalone Angular architecture where appropriate

Do not introduce NgRx unless a concrete requirement appears later.

Do not introduce a third-party UI framework unless explicitly approved.

### Backend

- Node.js
- Express
- TypeScript
- Prisma ORM
- PostgreSQL

### Database Hosting

- Supabase PostgreSQL

Supabase is used primarily as managed PostgreSQL infrastructure.

Authentication is implemented in the ROADTOUNINA backend unless this architecture document is explicitly changed later.

Do not silently replace custom backend authentication with Supabase Auth.

### External API

- MediaWiki API for Italian Wikipedia

### Testing

Planned stack:

- backend unit/integration testing with a suitable TypeScript test runner;
- Angular tests where useful;
- Playwright for end-to-end testing.

The final project must contain at least ten automated E2E tests.

The Playwright suite (`e2e/`) is 10 browser-driven scenarios that run against the
real Angular and Express apps, but against a disposable Dockerised PostgreSQL and
a deterministic in-memory MediaWiki adapter (`E2E_FAKE_WIKIPEDIA=1`, selected
only in `backend/src/server.ts`). Server-authoritative rule edges (forged move,
backtrack limits, game limit) and effective-time behaviour keep their dedicated
coverage in the backend integration/unit tests.

---

## 4. Responsibility Boundaries

### Angular

Responsible for:

- presentation;
- routing;
- forms;
- user interaction;
- rendering game state;
- rendering Wikipedia-like article content;
- sending game action requests;
- displaying timers and scores;
- handling loading/error states.

Angular is **not authoritative** for game state.

### Express Backend

Responsible for:

- authentication and authorization;
- game rules;
- game state transitions;
- move validation;
- official effective-play-time accounting;
- difficulty enforcement;
- starting-page selection;
- Wikipedia integration;
- ranked History queries and completed-game details;
- persistence.

### PostgreSQL

Responsible for persistent authoritative state:

- users;
- games (including their `effectivePlayTimeMs` / `playStartedAt` / `lastHeartbeatAt` timing fields);
- moves.

Important invariants should be protected by database constraints when reasonably possible.

### MediaWiki

Responsible only for external encyclopedia data:

- article metadata;
- article content;
- links;
- random-page candidates.

MediaWiki must never be treated as the authoritative ROADTOUNINA game state store.

---

## 5. Backend Module Structure

Express does not provide modules like NestJS, but the codebase must still be organized by domain.

Recommended target structure:

```text
backend/src/
├── app.ts
├── server.ts
├── config/
├── lib/
│   └── prisma.ts
├── middleware/
│   ├── auth.middleware.ts
│   └── error.middleware.ts
├── modules/
│   ├── auth/
│   ├── users/
│   ├── games/
│   ├── wikipedia/
│   └── history/
└── shared/
```

Each domain may contain, where needed:

```text
feature/
├── feature.routes.ts
├── feature.controller.ts
├── feature.service.ts
├── feature.repository.ts
├── feature.validation.ts
└── feature.types.ts
```

Do not create every file mechanically if it provides no value. Keep responsibilities separated without over-engineering.

`feature.validation.ts` holds small, explicit `parse*` functions that check an
endpoint's untrusted body / query / route params and return typed values. They
are called at the top of the controller handler; a failed check throws a
`VALIDATION_ERROR` (`shared/validation.ts`). Shared low-level helpers
(`asObject`, `isUuid`, positive-integer query parsing) live in
`shared/validation.ts`. There is no generic validation middleware or schema DSL.

---

## 6. Express Layers

Use the following conceptual flow:

```text
HTTP Request
    ↓
Route
    ↓
Auth middleware (where required)
    ↓
Controller (validates input at the boundary)
    ↓
Service / domain logic
    ↓
Repository / Prisma
    ↓
PostgreSQL
```

Controllers should be thin.

Controllers should not contain complex game rules.

Prisma queries should not be scattered throughout route handlers.

---

## 7. Game Engine

The core game logic should be isolated in a dedicated service/domain component inside the games module.

Conceptual responsibilities:

- create game;
- validate move;
- perform navigation;
- perform backtracking;
- apply difficulty rules;
- increment counters;
- split effective timing around successful article transitions;
- detect victory;
- complete game (finalizing effective play time).

Example conceptual flow:

```text
POST /games/:id/moves
        ↓
games controller
        ↓
game service / game engine
        ↓
load authoritative game
        ↓
validate ownership
        ↓
validate IN_PROGRESS
        ↓
WikipediaService validates target link
        ↓
database transaction
        ↓
store GameMove
update Game (counter, current page, split timing interval)
check victory → on victory, finalize effectivePlayTimeMs
```

All state-changing game operations should be transactional where multiple database records or counters must remain consistent.

---

## 8. Wikipedia Integration

Wikipedia integration must be isolated behind a service abstraction.

Recommended conceptual structure:

```text
wikipedia/
├── wikipedia.service.ts
├── mediawiki.client.ts
├── article-parser.service.ts
└── wikipedia.types.ts
```

### MediaWiki Client

Responsible for HTTP communication with the MediaWiki API.

It should not contain ROADTOUNINA game rules.

### Wikipedia Service

Provides application-friendly operations such as:

- `getArticle(pageId)`
- `getRandomStartingPage()`
- `resolveNavigation(fromPageId, toTitle)` → canonical identity or no valid move

Exact method names are implementation details.

An uncached article uses two bounded MediaWiki requests: `query&prop=info`
(namespace, identity, size) and `parse&prop=text` (HTML). Playable titles come
from the sanitized HTML; no link generator, exhaustive continuation or bulk
title/redirect resolution is used. Only the clicked, reachable title is resolved
to a canonical page ID when a move occurs. Persistence and victory retain IDs.

One in-memory article cache (32 entries, 60-second TTL, LRU eviction) shares
in-flight requests and is reused by starting-page selection, rendering and move
validation. Failed loads are removed. Cache misses remain correct: a move uses
three requests when cold, one when the source article is cached. The subsequent
destination article load is a separate operation. No graph is prefetched.

Random selection examines one main-namespace, non-redirect candidate at a time,
up to 10 candidates. It checks the existing size/link thresholds and excludes
the target; an accepted first candidate uses three requests and its article is
cached for rendering. HTTP 429 gets at most two retries with 1/2-second backoff
and Retry-After support. If Retry-After exceeds the 10-second wait budget, the
operation fails without an early retry. No outer retry layer multiplies these
attempts.

### Article Parser / Normalizer

Responsible for transforming external article data into safe application data.

It should:

- sanitize content;
- identify valid internal article links;
- exclude external links;
- exclude citations/notes where appropriate;
- exclude category/special/help/edit/history/language navigation;
- rewrite/annotate playable links so Angular handles them as game actions.

---

## 9. Wikipedia Sandboxing

Do not use an iframe as the primary game architecture.

Do not let article links directly navigate the browser to arbitrary Wikipedia/external URLs.

The intended data flow is:

```text
MediaWiki API
      ↓
Express backend
      ↓
normalization + sanitization
      ↓
ROADTOUNINA API response
      ↓
Angular article renderer
```

When the user clicks a playable link:

```text
Angular
  ↓
POST game action
  ↓
Express validates move
  ↓
authoritative state updated
  ↓
Angular renders new state/article
```

---

## 10. Frontend Feature Architecture

Recommended feature-oriented structure:

```text
frontend/src/app/
├── core/
│   ├── auth/
│   ├── guards/
│   ├── interceptors/
│   └── services/
├── shared/
│   ├── components/
│   ├── models/
│   └── pipes/
├── features/
│   ├── home/
│   ├── auth/
│   ├── dashboard/
│   ├── game/
│   ├── history/
│   └── profile/
└── app.routes.ts
```

Do not create a single global `components/` directory containing unrelated application components.

---

## 11. Game Frontend

The game page should provide a Wikipedia-like reading/navigation experience while displaying a game HUD.

Conceptual component tree:

```text
GamePage
├── GameHud
├── WikipediaArticle
├── GamePath
└── GameResult (when completed)
```

### GameHud

Displays:

- mode;
- difficulty;
- effective-time timer;
- click count;
- remaining/used backtracking information.

During a server-owned article transition Angular freezes the display-only timer,
suppresses its normal heartbeat, and prevents another action. The successful
response supplies both authoritative game state and the prepared article; the
client reseeds its visual baseline and resumes normal play without sending any
pause/resume command.

### WikipediaArticle

Renders sanitized article content with a Wikipedia-like experience.

Playable links must trigger Angular game actions rather than normal navigation.

### GamePath

Displays the active navigation path.

The full historical event list may be available in game details but does not need to dominate the main game UI.

---

## 12. Authentication Architecture

Authentication belongs to the Express backend.

Initial expected capabilities:

- registration;
- login;
- authenticated user endpoint;
- logout / token lifecycle as defined during the API milestone;
- password hashing;
- authorization middleware.
- authenticated username, email and password changes;
- transactional soft account deletion with anonymized retained completed History.

Do not store plaintext passwords.

Do not trust user identifiers supplied by the frontend for resource ownership.

Ownership comes from the authenticated identity.

Authentication middleware also verifies that the JWT subject still belongs to
an active (`deletedAt IS NULL`) User. This makes outstanding JWT cookies unusable
after soft account deletion without adding a session or token-revocation table.

---

## 13. Effective Play Time

There is **no persistent play-session entity**. Effective play time is
server-authoritative and stored in three fields on `Game`:
`effectivePlayTimeMs` (finalized total), `playStartedAt` (start of the current
unfinalized interval), and `lastHeartbeatAt` (most recent proof of activity).

- Opening/resuming an in-progress game (`GET /api/games/:id`) prepares the
  current article, then finalizes any pending interval up to its last heartbeat
  (capped at the preparation-start boundary) and starts a fresh one. The short
  timing reconciliation and heartbeats use the same transaction-local row lock;
  its restart is the transaction's final database write, so article loading and
  avoidable response-state query work are not playable time.
- Angular sends a minimal heartbeat (`POST /api/games/:id/heartbeat`, ~every
  12 s while playable) that only sets `lastHeartbeatAt = now`.
- A successful move/backtrack finalizes time at a request timestamp captured by
  the games router before asynchronous authentication, prepares the destination
  article, then atomically starts a fresh interval with the transaction's final
  database write.
  The move response includes that article, avoiding another normal fetch.
- The winning move finalizes at its navigation-start boundary inside the
  completion transaction and starts no new interval.
- A stale `lastHeartbeatAt` causes no state transition: there is no expiration
  job. Time after a browser disappears is simply not counted at the next open.

Angular animates the displayed timer locally and is never authoritative. Details
in `docs/game-rules.md` §12.

---

## 14. Concurrency

There is no `Game.version` field, optimistic-concurrency token, session token,
or persistent lock/lease. Simultaneous multi-tab / multi-device editing is not
a project requirement.

State-changing game operations run in a database transaction where multiple
records or counters must stay consistent (a navigation move updates the `Game`
row and appends a `GameMove`; completion also finalizes timing). After external
article preparation, a short PostgreSQL row lock verifies that the source page,
counters and timing interval still match the prepared operation. A stale move or
backtrack is rejected with `GAME_STATE_CHANGED`.

---

## 15. Public API Surface

Public capabilities include:

- ranked, paginated completed-game History with CLICK and TIME views;
- completed-game details opened from History;
- landing/how-to-play content.

Authenticated capabilities include:

- creating games;
- listing own in-progress games;
- loading own game state (which also resumes effective-time tracking);
- deleting own in-progress games;
- moving;
- backtracking;
- sending a keep-alive heartbeat;
- personal profile/statistics.

Exact endpoints belong in `docs/api.md`.

---

## 16. Database Authority

History rankings and statistics should initially be calculated from `Game` records.

Do not create separate authoritative ranking or `UserStatistics` tables unless profiling later proves they are needed.

Do not persist complete Wikipedia HTML/articles in PostgreSQL in the initial version.

Store only the Wikipedia identifiers/titles required for persistent game history.

---

## 17. Non-Goals for Initial Architecture

Do not add without explicit approval:

- microservices;
- Redis;
- WebSockets;
- GraphQL;
- Kafka or other message queues;
- Kubernetes;
- event sourcing;
- NgRx;
- Supabase Auth replacing backend auth;
- third-party UI framework;
- full Wikipedia graph crawling.

A normal HTTP heartbeat is sufficient initially.

---

## 18. Core Architectural Principle

The central rule of the architecture is:

> **Angular requests actions. Express decides whether they are valid. PostgreSQL stores the authoritative state. MediaWiki supplies external encyclopedia content.**

Any implementation that makes the frontend authoritative over game state violates the approved architecture.

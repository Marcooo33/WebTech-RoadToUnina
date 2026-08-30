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
- SCSS
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

The Playwright suite (`e2e/`) runs the browser against the real Angular and
Express apps, but against a disposable Dockerised PostgreSQL and a deterministic
in-memory MediaWiki adapter (`E2E_FAKE_WIKIPEDIA=1`, selected only in
`backend/src/server.ts`). The live MediaWiki adapter keeps its own dedicated
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
- session management;
- official timer calculations;
- difficulty enforcement;
- starting-page selection;
- Wikipedia integration;
- leaderboard queries;
- history queries;
- persistence.

### PostgreSQL

Responsible for persistent authoritative state:

- users;
- games;
- moves;
- play sessions.

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
│   ├── error.middleware.ts
│   └── validation.middleware.ts
├── modules/
│   ├── auth/
│   ├── users/
│   ├── games/
│   ├── game-sessions/
│   ├── wikipedia/
│   └── leaderboards/
└── shared/
```

Each domain may contain, where needed:

```text
feature/
├── feature.routes.ts
├── feature.controller.ts
├── feature.service.ts
├── feature.repository.ts
├── feature.schema.ts
└── feature.types.ts
```

Do not create every file mechanically if it provides no value. Keep responsibilities separated without over-engineering.

---

## 6. Express Layers

Use the following conceptual flow:

```text
HTTP Request
    ↓
Route
    ↓
Middleware / validation
    ↓
Controller
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
- verify current version;
- increment counters;
- detect victory;
- complete game;
- coordinate game session state where needed.

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
validate active session
        ↓
validate game version
        ↓
WikipediaService validates target link
        ↓
database transaction
        ↓
store GameMove
update Game
check victory
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
- `getValidInternalLinks(pageId)`
- `getRandomStartingPage()`
- `isValidNavigation(fromPageId, targetPageId)`

Exact method names are implementation details.

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
│   ├── leaderboard/
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

Do not store plaintext passwords.

Do not trust user identifiers supplied by the frontend for resource ownership.

Ownership comes from the authenticated identity.

---

## 13. Game Session Architecture

A game may have only one active play session.

Sessions are persistent database records.

The backend uses heartbeats to distinguish an active player from a browser that has closed or crashed.

Angular periodically sends a heartbeat while actively playing.

The backend handles:

- session creation/resume;
- heartbeat updates;
- explicit session end where possible;
- session expiration;
- official effective play-time calculation.

A browser `beforeunload` event must not be the sole mechanism for ending sessions because delivery is not reliable.

---

## 14. Concurrency

Each `Game` has a numeric `version`.

State-changing requests should include the version the client believes is current.

The backend validates that version before applying a mutation.

After a successful mutation, the version increments.

Stale mutations should produce an HTTP conflict response (expected: `409 Conflict`).

The database operation must remain atomic.

---

## 15. Public API Surface

Public capabilities include:

- completed-game history;
- completed-game details;
- leaderboards;
- landing/how-to-play content.

Authenticated capabilities include:

- creating games;
- listing own in-progress games;
- loading own game state;
- deleting own in-progress games;
- starting/resuming play sessions;
- moving;
- backtracking;
- personal profile/statistics.

Exact endpoints belong in `docs/api.md`.

---

## 16. Database Authority

Leaderboard and statistics data should initially be calculated from `Game` records.

Do not create separate authoritative `Leaderboard` or `UserStatistics` tables unless profiling later proves they are needed.

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

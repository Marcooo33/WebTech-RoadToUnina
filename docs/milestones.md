# ROADTOUNINA — Development Milestones

## Purpose

This document defines the implementation order for ROADTOUNINA.

The coding agent must implement **one milestone at a time** and stop after completing and validating the requested scope.

Before working on any milestone, always read:

- `AGENTS.md`
- `docs/architecture.md`

Also read:

- `docs/game-rules.md` for game-related work
- `docs/database.md` for database-related work
- `docs/api.md` once API contracts are defined

Do not skip ahead.

---

# Milestone 0 — Repository Bootstrap

## Goal

Create a clean full-stack repository skeleton without application business logic.

## Scope

Create:

```text
roadtounina/
├── frontend/
├── backend/
├── docs/
├── AGENTS.md
├── README.md
└── .gitignore
```

### Frontend

Initialize:

- Angular
- TypeScript
- routing
- SCSS
- current recommended standalone Angular architecture

Do not implement application pages yet.

### Backend

Initialize:

- Node.js
- Express
- TypeScript
- Prisma
- npm
- minimal environment configuration

Recommended initial backend structure:

```text
backend/
├── src/
│   ├── app.ts
│   └── server.ts
├── prisma/
│   └── schema.prisma
├── .env.example
├── package.json
├── tsconfig.json
└── prisma.config.ts
```

Expose only:

`GET /health`

with a basic JSON response.

Keep Express app creation separate from HTTP server startup.

### Prisma

Only initialize Prisma.

Do not create application models or migrations in this milestone.

## Must Not Implement

- authentication
- users domain
- game logic
- MediaWiki
- effective play time
- leaderboard
- database application tables
- UI pages
- Docker
- Redis
- WebSockets

## Validation

Must run successfully:

### Backend

```bash
npm run build
```

and verify the development server starts.

Verify:

```http
GET /health
```

returns HTTP 200.

### Frontend

```bash
npm run build
```

and verify the Angular development server starts.

## Completion Criteria

Milestone is complete when:

- backend builds;
- frontend builds;
- `/health` works;
- Prisma is initialized;
- `.env` is ignored;
- `.env.example` is tracked;
- no business logic has been added.

Recommended commit:

```text
chore: initialize project structure
```

---

# Milestone 1 — Documentation Baseline

## Goal

Install the approved project specifications in the repository and ensure the coding agent understands them before business implementation starts.

## Scope

Repository must include:

```text
AGENTS.md
docs/game-rules.md
docs/architecture.md
docs/database.md
docs/milestones.md
```

`docs/api.md` may exist as an empty or placeholder document until the API design milestone.

## Coding Agent Task

Read the approved documents and produce a concise summary of:

- technology stack;
- authority boundaries;
- game invariants;
- database entities;
- non-goals.

Do not modify application code.

## Validation

Confirm there are no contradictions between:

- `AGENTS.md`
- architecture
- game rules
- database design

If a contradiction exists, report it instead of silently changing documentation.

## Completion Criteria

Milestone is complete when the documentation is versioned and understood.

Recommended commit:

```text
docs: add project architecture and game specifications
```

---

# Milestone 2 — Database and Prisma Schema

## Goal

Implement the approved PostgreSQL data model using Prisma and apply the initial migration to Supabase.

## Required Reading

- `docs/database.md`
- `docs/game-rules.md`

## Scope

Implement Prisma models:

- `User`
- `Game` (including the `effectivePlayTimeMs` / `playStartedAt` / `lastHeartbeatAt` timing fields — there is no separate session table)
- `GameMove`

Implement enums:

- `GameMode`
- `GameDifficulty`
- `GameStatus`
- `GameMoveType`

Implement relations, indexes, mappings and cascading behavior defined in `docs/database.md`.

Create and version the Prisma migrations.

Add custom PostgreSQL constraints that Prisma cannot express directly (non-negative counter / play-time checks, completion consistency, positive move sequence).

Configure connection through environment variables.

Never commit real Supabase credentials.

## Important Invariants

Preserve:

- counters and `effectivePlayTimeMs` cannot be negative;
- unique `(gameId, sequence)`;
- completed games require `completedAt`;
- in-progress games require `completedAt = NULL`;
- GameMove cascades on Game deletion.

The maximum of 10 in-progress games per user remains application/domain logic and must **not** be modeled as a user column.

## Must Not Implement

- Express authentication routes
- game creation API
- MediaWiki requests
- frontend database access
- leaderboard logic

## Validation

Run:

```bash
npx prisma format
npx prisma validate
npx prisma generate
```

Apply the migration to the configured Supabase development database.

Verify the expected tables and constraints exist.

## Completion Criteria

- Prisma schema matches `docs/database.md`;
- migration is versioned;
- Supabase contains the expected schema;
- Prisma Client generates successfully.

Recommended commit:

```text
feat: add initial database schema
```

---

# Milestone 3 — Backend Foundation

## Goal

Create the backend infrastructure required by later modules without implementing business features.

## Scope

Establish a clean Express architecture.

Recommended structure:

```text
backend/src/
├── app.ts
├── server.ts
├── config/
├── lib/
│   └── prisma.ts
├── middleware/
│   ├── error.middleware.ts
│   └── validation.middleware.ts
├── modules/
└── shared/
```

Implement:

- environment configuration and validation;
- Prisma Client lifecycle/singleton;
- centralized error handling;
- API 404 handling;
- request validation infrastructure;
- standard JSON API error shape;
- basic logging approach if needed.

Keep `/health`.

## Must Not Implement

- authentication
- games
- MediaWiki
- effective play time
- leaderboards

## Validation

- TypeScript build passes;
- server boots;
- `/health` still works;
- a forced/test error is handled through the centralized error middleware;
- Prisma connection can be established in the intended environment.

## Completion Criteria

The backend is ready for feature modules without architectural restructuring.

Recommended commit:

```text
chore: establish backend infrastructure
```

---

# Milestone 4 — API Contract Design

## Goal

Define the REST API before implementing application routes.

## Scope

Create/populate:

`docs/api.md`

Document at least:

### Authentication

- register
- login
- current authenticated user
- logout/token lifecycle as decided

### Games

- create game
- list current user's games
- get one game
- delete in-progress game
- get current article
- move
- backtrack

### Effective play time

- heartbeat (updates the activity timestamp only)

### Public History

- list completed games
- get completed game details

### Leaderboards

- CLICK leaderboard
- TIME leaderboard
- difficulty filters

### Profile / Statistics

- authenticated user's public/basic profile as required
- personal statistics

For every endpoint define:

- method;
- URL;
- authentication requirement;
- request body/query parameters;
- response shape;
- relevant error codes.

## Must Not Implement

No endpoint code in this milestone unless explicitly requested separately.

## Validation

Review API design against:

- game rules;
- database;
- architecture.

## Completion Criteria

The frontend/backend contract is clear enough to implement without inventing behavior during coding.

Recommended commit:

```text
docs: define initial REST API contract
```

---

# Milestone 5 — Authentication

## Goal

Implement user registration and authentication in Express.

## Required Reading

- `docs/architecture.md`
- `docs/database.md`
- `docs/api.md`

## Scope

Implement the approved API contract for:

- registration;
- login;
- authenticated user lookup;
- logout/token lifecycle as designed.

Implement:

- password hashing using an approved password hashing library;
- input validation;
- duplicate username/email handling;
- authentication middleware;
- ownership identity derived from authenticated credentials.

Do not use Supabase Auth unless architecture is explicitly changed.

## Security Requirements

Never:

- store plaintext passwords;
- return passwordHash;
- trust userId in request bodies for authentication/ownership;
- expose secrets.

## Must Not Implement

- game creation
- game navigation
- Wikipedia
- leaderboards

## Validation

Test at least:

- successful registration;
- duplicate username/email rejection;
- successful login;
- invalid password rejection;
- authenticated `/me`;
- unauthenticated access rejection.

## Completion Criteria

Authentication is usable by later modules and has automated backend tests.

Recommended commit:

```text
feat: implement authentication
```

---

# Milestone 6 — Basic Game Lifecycle

## Goal

Implement creation, retrieval, listing and deletion of games without navigation yet.

## Required Reading

- `docs/game-rules.md`
- `docs/database.md`
- `docs/api.md`

## Scope

Implement:

- create game;
- list current user's games;
- retrieve one owned game;
- delete one owned `IN_PROGRESS` game.

Game creation accepts:

- `mode`
- `difficulty`

Implement the maximum:

**10 `IN_PROGRESS` games per user**

The limit must be enforced safely under concurrent requests.

Deletion is allowed only when:

- the authenticated user owns the game;
- status is `IN_PROGRESS`.

Completed games cannot be deleted by normal users.

At this milestone, starting-page selection may be abstracted/stubbed if MediaWiki integration is not yet implemented, but the interface must be designed so the MediaWiki implementation can replace the stub cleanly.

## Must Not Implement

- playable article rendering
- game moves
- backtracking
- effective play time / heartbeat
- leaderboards

## Validation

Test:

- create game;
- mode/difficulty validation;
- list games;
- ownership protection;
- delete in-progress game;
- reject completed-game deletion;
- reject the 11th in-progress game.

## Completion Criteria

Basic persistent game lifecycle works with authorization.

Recommended commit:

```text
feat: implement basic game lifecycle
```

---

# Milestone 7 — MediaWiki Integration

## Goal

Create the isolated MediaWiki integration layer.

## Required Reading

- `docs/game-rules.md`
- `docs/architecture.md`

## Scope

Implement a MediaWiki client/service capable of:

- fetching an Italian Wikipedia article;
- resolving stable page identifiers;
- retrieving article content required for rendering;
- extracting eligible internal article links;
- selecting random starting-page candidates;
- filtering unsuitable starting pages.

Implement sanitization/normalization needed for safe frontend rendering.

Exclude non-playable links according to game rules.

Do not expose arbitrary external navigation.

## Design Requirement

The rest of the backend must consume MediaWiki through a service abstraction.

Do not scatter raw MediaWiki HTTP calls through game controllers/services.

## Must Not Implement

- complete navigation engine
- effective-time accounting
- leaderboard

## Validation

Create integration/unit tests around representative article data.

Verify:

- valid internal link extraction;
- exclusion of external/reference/category/special links;
- random page filtering;
- safe normalized output.

## Completion Criteria

The backend can reliably obtain a playable article representation and validate candidate links.

Recommended commit:

```text
feat: integrate MediaWiki article service
```

---

# Milestone 8 — Game Navigation Engine

## Goal

Implement authoritative game navigation and backtracking.

## Required Reading

- `docs/game-rules.md`
- `docs/database.md`
- `docs/api.md`

## Scope

Implement:

- valid NAVIGATION move;
- GameMove persistence;
- click count increment;
- current page update;
- backtracking;
- difficulty rules;
- active-path reconstruction;
- target detection;
- completion transition.

### Navigation

The backend must verify:

- game ownership;
- game is `IN_PROGRESS`;
- target is a valid playable link from current page.

There is no `version` field and no session id on the request.

### Backtracking

- EASY: unlimited;
- MEDIUM: maximum 3;
- HARD: rejected.

BACKTRACK does not increment click count.

### Completion

Reaching the configured Federico II MediaWiki page id:

- sets `COMPLETED`;
- sets `completedAt`;
- prevents further moves;
- finalizes `effectivePlayTimeMs` (see Milestone 9) in the same transaction.

## Transactions

Game mutation and GameMove persistence must remain atomic.

## Validation

Test:

- valid move;
- invalid/teleport move rejected;
- click increment;
- easy backtracking;
- medium fourth backtrack rejected;
- hard backtracking rejected;
- revisiting via a normal link remains NAVIGATION;
- victory detection;
- moves after completion rejected.

## Completion Criteria

Core game rules are enforced server-side.

Recommended commit:

```text
feat: implement game navigation engine
```

---

# Milestone 9 — Effective Play Time

## Goal

Implement server-authoritative official effective play time without any
persistent play-session entity.

## Required Reading

- `docs/game-rules.md` §12
- `docs/database.md` §7
- `docs/api.md` §5.8, §8.3

## Scope

Add three fields to `Game`: `effectivePlayTimeMs`, `playStartedAt`,
`lastHeartbeatAt`. Implement, ideally in one small timing helper:

- resume on open — `GET /api/games/:id` (owner, `IN_PROGRESS`) finalizes any
  pending interval up to its last heartbeat, then starts a fresh interval;
- minimal heartbeat — `POST /api/games/:id/heartbeat` sets `lastHeartbeatAt = now`
  (and `playStartedAt = now` if unset); rejected on a completed game;
- activity on gameplay — a valid move/backtrack refreshes `lastHeartbeatAt` in
  its own transaction;
- completion — the winning move finalizes the last interval up to now and clears
  `playStartedAt` / `lastHeartbeatAt` in the completion transaction.

No session table, no `ACTIVE`/`EXPIRED` state machine, no expiration job, no
one-session rule, no version field. Cross-device resume works because state lives
in `Game` + `GameMove`.

A closed/crashed browser must not cause offline time to count: the interval is
bounded by the last heartbeat when the game is next opened.

## Validation

Test:

- open → heartbeats → move → completion records effective time correctly;
- browser disappears → long gap → reopen counts only up to the last heartbeat;
- reopening finalizes the old interval and starts a new one;
- the winning move accounts the final interval up to the backend's current time;
- a heartbeat updates timing but creates no other row;
- a completed game rejects the heartbeat and its effective time stays final;
- effective time is non-negative and monotonic across a game;
- TIME leaderboard orders by `effectivePlayTimeMs`.

## Completion Criteria

TIME mode has a reliable server-authoritative clock foundation.

Recommended commit:

```text
feat: track effective play time on the game record
```

---

# Milestone 10 — Public History and Game Details

## Goal

Expose completed games to unauthenticated users.

## Scope

Implement:

- completed-game list;
- completed-game details;
- starting page;
- reconstructed path;
- move history where appropriate;
- number of clicks;
- effective total time;
- mode;
- difficulty;
- player identity/public username as approved.

In-progress games must never be exposed publicly through these endpoints.

## Validation

Test:

- unauthenticated completed-history access;
- completed detail;
- in-progress game is not publicly exposed;
- path order is correct.

## Completion Criteria

The public-history requirement is satisfied.

Recommended commit:

```text
feat: add public game history
```

---

# Milestone 11 — Leaderboards and Statistics

## Goal

Implement ranking and personal statistics derived from completed games.

## Scope

Implement leaderboard queries for:

### CLICK

Separate by difficulty.

Ordering:

1. `clickCount ASC`
2. `effectivePlayTimeMs ASC`

### TIME

Separate by difficulty.

Ordering:

1. `effectivePlayTimeMs ASC`
2. `clickCount ASC`

Use completed games only.

Do not create an authoritative leaderboard table.

Implement personal statistics such as:

- completed games;
- current in-progress games;
- best CLICK result;
- best TIME result;
- average clicks where meaningful;
- average effective time where meaningful.

Exact statistics should remain simple and useful.

## Validation

Test deterministic ranking with seeded completed games.

Verify difficulty separation.

## Completion Criteria

Public rankings and authenticated personal statistics work.

Recommended commit:

```text
feat: add leaderboards and player statistics
```

---

# Milestone 12 — Angular Application Shell

## Goal

Build the frontend application structure and connect authentication/basic API access.

## Scope

Create routes/pages for:

- home
- login
- register
- dashboard
- new game
- game
- history
- completed game detail
- leaderboard
- profile

Implement:

- top-level layout/navigation;
- auth state handling;
- HTTP API client structure;
- auth guard where needed;
- API error handling;
- responsive baseline.

Do not yet focus on polished game article rendering.

## Validation

- Angular build passes;
- public routes accessible;
- protected routes guarded;
- registration/login work against backend;
- dashboard can load authenticated data.

## Completion Criteria

The SPA shell is stable and backend-connected.

Recommended commit:

```text
feat: build Angular application shell
```

---

# Milestone 13 — Dashboard and New Game UI

## Goal

Implement the main authenticated pre-game experience.

## Scope

Dashboard displays:

- current user;
- in-progress games;
- resume actions;
- delete in-progress action;
- basic personal statistics;
- clear indication when 10-game limit is reached.

New Game UI allows selection of:

### Mode

- CLICK
- TIME

### Difficulty

- EASY
- MEDIUM
- HARD

Explain difficulty backtracking rules briefly.

## Validation

Test UI flows:

- create game;
- resume game;
- delete in-progress game;
- 10-game limit presentation;
- mode/difficulty selection.

## Completion Criteria

Users can manage their active games without manual API interaction.

Recommended commit:

```text
feat: add dashboard and game creation UI
```

---

# Milestone 14 — Game UI and Wikipedia-like Experience

## Goal

Implement the core ROADTOUNINA gameplay experience.

## Scope

Build:

```text
GamePage
├── GameHud
├── WikipediaArticle
├── GamePath
└── completion/result state
```

### WikipediaArticle

Must provide a reading/navigation experience similar to Wikipedia while staying inside ROADTOUNINA.

Requirements:

- sanitized article content;
- playable links visually natural;
- playable links trigger game API actions;
- excluded/external navigation cannot escape the sandbox.

### GameHud

Displays:

- mode;
- difficulty;
- official/effective timer display;
- click count;
- backtracking status.

### GamePath

Displays the active path.

### Backtracking

UI state must reflect:

- EASY unlimited;
- MEDIUM remaining uses;
- HARD unavailable.

### Error handling

Handle:

- move rejection (`INVALID_MOVE`) — refresh the article;
- backtrack rejections (`BACKTRACK_NOT_ALLOWED` / `BACKTRACK_LIMIT_REACHED`);
- `GAME_NOT_IN_PROGRESS` — reload authoritative state;
- transient Wikipedia / network failures — non-fatal, offer retry.

There is no stale-version or session-conflict handling to implement. The
heartbeat runs on a plain interval; if it fails transiently it just retries, and
`GAME_NOT_IN_PROGRESS` from it triggers a reload.

## Validation

Verify gameplay manually and through frontend tests where useful.

## Completion Criteria

A user can play from random page to target entirely through the Angular interface.

Recommended commit:

```text
feat: implement gameplay interface
```

---

# Milestone 15 — History, Leaderboard and Profile UI

## Goal

Complete the main product surfaces.

## Scope

Implement frontend screens for:

- public completed-game history;
- completed-game detail/path;
- CLICK leaderboard;
- TIME leaderboard;
- difficulty filtering;
- personal profile/statistics.

Keep the UI focused. Do not introduce social-network features.

## Validation

Verify anonymous and authenticated access rules.

## Completion Criteria

All major product surfaces required by the specification are usable.

Recommended commit:

```text
feat: add history leaderboard and profile UI
```

---

# Milestone 16 — End-to-End Tests

## Goal

Implement automated E2E coverage for critical application behavior.

## Testing Tool

Use Playwright unless explicitly changed.

The project specification requires at least 10 automated E2E tests.

Target at least 12–15 meaningful scenarios rather than exactly ten.

## Recommended Scenarios

1. user registration;
2. user login;
3. create CLICK/EASY game;
4. create TIME/HARD game;
5. reject creation when user has 10 in-progress games;
6. valid Wikipedia navigation;
7. invalid/forged navigation rejected;
8. EASY backtracking works;
9. MEDIUM fourth backtrack rejected;
10. HARD backtracking rejected;
11. game resume preserves state;
12. reaching target completes game;
13. completed game visible in public history;
14. leaderboard shows completed result in correct mode/difficulty.

The suite currently has 13 browser-driven scenarios (≥ 10 required).

Tests must not rely excessively on unstable live Wikipedia randomness.

Where needed, use deterministic test fixtures/mocking at integration boundaries while preserving at least focused coverage of the real MediaWiki adapter separately.

## Validation

Run the complete E2E suite from a documented command.

## Completion Criteria

At least 10 meaningful E2E tests pass reliably.

Recommended commit:

```text
test: add end-to-end application coverage
```

---

# Milestone 17 — UI/UX Polish and Responsive Review

## Goal

Improve usability without expanding the product scope.

## Scope

Review:

- desktop;
- tablet;
- mobile;
- loading states;
- empty states;
- error states;
- game HUD responsiveness;
- article readability;
- accessibility basics;
- keyboard/focus behavior;
- form validation messaging.

Do not add major new product features during polish.

## Completion Criteria

The application feels like a coherent small product rather than disconnected coursework pages.

Recommended commit:

```text
style: polish responsive user experience
```

---

# Milestone 18 — Final Technical Review

## Goal

Prepare the project for submission and oral discussion.

## Scope

Review:

- architecture consistency;
- security basics;
- database migrations;
- API documentation;
- README setup instructions;
- E2E test instructions;
- frontend/backend separation;
- environment variables;
- no secrets committed;
- no `node_modules` committed;
- sample/demo data if useful;
- production/dev commands;
- error handling.

Verify the student can explain:

- why Express was chosen;
- why backend is authoritative;
- Prisma/Supabase architecture;
- Game/GameMove distinction;
- effective play time (the three `Game` timing fields and the resume/heartbeat/completion flow);
- the minimal heartbeat;
- why there is no session entity, expiration job, or version field;
- Wikipedia sandboxing;
- leaderboard queries;
- difficulty rules.

## Validation

Perform a clean installation from repository instructions.

Run:

- backend build/tests;
- frontend build/tests;
- E2E tests;
- database migration setup as documented.

## Completion Criteria

A fresh clone can be configured and run using README instructions.

Recommended commit:

```text
chore: prepare project for submission
```

---

# Optional Milestones — Only After Core Completion

These features are intentionally postponed until the required application is complete and stable.

Do not implement them automatically.

## Optional A — Daily Challenge

All users receive the same starting page for a specific day.

Requires a precise rule for daily challenge identity, timing and leaderboard separation before implementation.

## Optional B — Extended Statistics

Possible examples:

- success trends;
- most visited pages;
- performance by difficulty;
- performance by mode.

Only add statistics that can be explained and are useful.

## Optional C — Improved Starting-Page Quality

Improve starting-page heuristics based on observed gameplay.

Do not build the complete Wikipedia graph.

---

# Working Rule for OpenCode / DeepSeek

For each milestone, prompts should follow this pattern:

```text
Context:
Read AGENTS.md and the relevant docs.

Task:
Implement Milestone N only.

Constraints:
Do not implement later milestones.
Do not change approved architecture.
Do not add unrelated dependencies.

Validation:
Run the build/tests required by Milestone N.

Output:
Report changed files, decisions, dependencies and validation results.
Stop after Milestone N.
```

Never use a vague instruction such as:

`Continue building the project.`

Prefer:

`Implement Milestone 6 — Basic Game Lifecycle exactly as documented in docs/milestones.md.`

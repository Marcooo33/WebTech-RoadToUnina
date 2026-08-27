# AGENTS.md — ROADTOUNINA Coding Agent Instructions

## 1. Project

ROADTOUNINA is a university full-stack web project.

Approved core stack:

- Angular frontend
- Node.js + Express backend
- TypeScript
- REST API
- PostgreSQL hosted on Supabase
- Prisma ORM
- MediaWiki API

The project must remain understandable and defensible by the student during an oral technical discussion.

Prefer clear, conventional implementations over unnecessary abstraction.

---

## 2. Mandatory Reading

Before modifying code related to a domain, read the relevant documentation.

Always read:

- `docs/architecture.md`

Before modifying game logic, also read:

- `docs/game-rules.md`

Before modifying Prisma/database code, also read:

- `docs/database.md`

Before implementing or changing HTTP endpoints, read:

- `docs/api.md` when it exists/is populated.

If repository code and approved documentation conflict, do not silently choose one. Report the conflict before making an architectural change.

---

## 3. Scope Discipline

Implement only the task or milestone explicitly requested.

Do not continue implementing adjacent features because they appear convenient.

Examples:

- if asked to implement authentication, do not implement games;
- if asked to implement Prisma models, do not implement Express routes;
- if asked to implement MediaWiki integration, do not redesign authentication;
- if asked to bootstrap the repository, do not implement business logic.

Stop after the requested scope has been completed and validated.

---

## 4. Architecture Must Not Be Changed Silently

Do not replace or add major technologies without explicit instruction.

In particular, do not introduce:

- NestJS;
- microservices;
- Redis;
- WebSockets;
- GraphQL;
- Kafka/message queues;
- Kubernetes;
- Supabase Auth as a replacement for Express authentication;
- NgRx;
- third-party UI frameworks;
- a separate leaderboard database model;
- full Wikipedia graph crawling.

If a task genuinely requires an architectural change, explain:

1. the problem;
2. why the approved architecture cannot handle it;
3. the smallest proposed change.

Do not make the change until explicitly instructed.

---

## 5. Core Authority Rule

The backend is authoritative for all game state.

Never trust the frontend for authoritative values such as:

- click count;
- backtracking count;
- effective play time;
- current page;
- game status;
- game completion;
- leaderboard score;
- valid Wikipedia moves.

The frontend sends requested actions.

The backend validates and applies those actions.

---

## 6. Security Rules

Never:

- store plaintext passwords;
- commit secrets;
- place real Supabase credentials in `.env.example`;
- trust a userId supplied by the frontend for ownership;
- accept a game score supplied by the frontend;
- render unsanitized external HTML;
- allow arbitrary external navigation through Wikipedia article content.

Use authenticated identity on the server for ownership checks.

Validate all external/client input at API boundaries.

---

## 7. Database Rules

Prisma schema and versioned migrations are the source of truth.

Do not manually mutate Supabase schema as part of normal development once migrations exist.

Preserve the approved entities:

- User
- Game
- GameMove
- GameSession

Do not add `Leaderboard`, `UserStatistics`, or `WikipediaPage` tables without explicit approval.

Important database invariants must remain protected.

Examples:

- non-negative counters;
- one active session per game;
- unique move sequence within a game;
- completion status consistent with completedAt;
- cascade deletion for moves/sessions when an in-progress game is deleted.

Custom PostgreSQL SQL inside Prisma migrations is allowed where Prisma schema syntax cannot express an approved constraint.

---

## 8. Game Rules Must Be Preserved

Do not reinterpret the rules without instruction.

Key invariants include:

- target page is Federico II;
- game state is server-persistent;
- game statuses initially are IN_PROGRESS and COMPLETED;
- maximum 10 IN_PROGRESS games per user;
- CLICK and TIME game modes;
- EASY/MEDIUM/HARD difficulty;
- EASY unlimited backtracking;
- MEDIUM maximum 3 backtracks;
- HARD no backtracking;
- navigation only through validated internal Wikipedia article links;
- backtracking does not count as a navigation click;
- effective play time excludes time outside active play sessions;
- at most one active play session per game;
- victory is decided server-side;
- completed games contribute to public history/rankings.

Read `docs/game-rules.md` for complete definitions.

---

## 9. Express Code Organization

Keep Express modular by domain.

Preferred shape:

```text
backend/src/
├── app.ts
├── server.ts
├── config/
├── lib/
├── middleware/
├── modules/
└── shared/
```

Domain logic should not live directly inside route declarations.

Controllers should be thin.

Services/domain functions should contain business logic.

Prisma/database access should be kept out of presentation-level code where practical.

Do not create abstractions only for the sake of having more layers.

---

## 10. Transactions and Concurrency

Use database transactions for state changes that must remain consistent across multiple writes.

Game mutations must account for concurrency.

The approved design uses a `Game.version` field for optimistic concurrency.

Do not replace newer game state with stale client state.

Expected stale mutation behavior is an explicit conflict response.

---

## 11. MediaWiki Integration

Angular must not be authoritative over MediaWiki navigation.

The backend owns MediaWiki integration for game operations.

External article content must be normalized and sanitized before being sent/rendered.

Playable internal links must become controlled ROADTOUNINA actions.

Do not implement the game by embedding Wikipedia in an iframe.

---

## 12. Frontend Rules

Use Angular's normal modern architecture.

Prefer feature-oriented organization.

Do not add a state-management library unless there is a demonstrated need.

Keep Wikipedia-like visual behavior separate from authoritative game logic.

The frontend timer is visual feedback only; official time comes from the server.

Refresh/resume must reload authoritative state.

---

## 13. Dependency Policy

Before installing a dependency:

1. determine whether the existing platform/library can solve the problem;
2. add the dependency only if it provides clear value;
3. avoid redundant packages;
4. mention newly added dependencies in the task summary.

Do not install large frameworks to solve small problems.

---

## 14. Code Quality

Use:

- TypeScript strictness where practical;
- clear naming;
- small focused functions;
- explicit error handling;
- reusable validation;
- comments only where they explain non-obvious reasoning.

Do not generate excessive comments that merely restate the code.

Avoid speculative generic abstractions.

---

## 15. Validation Before Completing a Task

Before claiming a task is complete:

- run the relevant build;
- run relevant tests;
- run type checking if separate;
- run linting if configured;
- ensure Prisma validation/generation succeeds when database files changed;
- inspect failures instead of ignoring them.

Do not report success when required validation commands fail.

If a failure cannot be fixed within the requested scope, clearly report it.

---

## 16. Required Task Summary

After completing a coding task, report concisely:

1. files created;
2. files modified;
3. main implementation decisions;
4. dependencies added;
5. validation commands run;
6. test/build results;
7. unresolved issues or assumptions.

Do not immediately begin the next milestone.

---

## 17. Git

Do not commit automatically unless explicitly asked.

Never commit:

- `.env`;
- credentials;
- `node_modules`;
- build output;
- local IDE state.

Do commit when asked:

- source files;
- `schema.prisma`;
- Prisma migrations;
- `.env.example`;
- documentation.

---

## 18. Documentation Updates

When an explicitly approved architecture, game rule, database rule, or API contract changes, update the corresponding documentation as part of that task.

Do not alter approved documentation just to make it match an accidental implementation.

Implementation should follow the approved specification, not the other way around.

---

## 19. Handling Ambiguity

For minor implementation details, choose the simplest conventional solution consistent with the documentation.

For ambiguity that changes:

- game behavior;
- database shape;
- API contract;
- authentication;
- security;
- architecture;

do not silently invent requirements.

State the ambiguity and the smallest reasonable options.

---

## 20. Main Goal

The goal is not to maximize generated code.

The goal is to build a reliable, understandable ROADTOUNINA implementation whose architecture and behavior remain consistent with the approved project specifications.

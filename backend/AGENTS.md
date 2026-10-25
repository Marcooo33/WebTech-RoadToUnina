# Backend Guidelines

## Stack & Organization

This directory uses Express 5, TypeScript 5.9, Prisma 7, and PostgreSQL. TypeScript is strict, targets ES2022, and uses NodeNext ESM; retain explicit `.js` extensions in relative source imports. Follow existing two-space indentation and double quotes.

Keep features under `src/modules/`. Follow each module's existing split: routes wire middleware/controllers, controllers parse requests and shape responses, services implement operations, and validation files parse inputs. Auth has a repository; other services use Prisma directly. Do not introduce repository layers everywhere. `src/app.ts` composes dependencies; `src/server.ts` starts the process. Use the shared Prisma client in `src/lib/prisma.ts`; do not hand-edit `src/generated/prisma/`.

## API & Game Invariants

Reuse `shared/validation.ts`, module validators, `ApiError`/`ErrorCode`, and the central error middleware's `{ error: { code, message } }` envelope. Preserve cookie/JWT authentication, active-user and ownership checks, and existing request-header protections. Intentional REST contract changes require matching frontend models/services, tests, and documentation updates.

Preserve server authority over legal links, target detection, mode/difficulty rules, counters, and active play time. Keep shared `game-engine.ts`, navigation helpers, and authenticated/guest services consistent. Respect concurrency checks, pause/resume semantics, guest expiry/limits, and transactional, repeat-safe result claiming. Never accept client-computed scores or elapsed time as authoritative.

Keep Wikipedia access behind `WikipediaArticleSource` and the existing service/client/parser split. Preserve Italian MediaWiki requests, redirect/link validation, HTML sanitization, bounded article caching, request timeout, identifying User-Agent, and upstream failure mapping, including HTTP 429. There is no automatic retry/backoff mechanism; do not assume one exists or add request amplification casually.

## Database Changes

Schema changes belong in `prisma/schema.prisma` with a reviewed migration in `prisma/migrations/`; retain SQL constraints and existing data. Do not rewrite applied migrations or reset/push over a populated database. Generate migrations against a disposable development database, review SQL for data loss, and regenerate the client with `npm run prisma:generate`.

## Validation & Documentation Caveats

Run `npm test` for Node's test runner over `test/*.test.ts` and `npm run build` for compilation. Current tests exercise game logic with fixtures/injected dependencies. Use the root E2E procedure for database-backed coverage; any new integration harness must use an explicitly isolated disposable database and guard destructive operations.

`backend/.env.example` still mentions `npm run test:integration` and `INTEGRATION_DATABASE_URL`, but no integration script/harness currently exists. Do not rely on those comments. Keep `E2E_FAKE_WIKIPEDIA` disabled outside tests.

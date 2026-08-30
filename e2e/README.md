# ROADTOUNINA — End-to-End tests (Milestone 16)

Playwright tests that drive the real browser → Angular → Express → PostgreSQL
path. At least 10 scenarios are full UI flows; a few server-authoritative rule
edges (forged move, MEDIUM 4th backtrack, HARD backtrack, 11th game) are checked
through the API client bound to the browser context.

## How it stays deterministic

- **MediaWiki** — the backend runs with `E2E_FAKE_WIKIPEDIA=1`, which makes
  `backend/src/server.ts` swap the live MediaWiki integration for the fixture
  adapter in `backend/src/testing/e2e-wikipedia.ts` (a small fixed page graph
  that always reaches *Università degli Studi di Napoli Federico II*). The real
  MediaWiki adapter is still covered by `backend/tests/integration/wikipedia.live.test.ts`.
- **Database** — a throwaway PostgreSQL 17 container (`docker-compose.yml`, host
  port `55432`, database `roadtounina_e2e`). `global-setup.ts` refuses to run
  unless `E2E_DATABASE_URL` points at exactly `localhost:55432/roadtounina_e2e`,
  so the suite can never migrate or `TRUNCATE` Supabase. The schema is applied
  with `prisma migrate deploy` and the four tables are truncated once per run.
- **Isolation from dev servers** — the E2E stack runs the backend on `:3100` and
  the Angular dev server on `:4300` (a dedicated `proxy.e2e.json` points the
  frontend at `:3100`), with `reuseExistingServer: false`. A developer's
  `npm run dev` (`:3000`) / `npm start` (`:4200`) is never reused, so E2E HTTP
  traffic can never reach a backend configured for Supabase. A port clash is a
  hard error, not a silent hand-off.

## Prerequisites

- Docker with `docker compose`
- Node 20+ (same as the backend)

## Setup

```bash
cd e2e
npm install
npx playwright install chromium
cp .env.example .env          # values are test-only
```

## Run

```bash
npm test
```

`npm test` runs `run-e2e.mjs`, which:

1. `docker compose up -d --wait` — starts Postgres and waits for its healthcheck;
2. `playwright test` — `global-setup` migrates + truncates the DB, then Playwright
   boots the backend (`npx tsx src/server.ts`, fixture MediaWiki) and the Angular
   dev server (`npm start`, which proxies `/api` to the backend) and runs the specs;
3. `docker compose down -v` — always, in a `finally` block.

If a run is hard-killed and the container is left behind:

```bash
npm run db:down
```

### Iterating on one spec

```bash
npm run db:up
npx playwright test tests/navigation.spec.ts
npm run db:down
```

## Layout

| Path | Purpose |
|---|---|
| `playwright.config.ts` | single worker, no retries, `webServer` for backend + frontend |
| `global-setup.ts` | DB guard → readiness → `prisma migrate deploy` → truncate |
| `run-e2e.mjs` | `db:up` → `playwright test` → `db:down` (finally) |
| `support/db.ts` | `assertE2EDatabaseUrl`, truncate, `countActiveSessions` |
| `support/users.ts` | `uniqueUser`, register/login/create-game in a context |
| `support/api.ts` | server-authoritative gameplay helpers for setup / edge checks |
| `support/constants.ts` | the handful of fixture page ids/titles the specs walk |
| `tests/*.spec.ts` | the scenarios |

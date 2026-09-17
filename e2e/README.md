# ROADTOUNINA — End-to-End tests (Milestone 16)

**10 browser-driven E2E tests** that drive the real Angular UI → Express →
PostgreSQL path. `context.request` is used only for support — authenticating a
`BrowserContext`, seeding a completed game, and reading authoritative state as a
secondary assertion — never as a test's main action or assertion.

Server-authoritative rule edges that are awkward or impossible to reach through
the UI (forged navigation, the MEDIUM 4th-backtrack limit, HARD backtrack
rejection, the 11th-game 409) are covered by the backend integration tests
(`backend/tests/integration/`), not duplicated here.

| Spec | Browser scenarios |
|---|---|
| `auth.spec.ts` | register form; log out + log back in |
| `profile.spec.ts` | confirmed soft deletion with anonymized History |
| `game-lifecycle.spec.ts` | create CLICK/EASY; delete from dashboard |
| `navigation.spec.ts` | following a playable link is a click and grows the path |
| `backtracking.spec.ts` | EASY backtrack steps the path back without a click |
| `resume.spec.ts` | resume restores current page / clicks / path |
| `completion.spec.ts` | reaching the target shows the completed result |
| `public.spec.ts` | anonymous History filtering and completed-game detail navigation |

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
  with `prisma migrate deploy` and the application tables are truncated once per run.
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
| `support/db.ts` | `assertE2EDatabaseUrl`, `truncateAll`, `waitForDatabase` |
| `support/users.ts` | `uniqueUser`, register/login/create-game in a context |
| `support/api.ts` | `playThroughApi` (seed a completed game), `getGame` (secondary assertion) |
| `support/constants.ts` | the handful of fixture page ids/titles the specs walk |
| `tests/*.spec.ts` | the scenarios |

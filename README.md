# ROADTOUNINA

Full-stack web project for the Web Technologies course at Università degli Studi di Napoli Federico II.

## Repository structure

```
roadtounina/
├── frontend/    # Angular frontend (standalone, routing, CSS)
├── backend/     # Node.js + Express + TypeScript API, Prisma ORM
├── e2e/         # Playwright end-to-end tests
├── docs/        # Project documentation
├── .gitignore
└── README.md
```

## Prerequisites

- Node.js >= 20
- npm
- Angular CLI (installed locally per project via `frontend/package.json`)
- A PostgreSQL database hosted on Supabase (credentials go in `backend/.env`)

## Install dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

## Run the frontend

```bash
cd frontend
npm start
```

The app is served at http://localhost:4200.

## Run the backend

```bash
cd backend
cp .env.example .env   # fill in your Supabase credentials
npm run dev
```

The API is served at http://localhost:3000 (health check: http://localhost:3000/health).

## Run the backend tests

```bash
cd backend
npm test                      # unit tests (no database)
```

## Run the end-to-end tests

Requires Docker (`docker compose`). The suite starts its own throwaway
PostgreSQL 17 container and a fixture MediaWiki adapter — it never touches
Supabase.

```bash
cd e2e
npm install
npx playwright install chromium
cp .env.example .env
npm test                 # up DB -> migrate -> run Playwright -> down DB
```

See `e2e/README.md` for details.

## Production demo seed

`backend/src/scripts/seed-demo/` holds a manually-invoked script that fills a
ROADTOUNINA installation with realistic demonstration data (11 players, 45
completed games across all six mode/difficulty combinations, 10 in-progress
games) for a live presentation.

**It is destructive to application DATA.** It runs
`TRUNCATE "game_moves", "games", "users" CASCADE` on the database in
`DATABASE_URL` and replaces those rows with the demo dataset. It **never**
touches the schema: no DDL, no `prisma migrate reset`, no changes to migrations,
constraints, indexes or the `_prisma_migrations` history. There is no HTTP
endpoint for it and no test invokes it.

Validate the fixtures first. The dry run resolves every curated route against
live it.wikipedia.org, validates each hop through the application's own
`WikipediaService`, builds the whole dataset in memory and prints it — without
touching any database:

```bash
cd backend
npm run db:seed-demo -- --dry-run
```

The real run requires an explicit environment guard. Without
`ALLOW_PRODUCTION_DEMO_SEED=true` the script refuses to modify anything and
explains why. It also refuses the `roadtounina_e2e` and
`roadtounina_integration` databases, which belong to the test harnesses:

```bash
cd backend
ALLOW_PRODUCTION_DEMO_SEED=true npm run db:seed-demo
```

The same full validation runs first in both modes, so nothing is deleted unless
every route and the whole planned dataset are valid. The reset and all inserts
then happen inside a single transaction.

> **Warning:** this replaces every user, game and move in whatever database
> `backend/.env` points at. Check `DATABASE_URL` before running it, and never
> set `ALLOW_PRODUCTION_DEMO_SEED` in a `.env` file or a shell profile. To
> rehearse the destructive path safely, point `DATABASE_URL` at a disposable
> local database (for example `roadtounina_demo_seed_test`) and run
> `npx prisma migrate deploy` against it first.

Accounts created by the seed:

| Account | Username | Password |
| --- | --- | --- |
| Presentation account (`demo@roadtounina.local`) | `demo` | `12345678` |
| 10 bot players (`<name>@roadtounina.local`) | `alex`, `giulia`, `lorenzo`, `sara`, `davide`, `chiara`, `matteo`, `elena`, `simone`, `valentina` | `RoadToUninaDemo26!` |

These are demo-only credentials for a throwaway presentation database. Passwords
are hashed with the application's own bcrypt utility before insertion.

Routes and dataset distribution are edited in `demo-routes.ts` and
`demo-games.ts`. If Wikipedia changes and a curated hop stops being a playable
link, the dry run says which route and which hop to fix.

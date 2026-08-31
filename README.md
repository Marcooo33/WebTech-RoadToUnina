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
npm run test:integration      # integration tests (local Docker PostgreSQL)
npm run test:integration:down # stop / wipe the local test container
```

`npm run test:integration` needs Docker. It starts the same throwaway
PostgreSQL container as the E2E suite (`e2e/docker-compose.yml`, host port
`55432`), ensures a dedicated `roadtounina_integration` database exists,
applies Prisma migrations to it, then runs the suite. A safety guard aborts
before any query unless the target is exactly that local database, so the
integration tests never reach Supabase or the E2E database (`roadtounina_e2e`).

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

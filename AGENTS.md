# Repository Guidelines

## Scope & Maintenance

ROADTOUNINA is a completed Wikipedia navigation game. Make focused fixes and small improvements; preserve existing behavior unless explicitly asked to change it. Avoid unrelated refactoring, new dependencies, and speculative abstractions. Follow the directory-specific guides for frontend and backend work.

## Project Structure

- `frontend/src/app/features/`: screens; `core/`: authentication, interceptors, API services; `shared/`: reusable components, models, pipes, utilities.
- `frontend/public/`: static assets.
- `backend/src/modules/`: API features; `middleware/`, `lib/`, `shared/`: infrastructure; `backend/prisma/`: schema and migrations; `backend/test/`: unit tests.
- `e2e/tests/`: Playwright scenarios; `e2e/support/`: browser/database helpers.

## Setup & Development

There is no root npm package. Run `npm install` separately in `frontend/`, `backend/`, and `e2e/` as needed.

- In `backend/`, copy `.env.example` to `.env`, configure PostgreSQL and JWT settings, then run `npx prisma generate` and `npx prisma migrate deploy` against the intended development database. `npm run dev` starts the watch server (default port 3000); `npm run build` compiles it; `npm start` runs the compiled server.
- In `frontend/`, `npm start` serves port 4200, proxying `/api` and `/health` to port 3000. `npm run build` produces the production build.
- README's Node.js 20+ prerequisite is outdated: installed Angular CLI/build packages require `^22.22.3 || ^24.15.0 || >=26.0.0`. Check package engine requirements when updating tooling.

## Validation & Database Safety

Choose validation proportional to the change: affected tests and builds for code, browser inspection for visual changes, content/path checks for documentation. Add regression coverage for changed behavior; no coverage threshold or lint script is configured. Directory guides list unit-test commands.

For browser/database coverage, configure `e2e/.env` from its example and run `npx playwright install chromium`, then `npm test`, inside `e2e/`. Docker must be available. The runner starts and removes a disposable PostgreSQL database; its guard requires localhost/127.0.0.1:55432 and database `roadtounina_e2e`. Never use production databases for automated tests or bypass database guards.

## Conventions & Review

Follow neighboring naming patterns: kebab-case files, PascalCase classes/types, camelCase functions/variables. Keep secrets and real `.env` files uncommitted. History uses concise imperative commit subjects, occasionally prefixed with `feat:`. In PRs, explain changed behavior, relevant issues, validation results, and any migration/configuration impact; include screenshots for UI changes.

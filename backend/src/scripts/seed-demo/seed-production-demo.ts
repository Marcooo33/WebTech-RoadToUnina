/**
 * Production demo seed. Manually invoked, destructive to application DATA only.
 *
 *   npm run db:seed-demo -- --dry-run     validate everything, touch no database
 *   ALLOW_PRODUCTION_DEMO_SEED=true npm run db:seed-demo
 *
 * The script resets the ROADTOUNINA rows of the database in `DATABASE_URL` and
 * repopulates them with the demo dataset defined in `demo-users.ts` /
 * `demo-games.ts`. It never touches the schema: no DDL, no migrations, no
 * constraint or index changes. There is no HTTP entry point for any of this.
 *
 * Order of operations, in both modes:
 *   1. safety checks (write mode only, up front so it fails fast);
 *   2. live Wikipedia resolution and hop-by-hop validation of every route;
 *   3. in-memory build of all rows and plan-wide invariant checks;
 *   4. (write mode) TRUNCATE + all inserts in a single transaction;
 *   5. (write mode) verification through the real history/statistics queries;
 *   6. report.
 *
 * Nothing is deleted before step 3 has fully succeeded.
 */

import { randomUUID } from "node:crypto";

import { hashPassword } from "../../lib/password.js";
import { prisma } from "../../lib/prisma.js";
import {
  normalizeEmail,
  parseRegisterInput,
} from "../../modules/auth/auth.validation.js";
import { listCompletedGames } from "../../modules/history/history.service.js";
import { getUserStatistics } from "../../modules/me/stats.service.js";
import type {
  GameDifficulty,
  GameMode,
  Prisma,
} from "../../generated/prisma/client.js";
import {
  buildGame,
  checkPlanInvariants,
  DemoPlanError,
  type BuiltGame,
} from "./build-rows.js";
import { DEMO_GAMES } from "./demo-games.js";
import { DEMO_ROUTES, findRoute } from "./demo-routes.js";
import {
  BOT_PASSWORD,
  DEMO_PASSWORD,
  DEMO_USERS,
  PRESENTATION_USERNAME,
  passwordFor,
  type DemoUser,
} from "./demo-users.js";
import { DemoRouteError, resolveRoutes } from "./resolve-routes.js";

const GUARD_VARIABLE = "ALLOW_PRODUCTION_DEMO_SEED";
/** Databases owned by the automated test harnesses. Never seeded by this script. */
const PROTECTED_DATABASE_NAMES = [
  "roadtounina_e2e",
  "roadtounina_integration",
];
const TRANSACTION_OPTIONS = { maxWait: 15_000, timeout: 120_000 } as const;

const MODES: readonly GameMode[] = ["CLICK", "TIME"];
const DIFFICULTIES: readonly GameDifficulty[] = ["EASY", "MEDIUM", "HARD"];

function log(message: string): void {
  console.log(message);
}

class SeedRefused extends Error {}

// --- 1. Safety ------------------------------------------------------------

function databaseName(rawUrl: string): string | null {
  try {
    return new URL(rawUrl).pathname.replace(/^\//, "") || null;
  } catch {
    return null;
  }
}

/**
 * Fails closed. Only an explicit guard variable authorises a write, and the
 * databases belonging to the E2E and integration harnesses are refused outright
 * so this script can never become a way around their own guards.
 */
function assertWriteAllowed(): void {
  if (process.env[GUARD_VARIABLE] !== "true") {
    throw new SeedRefused(
      `Refusing to modify the database: ${GUARD_VARIABLE} is not set to "true".\n` +
        `This script deletes every user, game and move in the database pointed at by\n` +
        `DATABASE_URL and replaces them with demo data.\n\n` +
        `To validate the fixtures without touching any database:\n` +
        `  npm run db:seed-demo -- --dry-run\n\n` +
        `To actually run the demo seed:\n` +
        `  ${GUARD_VARIABLE}=true npm run db:seed-demo`,
    );
  }

  const url = process.env["DATABASE_URL"];
  if (!url || url.trim().length === 0) {
    throw new SeedRefused(
      "Refusing to run: DATABASE_URL is missing. Point backend/.env at the " +
        "database you intend to seed.",
    );
  }

  const name = databaseName(url);
  if (name !== null && PROTECTED_DATABASE_NAMES.includes(name)) {
    throw new SeedRefused(
      `Refusing to run against the protected test database "${name}". ` +
        `The E2E and integration harnesses own that database. Use a separate ` +
        `disposable database (for example roadtounina_demo_seed_test) to rehearse ` +
        `this workflow.`,
    );
  }
}

// --- 3. Building the dataset ---------------------------------------------

interface BuiltUser {
  readonly user: DemoUser;
  readonly id: string;
  readonly row: Prisma.UserCreateManyInput;
}

async function buildUsers(): Promise<BuiltUser[]> {
  const built: BuiltUser[] = [];
  const seenUsernames = new Set<string>();
  const seenEmails = new Set<string>();

  for (const user of DEMO_USERS) {
    // The real registration rules, not a copy of them.
    const input = parseRegisterInput({
      username: user.username,
      email: user.email,
      password: passwordFor(user),
    });
    const email = normalizeEmail(input.email);

    if (seenUsernames.has(input.username) || seenEmails.has(email)) {
      throw new DemoPlanError(
        `Duplicate demo user "${input.username}" <${email}>`,
      );
    }
    seenUsernames.add(input.username);
    seenEmails.add(email);

    const id = randomUUID();
    built.push({
      user,
      id,
      row: {
        id,
        username: input.username,
        email,
        // Hashed with the application's own bcrypt utility. The plaintext never
        // reaches a row object.
        passwordHash: await hashPassword(input.password),
      },
    });
  }

  if (!built.some((entry) => entry.user.isPresentationAccount)) {
    throw new DemoPlanError("No presentation account in the demo user list");
  }

  return built;
}

function buildGames(users: readonly BuiltUser[], routes: Awaited<ReturnType<typeof resolveRoutes>>): BuiltGame[] {
  const byUsername = new Map(users.map((entry) => [entry.user.username, entry]));
  const now = new Date();

  const built = DEMO_GAMES.map((plan) => {
    const owner = byUsername.get(plan.username);
    if (!owner) {
      throw new DemoPlanError(
        `Plan references unknown demo user "${plan.username}"`,
      );
    }
    const route = routes.get(plan.routeId);
    if (!route) {
      throw new DemoPlanError(
        `Plan references unresolved route "${plan.routeId}"`,
      );
    }
    return buildGame(plan, route, owner.id, randomUUID(), now);
  });

  checkPlanInvariants(built);
  return built;
}

// --- 4. Reset and insert --------------------------------------------------

/**
 * One transaction: the TRUNCATE and every insert succeed or fail together, so a
 * failed insertion can never leave the database empty.
 *
 * `TRUNCATE ... CASCADE` deletes rows only: tables, constraints, indexes and
 * the `_prisma_migrations` history are untouched. `RESTART IDENTITY` is
 * pointless here since every primary key is a uuid, not a serial column.
 */
async function resetAndInsert(
  users: readonly BuiltUser[],
  games: readonly BuiltGame[],
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      'TRUNCATE TABLE "game_moves", "games", "users" CASCADE',
    );
    await tx.user.createMany({ data: users.map((entry) => entry.row) });
    await tx.game.createMany({ data: games.map((entry) => entry.game) });
    await tx.gameMove.createMany({ data: games.flatMap((entry) => entry.moves) });
  }, TRANSACTION_OPTIONS);
}

// --- 5. Verification through the real application queries -----------------

function assertOrdered(
  mode: GameMode,
  difficulty: GameDifficulty,
  items: readonly { clickCount: number; effectivePlayTimeMs: number }[],
): void {
  for (let index = 1; index < items.length; index += 1) {
    const previous = items[index - 1]!;
    const current = items[index]!;
    const [a, b] =
      mode === "CLICK"
        ? [
            [previous.clickCount, previous.effectivePlayTimeMs],
            [current.clickCount, current.effectivePlayTimeMs],
          ]
        : [
            [previous.effectivePlayTimeMs, previous.clickCount],
            [current.effectivePlayTimeMs, current.clickCount],
          ];
    const ordered = a[0]! < b[0]! || (a[0] === b[0] && a[1]! <= b[1]!);
    if (!ordered) {
      throw new Error(
        `Leaderboard ${mode} ${difficulty} is not ordered as the application ` +
          `would return it (position ${index})`,
      );
    }
  }
}

async function verify(): Promise<void> {
  const inProgressIds = new Set(
    (
      await prisma.game.findMany({
        where: { status: "IN_PROGRESS" },
        select: { id: true },
      })
    ).map((game) => game.id),
  );

  for (const mode of MODES) {
    for (const difficulty of DIFFICULTIES) {
      // The real leaderboard/history query, ordering and pagination included.
      const page = await listCompletedGames(mode, {
        difficulty,
        page: 1,
        limit: 100,
      });
      if (page.items.length === 0) {
        throw new Error(`Leaderboard ${mode} ${difficulty} came back empty`);
      }
      if (page.items.some((item) => inProgressIds.has(item.gameId))) {
        throw new Error(
          `An IN_PROGRESS game appeared in the public ${mode} ${difficulty} history`,
        );
      }
      assertOrdered(mode, difficulty, page.items);
      log(
        `  ${mode} ${difficulty}: ${page.total} completed, ` +
          `best ${page.items[0]!.clickCount} clicks / ` +
          `${Math.round(page.items[0]!.effectivePlayTimeMs / 1000)}s ` +
          `by ${page.items[0]!.username}`,
      );
    }
  }

  const demo = await prisma.user.findUnique({
    where: { username: PRESENTATION_USERNAME },
    select: { id: true },
  });
  if (!demo) {
    throw new Error(`The "${PRESENTATION_USERNAME}" account was not created`);
  }
  const stats = await getUserStatistics(demo.id);
  if (!stats.bestClick || !stats.bestTime) {
    throw new Error(
      `The "${PRESENTATION_USERNAME}" account has no best CLICK and/or TIME result`,
    );
  }
  if (stats.inProgressGames < 2) {
    throw new Error(
      `The "${PRESENTATION_USERNAME}" account has fewer than 2 in-progress games`,
    );
  }
  log(
    `  ${PRESENTATION_USERNAME}: ${stats.completedGames} completed, ` +
      `${stats.inProgressGames} in progress, best CLICK ` +
      `${stats.bestClick.clickCount} clicks (${stats.bestClick.difficulty}), ` +
      `best TIME ${Math.round(stats.bestTime.effectivePlayTimeMs / 1000)}s ` +
      `(${stats.bestTime.difficulty})`,
  );
}

// --- 6. Report ------------------------------------------------------------

function report(
  users: readonly BuiltUser[],
  games: readonly BuiltGame[],
  dryRun: boolean,
): void {
  const completed = games.filter((entry) => entry.game.status === "COMPLETED");
  const inProgress = games.filter((entry) => entry.game.status === "IN_PROGRESS");

  log("");
  log(dryRun ? "Demo seed dry run completed (no database was modified)" : "Demo seed completed");
  log("");
  log(`Users: ${users.length}`);
  log(`Completed games: ${completed.length}`);
  log(`In-progress games: ${inProgress.length}`);
  log("");
  log("Completed games:");
  for (const mode of MODES) {
    for (const difficulty of DIFFICULTIES) {
      const count = completed.filter(
        (entry) => entry.game.mode === mode && entry.game.difficulty === difficulty,
      ).length;
      log(`${mode} ${difficulty}: ${count}`);
    }
  }
  log("");
  log("Demo account:");
  log(`username: ${PRESENTATION_USERNAME}`);
  log(`email: demo@roadtounina.local`);
  log(`password: ${DEMO_PASSWORD}`);
  log("");
  log(`Bot accounts share the password: ${BOT_PASSWORD}`);
}

function reportInProgressPages(games: readonly BuiltGame[]): void {
  log("");
  log("In-progress games (resumable through the normal application):");
  for (const entry of games.filter((game) => game.game.status === "IN_PROGRESS")) {
    log(
      `  ${entry.username}: ${entry.game.mode}/${entry.game.difficulty} ` +
        `currently on "${entry.game.currentPageTitle}" ` +
        `(${entry.game.clickCount} clicks, ${entry.game.backtrackCount} backtracks)`,
    );
  }
}

// --- Orchestration --------------------------------------------------------

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");

  if (dryRun) {
    log("Dry run: validating the demo fixtures. No database will be modified.");
  } else {
    // Up front, so a missing guard fails before any Wikipedia traffic.
    assertWriteAllowed();
    log(
      `Write mode: the application data in DATABASE_URL ` +
        `(database "${databaseName(process.env["DATABASE_URL"] ?? "") ?? "unknown"}") ` +
        `will be replaced.`,
    );
  }

  log("");
  log(`Validating ${DEMO_ROUTES.length} curated Wikipedia routes against it.wikipedia.org…`);
  // Fail on an unknown id before spending any API call on it.
  for (const plan of DEMO_GAMES) findRoute(plan.routeId);
  const routes = await resolveRoutes(DEMO_ROUTES, log);

  log("");
  log("Building the demo dataset…");
  const users = await buildUsers();
  const games = buildGames(users, routes);
  log(
    `  ${users.length} users, ${games.length} games, ` +
      `${games.reduce((total, entry) => total + entry.moves.length, 0)} moves`,
  );
  reportInProgressPages(games);

  if (dryRun) {
    report(users, games, true);
    return;
  }

  log("");
  log("Resetting application data and inserting the demo dataset…");
  await resetAndInsert(users, games);

  log("");
  log("Verifying with the real history, leaderboard and statistics queries…");
  await verify();

  report(users, games, false);
}

main()
  .then(() => prisma.$disconnect())
  .then(() => process.exit(0))
  .catch(async (error: unknown) => {
    if (error instanceof SeedRefused) {
      console.error(`\n${error.message}\n`);
    } else if (error instanceof DemoRouteError || error instanceof DemoPlanError) {
      console.error(`\nDemo seed aborted: ${error.message}\n`);
    } else {
      console.error("\nDemo seed failed:", error);
    }
    await prisma.$disconnect().catch(() => undefined);
    process.exit(1);
  });

import { prisma } from "./lib/prisma.js";
import { GuestGamesService } from "./modules/guest-games/guest-games.service.js";
import { createGuestGamesRouter } from "./modules/guest-games/guest-games.routes.js";
import cookieParser from "cookie-parser";
import express, { type Express } from "express";
import { errorMiddleware } from "./middleware/error.middleware.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { createGamesRouter } from "./modules/games/games.routes.js";
import { createHistoryRouter } from "./modules/history/history.routes.js";
import { createMeRouter } from "./modules/me/me.routes.js";
import { WikipediaService } from "./modules/wikipedia/wikipedia.service.js";
import type { WikipediaArticleSource } from "./modules/wikipedia/wikipedia.types.js";
import { ErrorCode, errorBody } from "./shared/errors.js";
import { env } from "./config/env.loader.js";
import { frontendDirectory, serveFrontend } from "./lib/frontend.js";
import { createRequestProtection } from "./middleware/request-protection.js";
import { createDbHealthRouter } from "./modules/health/health.routes.js";

export interface AppDependencies {
  wikipediaService?: WikipediaArticleSource;
  guestService?: GuestGamesService;
  frontendDirectory?: string | false;
}

// Called only after guest capability, completion and authenticated ownership checks.
export async function persistGuestGame(
  game: import("./modules/games/games.types.js").GameWithMoves,
  userId: string,
): Promise<void> {
  // A stable UUID reconciles a successful commit whose acknowledgement was lost.
  await prisma.$transaction(async (tx) => {
    const existing = await tx.game.findUnique({ where: { id: game.id } });
    if (existing) {
      if (existing.userId !== userId || existing.status !== "COMPLETED")
        throw new Error("Guest claim ownership conflict");
      return;
    }
    await tx.game.create({
      data: {
        ...game,
        userId,
        updatedAt: new Date(),
        moves: {
          create: game.moves.map(({ gameId: _gameId, ...move }) => move),
        },
      },
    });
  });
}

export function createApp(dependencies: AppDependencies = {}): Express {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", env.TRUST_PROXY_HOPS);
  app.use((_req, res, next) => {
    res.set("X-Content-Type-Options", "nosniff");
    next();
  });
  app.use("/api", createRequestProtection(env.PUBLIC_ORIGIN), (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  app.use(express.json());
  app.use(cookieParser());

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });
  app.use("/api/health", createDbHealthRouter({
    secret: env.DB_HEALTH_SECRET,
    readDatabase: () => prisma.$transaction(async (tx) => {
      // PostgreSQL cancels the statement itself, including waits for table locks.
      // LOCAL is reset on commit/rollback before the pooled connection is reused.
      await tx.$executeRaw`SET LOCAL statement_timeout = '3s'`;
      await tx.$queryRaw`SELECT EXISTS (SELECT 1 FROM users LIMIT 1)`;
    }, { maxWait: 5_000, timeout: 5_000 }),
  }));

  const wikipediaService =
    dependencies.wikipediaService ?? new WikipediaService();

  const guests =
    dependencies.guestService ??
    new GuestGamesService(wikipediaService, persistGuestGame);
  // server.ts owns timers: importing/createApp does not start background work.
  app.locals.guestGames = guests;
  app.use("/api/guest-games", createGuestGamesRouter(guests));

  app.use("/api/auth", authRouter);
  app.use("/api/games", createGamesRouter(wikipediaService));
  app.use("/api/history", createHistoryRouter());
  app.use("/api/me", createMeRouter());

  const notFound: express.RequestHandler = (_req, res) => {
    res.status(404).json(errorBody(ErrorCode.NOT_FOUND, "Route not found"));
  };
  app.use("/api", notFound);

  const staticDirectory = dependencies.frontendDirectory ??
    (env.SERVE_FRONTEND === "1" ? frontendDirectory : false);
  if (staticDirectory) serveFrontend(app, staticDirectory);

  app.use(notFound);

  app.use(errorMiddleware);

  return app;
}

export const app = createApp();

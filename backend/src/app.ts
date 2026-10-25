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

export interface AppDependencies {
  wikipediaService?: WikipediaArticleSource;
  guestService?: GuestGamesService;
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

  app.use(express.json());
  app.use(cookieParser());

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

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

  app.use((_req, res) => {
    res.status(404).json(errorBody(ErrorCode.NOT_FOUND, "Route not found"));
  });

  app.use(errorMiddleware);

  return app;
}

export const app = createApp();

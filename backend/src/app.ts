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

  app.use("/api/auth", authRouter);
  app.use(
    "/api/games",
    createGamesRouter(wikipediaService),
  );
  app.use("/api/history", createHistoryRouter());
  app.use("/api/me", createMeRouter());

  app.use((_req, res) => {
    res.status(404).json(errorBody(ErrorCode.NOT_FOUND, "Route not found"));
  });

  app.use(errorMiddleware);

  return app;
}

export const app = createApp();

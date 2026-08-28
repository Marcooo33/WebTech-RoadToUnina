import type { Request, Response } from "express";
import type { ValidatedRequest } from "../../middleware/validation.middleware.js";
import type {
  CreateGameInput,
  DeleteGameQuery,
  GameParams,
  ListGamesQuery,
} from "./games.schema.js";
import {
  GamesService,
  toGameDto,
  toGameListItemDto,
} from "./games.service.js";
import { placeholderStartingPageProvider } from "./starting-page.provider.js";

const gamesService = new GamesService(placeholderStartingPageProvider);

export async function createGameHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const input = (req as ValidatedRequest).validated.body as CreateGameInput;
  const game = await gamesService.create(req.auth!.userId, input);

  res.status(201).json(toGameDto(game));
}

export async function listGamesHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const query = (req as ValidatedRequest).validated.query as ListGamesQuery;
  const games = await gamesService.list(req.auth!.userId, query.status);

  res.status(200).json({ items: games.map(toGameListItemDto) });
}

export async function getGameHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const params = (req as ValidatedRequest).validated.params as GameParams;
  const game = await gamesService.get(req.auth!.userId, params.gameId);

  res.status(200).json(toGameDto(game));
}

export async function deleteGameHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const params = (req as ValidatedRequest).validated.params as GameParams;
  const query = (req as ValidatedRequest).validated.query as DeleteGameQuery;

  await gamesService.delete(req.auth!.userId, params.gameId, query.version);

  res.status(204).end();
}

import type { Request, Response } from "express";
import { asObject, rejectUnknownKeys } from "../../shared/validation.js";
import {
  GamesService,
  toGameDto,
  toGameListItemDto,
} from "./games.service.js";
import {
  parseCreateGameInput,
  parseGameId,
  parseGameStatusFilter,
  parseMoveInput,
} from "./games.validation.js";

export interface GamesController {
  createGameHandler: (req: Request, res: Response) => Promise<void>;
  listGamesHandler: (req: Request, res: Response) => Promise<void>;
  getGameHandler: (req: Request, res: Response) => Promise<void>;
  deleteGameHandler: (req: Request, res: Response) => Promise<void>;
  getArticleHandler: (req: Request, res: Response) => Promise<void>;
  moveHandler: (req: Request, res: Response) => Promise<void>;
  backtrackHandler: (req: Request, res: Response) => Promise<void>;
  heartbeatHandler: (req: Request, res: Response) => Promise<void>;
}

export function createGamesController(service: GamesService): GamesController {
  return {
    async createGameHandler(req: Request, res: Response): Promise<void> {
      const input = parseCreateGameInput(req.body);
      const game = await service.create(req.auth!.userId, input);

      res.status(201).json(toGameDto(game, []));
    },

    async listGamesHandler(req: Request, res: Response): Promise<void> {
      const status = parseGameStatusFilter(req.query.status);
      const games = await service.list(req.auth!.userId, status);

      res.status(200).json({ items: games.map(toGameListItemDto) });
    },

    async getGameHandler(req: Request, res: Response): Promise<void> {
      const gameId = parseGameId(req.params.gameId);
      const game = await service.get(req.auth!.userId, gameId);

      res.status(200).json(toGameDto(game, game.moves));
    },

    async deleteGameHandler(req: Request, res: Response): Promise<void> {
      const gameId = parseGameId(req.params.gameId);

      await service.delete(req.auth!.userId, gameId);

      res.status(204).end();
    },

    async getArticleHandler(req: Request, res: Response): Promise<void> {
      const gameId = parseGameId(req.params.gameId);
      const article = await service.getArticle(req.auth!.userId, gameId);

      res.status(200).json(article);
    },

    async moveHandler(req: Request, res: Response): Promise<void> {
      const gameId = parseGameId(req.params.gameId);
      const input = parseMoveInput(req.body);

      const game = await service.move(req.auth!.userId, gameId, input);

      res.status(200).json(toGameDto(game, game.moves));
    },

    async backtrackHandler(req: Request, res: Response): Promise<void> {
      const gameId = parseGameId(req.params.gameId);
      // Backtrack takes no body fields: accept `{}`, reject anything else.
      rejectUnknownKeys(
        asObject(req.body, "Invalid backtrack request"),
        [],
        "Invalid backtrack request",
      );

      const game = await service.backtrack(req.auth!.userId, gameId);

      res.status(200).json(toGameDto(game, game.moves));
    },

    async heartbeatHandler(req: Request, res: Response): Promise<void> {
      const gameId = parseGameId(req.params.gameId);

      await service.heartbeat(req.auth!.userId, gameId);

      res.status(204).end();
    },
  };
}

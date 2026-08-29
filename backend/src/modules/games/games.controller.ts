import type { Request, Response } from "express";
import type { ValidatedRequest } from "../../middleware/validation.middleware.js";
import type {
  BacktrackInput,
  CreateGameInput,
  DeleteGameQuery,
  GameParams,
  ListGamesQuery,
  MoveInput,
} from "./games.schema.js";
import {
  GamesService,
  toGameDto,
  toGameListItemDto,
} from "./games.service.js";

export interface GamesController {
  createGameHandler: (req: Request, res: Response) => Promise<void>;
  listGamesHandler: (req: Request, res: Response) => Promise<void>;
  getGameHandler: (req: Request, res: Response) => Promise<void>;
  deleteGameHandler: (req: Request, res: Response) => Promise<void>;
  getArticleHandler: (req: Request, res: Response) => Promise<void>;
  moveHandler: (req: Request, res: Response) => Promise<void>;
  backtrackHandler: (req: Request, res: Response) => Promise<void>;
}

export function createGamesController(service: GamesService): GamesController {
  return {
    async createGameHandler(req: Request, res: Response): Promise<void> {
      const input = (req as ValidatedRequest).validated.body as CreateGameInput;
      const game = await service.create(req.auth!.userId, input);

      res.status(201).json(toGameDto(game, []));
    },

    async listGamesHandler(req: Request, res: Response): Promise<void> {
      const query = (req as ValidatedRequest).validated.query as ListGamesQuery;
      const games = await service.list(req.auth!.userId, query.status);

      res.status(200).json({ items: games.map(toGameListItemDto) });
    },

    async getGameHandler(req: Request, res: Response): Promise<void> {
      const params = (req as ValidatedRequest).validated.params as GameParams;
      const game = await service.get(req.auth!.userId, params.gameId);

      res.status(200).json(toGameDto(game, game.moves));
    },

    async deleteGameHandler(req: Request, res: Response): Promise<void> {
      const params = (req as ValidatedRequest).validated.params as GameParams;
      const query = (req as ValidatedRequest).validated.query as DeleteGameQuery;

      await service.delete(req.auth!.userId, params.gameId, query.version);

      res.status(204).end();
    },

    async getArticleHandler(req: Request, res: Response): Promise<void> {
      const params = (req as ValidatedRequest).validated.params as GameParams;
      const article = await service.getArticle(req.auth!.userId, params.gameId);

      res.status(200).json(article);
    },

    async moveHandler(req: Request, res: Response): Promise<void> {
      const params = (req as ValidatedRequest).validated.params as GameParams;
      const input = (req as ValidatedRequest).validated.body as MoveInput;

      const game = await service.move(req.auth!.userId, params.gameId, input);

      res.status(200).json(toGameDto(game, game.moves));
    },

    async backtrackHandler(req: Request, res: Response): Promise<void> {
      const params = (req as ValidatedRequest).validated.params as GameParams;
      const input = (req as ValidatedRequest).validated.body as BacktrackInput;

      const game = await service.backtrack(req.auth!.userId, params.gameId, input);

      res.status(200).json(toGameDto(game, game.moves));
    },
  };
}

import type { Request, Response } from "express";
import type { ValidatedRequest } from "../../middleware/validation.middleware.js";
import type { GameParams } from "../games/games.schema.js";
import type { HistoryListQuery } from "./history.schema.js";
import { getCompletedGameDetail, listCompletedGames } from "./history.service.js";

export interface HistoryController {
  listHistoryHandler: (req: Request, res: Response) => Promise<void>;
  getHistoryDetailHandler: (req: Request, res: Response) => Promise<void>;
}

export function createHistoryController(): HistoryController {
  return {
    async listHistoryHandler(req: Request, res: Response): Promise<void> {
      const query = (req as ValidatedRequest).validated.query as HistoryListQuery;
      const result = await listCompletedGames(query);

      res.status(200).json(result);
    },

    async getHistoryDetailHandler(req: Request, res: Response): Promise<void> {
      const params = (req as ValidatedRequest).validated.params as GameParams;
      const detail = await getCompletedGameDetail(params.gameId);

      res.status(200).json(detail);
    },
  };
}

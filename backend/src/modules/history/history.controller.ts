import type { Request, Response } from "express";
import { parseGameId } from "../games/games.validation.js";
import { getCompletedGameDetail, listCompletedGames } from "./history.service.js";
import { parseHistoryListQuery } from "./history.validation.js";

export interface HistoryController {
  listHistoryHandler: (req: Request, res: Response) => Promise<void>;
  getHistoryDetailHandler: (req: Request, res: Response) => Promise<void>;
}

export function createHistoryController(): HistoryController {
  return {
    async listHistoryHandler(req: Request, res: Response): Promise<void> {
      const result = await listCompletedGames(parseHistoryListQuery(req.query));

      res.status(200).json(result);
    },

    async getHistoryDetailHandler(req: Request, res: Response): Promise<void> {
      const detail = await getCompletedGameDetail(parseGameId(req.params.gameId));

      res.status(200).json(detail);
    },
  };
}

import type { Request, Response } from "express";
import { parseGameId } from "../games/games.validation.js";
import { getCompletedGameDetail, listCompletedGames } from "./history.service.js";
import { parseHistoryQuery } from "./history.validation.js";

export interface HistoryController {
  clickHistoryHandler: (req: Request, res: Response) => Promise<void>;
  timeHistoryHandler: (req: Request, res: Response) => Promise<void>;
  getHistoryDetailHandler: (req: Request, res: Response) => Promise<void>;
}

export function createHistoryController(): HistoryController {
  return {
    async clickHistoryHandler(req: Request, res: Response): Promise<void> {
      const result = await listCompletedGames("CLICK", parseHistoryQuery(req.query));

      res.status(200).json(result);
    },

    async timeHistoryHandler(req: Request, res: Response): Promise<void> {
      const result = await listCompletedGames("TIME", parseHistoryQuery(req.query));

      res.status(200).json(result);
    },

    async getHistoryDetailHandler(req: Request, res: Response): Promise<void> {
      const detail = await getCompletedGameDetail(parseGameId(req.params.gameId));

      res.status(200).json(detail);
    },
  };
}

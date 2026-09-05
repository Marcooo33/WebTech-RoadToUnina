import type { Request, Response } from "express";
import { getLeaderboard } from "./leaderboards.service.js";
import { parseLeaderboardQuery } from "./leaderboards.validation.js";

export interface LeaderboardsController {
  clickLeaderboardHandler: (req: Request, res: Response) => Promise<void>;
  timeLeaderboardHandler: (req: Request, res: Response) => Promise<void>;
}

export function createLeaderboardsController(): LeaderboardsController {
  return {
    async clickLeaderboardHandler(req: Request, res: Response): Promise<void> {
      const query = parseLeaderboardQuery(req.query);
      res.status(200).json(await getLeaderboard("CLICK", query));
    },

    async timeLeaderboardHandler(req: Request, res: Response): Promise<void> {
      const query = parseLeaderboardQuery(req.query);
      res.status(200).json(await getLeaderboard("TIME", query));
    },
  };
}

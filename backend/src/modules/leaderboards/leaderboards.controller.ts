import type { Request, Response } from "express";
import type { ValidatedRequest } from "../../middleware/validation.middleware.js";
import type { LeaderboardQuery } from "./leaderboards.schema.js";
import { getLeaderboard } from "./leaderboards.service.js";

export interface LeaderboardsController {
  clickLeaderboardHandler: (req: Request, res: Response) => Promise<void>;
  timeLeaderboardHandler: (req: Request, res: Response) => Promise<void>;
}

export function createLeaderboardsController(): LeaderboardsController {
  return {
    async clickLeaderboardHandler(req: Request, res: Response): Promise<void> {
      const query = (req as ValidatedRequest).validated.query as LeaderboardQuery;
      res.status(200).json(await getLeaderboard("CLICK", query));
    },

    async timeLeaderboardHandler(req: Request, res: Response): Promise<void> {
      const query = (req as ValidatedRequest).validated.query as LeaderboardQuery;
      res.status(200).json(await getLeaderboard("TIME", query));
    },
  };
}

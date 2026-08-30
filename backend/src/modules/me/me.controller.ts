import type { Request, Response } from "express";
import { getUserStatistics } from "./stats.service.js";

export interface MeController {
  getStatsHandler: (req: Request, res: Response) => Promise<void>;
}

export function createMeController(): MeController {
  return {
    async getStatsHandler(req: Request, res: Response): Promise<void> {
      const stats = await getUserStatistics(req.auth!.userId);
      res.status(200).json(stats);
    },
  };
}

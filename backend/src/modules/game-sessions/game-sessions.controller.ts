import type { Request, Response } from "express";
import type { ValidatedRequest } from "../../middleware/validation.middleware.js";
import type { GameParams } from "../games/games.schema.js";
import type { GameSessionService } from "./game-sessions.service.js";

export interface GameSessionsController {
  startOrResumeHandler: (req: Request, res: Response) => Promise<void>;
  heartbeatHandler: (req: Request, res: Response) => Promise<void>;
  endHandler: (req: Request, res: Response) => Promise<void>;
}

export function createGameSessionsController(
  service: GameSessionService,
): GameSessionsController {
  return {
    async startOrResumeHandler(req: Request, res: Response): Promise<void> {
      const { gameId } = (req as ValidatedRequest).validated.params as GameParams;
      const result = await service.startOrResume(req.auth!.userId, gameId);

      res.status(200).json(result);
    },

    async heartbeatHandler(req: Request, res: Response): Promise<void> {
      const { gameId } = (req as ValidatedRequest).validated.params as GameParams;
      const result = await service.heartbeat(req.auth!.userId, gameId);

      res.status(200).json(result);
    },

    async endHandler(req: Request, res: Response): Promise<void> {
      const { gameId } = (req as ValidatedRequest).validated.params as GameParams;
      const result = await service.end(req.auth!.userId, gameId);

      res.status(200).json(result);
    },
  };
}

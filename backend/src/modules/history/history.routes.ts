import { Router } from "express";
import { validate } from "../../middleware/validation.middleware.js";
import { gameParamsSchema } from "../games/games.schema.js";
import { createHistoryController } from "./history.controller.js";
import { historyListQuerySchema } from "./history.schema.js";

/**
 * Public, unauthenticated. Exposes COMPLETED games only (docs/api.md §7.1);
 * IN_PROGRESS games can never appear through these endpoints.
 */
export function createHistoryRouter(): Router {
  const controller = createHistoryController();
  const router = Router();

  router.get(
    "/",
    validate({ query: historyListQuerySchema }),
    controller.listHistoryHandler,
  );
  router.get(
    "/:gameId",
    validate({ params: gameParamsSchema }),
    controller.getHistoryDetailHandler,
  );

  return router;
}

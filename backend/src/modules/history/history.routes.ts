import { Router } from "express";
import { createHistoryController } from "./history.controller.js";

/**
 * Public, unauthenticated. Exposes COMPLETED games only (docs/api.md §7.1);
 * IN_PROGRESS games can never appear through these endpoints. Each handler
 * validates its own query/params (see history.validation.ts).
 */
export function createHistoryRouter(): Router {
  const controller = createHistoryController();
  const router = Router();

  router.get("/", controller.listHistoryHandler);
  router.get("/:gameId", controller.getHistoryDetailHandler);

  return router;
}

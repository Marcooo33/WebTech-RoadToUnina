import { Router } from "express";
import { createHistoryController } from "./history.controller.js";

/**
 * Public, unauthenticated. The collection routes are declared before the UUID
 * detail route so the view names can never be interpreted as game ids.
 */
export function createHistoryRouter(): Router {
  const controller = createHistoryController();
  const router = Router();

  router.get("/click", controller.clickHistoryHandler);
  router.get("/time", controller.timeHistoryHandler);
  router.get("/:gameId", controller.getHistoryDetailHandler);

  return router;
}

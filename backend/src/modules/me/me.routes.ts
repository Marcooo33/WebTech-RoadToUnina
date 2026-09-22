import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import { createMeController } from "./me.controller.js";

// Personal statistics for the current user. Ownership comes from the
// authenticated identity, never a client-supplied id.
export function createMeRouter(): Router {
  const controller = createMeController();
  const router = Router();

  router.use(authenticate);
  router.get("/stats", controller.getStatsHandler);

  return router;
}

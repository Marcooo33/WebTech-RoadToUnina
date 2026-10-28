import { Router } from "express";
import { createAuthRateLimits } from "../../middleware/auth-rate-limits.js";
import { env } from "../../config/env.loader.js";
import {
  authenticate,
  requireBrowserRequest,
} from "../../middleware/auth.middleware.js";
import {
  changePasswordHandler,
  deleteMeHandler,
  loginHandler,
  logoutHandler,
  meHandler,
  registerHandler,
  updateMeHandler,
} from "./auth.controller.js";

export const authRouter = Router();
// E2E creates many accounts on one local IP. Production thresholds are verified
// separately against the same factory; only NODE_ENV=test disables route limits.
const limits = createAuthRateLimits(env.NODE_ENV !== "test");

authRouter.post(
  "/register",
  requireBrowserRequest,
  limits.register,
  registerHandler,
);
authRouter.post("/login", requireBrowserRequest, limits.login, loginHandler);
authRouter.post("/logout", authenticate, logoutHandler);
authRouter.get("/me", authenticate, meHandler);
authRouter.patch("/me", limits.account, authenticate, updateMeHandler);
authRouter.patch(
  "/me/password",
  limits.account,
  authenticate,
  changePasswordHandler,
);
authRouter.delete("/me", limits.account, authenticate, deleteMeHandler);

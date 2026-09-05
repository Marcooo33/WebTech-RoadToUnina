import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import {
  loginHandler,
  logoutHandler,
  meHandler,
  registerHandler,
} from "./auth.controller.js";

export const authRouter = Router();

authRouter.post("/register", registerHandler);
authRouter.post("/login", loginHandler);
authRouter.post("/logout", authenticate, logoutHandler);
authRouter.get("/me", authenticate, meHandler);

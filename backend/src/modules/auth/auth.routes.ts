import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
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

authRouter.post("/register", registerHandler);
authRouter.post("/login", loginHandler);
authRouter.post("/logout", authenticate, logoutHandler);
authRouter.get("/me", authenticate, meHandler);
authRouter.patch("/me", authenticate, updateMeHandler);
authRouter.patch("/me/password", authenticate, changePasswordHandler);
authRouter.delete("/me", authenticate, deleteMeHandler);

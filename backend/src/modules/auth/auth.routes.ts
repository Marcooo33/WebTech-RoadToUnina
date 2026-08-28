import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import { validate } from "../../middleware/validation.middleware.js";
import {
  loginHandler,
  logoutHandler,
  meHandler,
  registerHandler,
} from "./auth.controller.js";
import { loginSchema, registerSchema } from "./auth.schema.js";

export const authRouter = Router();

authRouter.post("/register", validate({ body: registerSchema }), registerHandler);
authRouter.post("/login", validate({ body: loginSchema }), loginHandler);
authRouter.post("/logout", authenticate, logoutHandler);
authRouter.get("/me", authenticate, meHandler);

import type { Request, Response } from "express";
import type { ValidatedRequest } from "../../middleware/validation.middleware.js";
import {
  clearAccessTokenCookie,
  setAccessTokenCookie,
} from "../../shared/cookies.js";
import type { LoginInput, RegisterInput } from "./auth.schema.js";
import { getCurrentUser, login, register, toUserProfileDto } from "./auth.service.js";

export async function registerHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const input = (req as ValidatedRequest).validated.body as RegisterInput;
  const user = await register(input);

  setAccessTokenCookie(res, user.id);
  res.status(201).json(toUserProfileDto(user));
}

export async function loginHandler(req: Request, res: Response): Promise<void> {
  const input = (req as ValidatedRequest).validated.body as LoginInput;
  const user = await login(input);

  setAccessTokenCookie(res, user.id);
  res.status(200).json(toUserProfileDto(user));
}

export async function logoutHandler(
  _req: Request,
  res: Response,
): Promise<void> {
  clearAccessTokenCookie(res);
  res.status(204).end();
}

export async function meHandler(req: Request, res: Response): Promise<void> {
  const user = await getCurrentUser(req.auth!.userId);
  res.status(200).json(toUserProfileDto(user));
}

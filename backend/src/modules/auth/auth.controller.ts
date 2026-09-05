import type { Request, Response } from "express";
import {
  clearAccessTokenCookie,
  setAccessTokenCookie,
} from "../../shared/cookies.js";
import { getCurrentUser, login, register, toUserProfileDto } from "./auth.service.js";
import { parseLoginInput, parseRegisterInput } from "./auth.validation.js";

export async function registerHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const user = await register(parseRegisterInput(req.body));

  setAccessTokenCookie(res, user.id);
  res.status(201).json(toUserProfileDto(user));
}

export async function loginHandler(req: Request, res: Response): Promise<void> {
  const user = await login(parseLoginInput(req.body));

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

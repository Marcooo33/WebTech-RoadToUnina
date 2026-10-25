import type { Response } from "express";
import { env } from "../config/env.loader.js";
import { signAccessToken } from "../lib/jwt.js";

export const ACCESS_TOKEN_COOKIE = "access_token";

export interface AccessTokenCookieOptions {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: string;
  maxAge: number;
}

export function accessTokenCookieOptions(
  maxAge: number,
  isProduction: boolean,
): AccessTokenCookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: "/",
    maxAge,
  };
}

export function setAccessTokenCookie(res: Response, userId: string): void {
  const { token, expiresInMs } = signAccessToken(userId);

  res.cookie(
    ACCESS_TOKEN_COOKIE,
    token,
    accessTokenCookieOptions(expiresInMs, env.NODE_ENV === "production"),
  );
}

export function clearAccessTokenCookie(res: Response): void {
  res.clearCookie(ACCESS_TOKEN_COOKIE, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
  });
}

export const GUEST_TOKEN_COOKIE = "guest_token";
export function setGuestCookie(
  res: Response,
  token: string,
  expiresAt: string,
): void {
  res.cookie(GUEST_TOKEN_COOKIE, token, {
    ...accessTokenCookieOptions(
      Math.max(0, new Date(expiresAt).getTime() - Date.now()),
      env.NODE_ENV === "production",
    ),
    path: "/api/guest-games",
  });
}

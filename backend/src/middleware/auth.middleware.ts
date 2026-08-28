import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { verifyAccessToken } from "../lib/jwt.js";
import { ACCESS_TOKEN_COOKIE } from "../shared/cookies.js";
import { ApiError, ErrorCode } from "../shared/errors.js";

export interface AuthIdentity {
  userId: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthIdentity;
    }
  }
}

const uuidSchema = z.string().uuid();

function authenticationRequired(): ApiError {
  return new ApiError(
    401,
    ErrorCode.AUTHENTICATION_REQUIRED,
    "Authentication required",
  );
}

export function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const token = req.cookies?.[ACCESS_TOKEN_COOKIE];

  if (!token) {
    next(authenticationRequired());
    return;
  }

  let sub: string | undefined;
  try {
    sub = verifyAccessToken(token);
  } catch {
    next(authenticationRequired());
    return;
  }

  if (!sub || !uuidSchema.safeParse(sub).success) {
    next(authenticationRequired());
    return;
  }

  req.auth = { userId: sub };
  next();
}

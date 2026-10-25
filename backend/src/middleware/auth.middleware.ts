import type { NextFunction, Request, RequestHandler, Response } from "express";
import { verifyAccessToken } from "../lib/jwt.js";
import { findActiveUserById } from "../modules/auth/auth.repository.js";
import { ACCESS_TOKEN_COOKIE } from "../shared/cookies.js";
import { ApiError, ErrorCode } from "../shared/errors.js";
import { isUuid } from "../shared/validation.js";

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

function authenticationRequired(): ApiError {
  return new ApiError(
    401,
    ErrorCode.AUTHENTICATION_REQUIRED,
    "Authentication required",
  );
}

type ActiveUserLookup = (userId: string) => Promise<unknown | null>;

export function createAuthenticate(
  findActiveUser: ActiveUserLookup = findActiveUserById,
  optional = false,
): RequestHandler {
  return async (
    req: Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const token = req.cookies?.[ACCESS_TOKEN_COOKIE];

    if (!token) {
      next(optional ? undefined : authenticationRequired());
      return;
    }

    let sub: string | undefined;
    try {
      sub = verifyAccessToken(token);
    } catch {
      next(optional ? undefined : authenticationRequired());
      return;
    }

    if (!isUuid(sub)) {
      next(optional ? undefined : authenticationRequired());
      return;
    }

    try {
      if (!(await findActiveUser(sub))) {
        next(optional ? undefined : authenticationRequired());
        return;
      }

      req.auth = { userId: sub };
      next();
    } catch (error) {
      next(error);
    }
  };
}

export const authenticate = createAuthenticate();
export const optionalAuthenticate = createAuthenticate(
  findActiveUserById,
  true,
);

// Same-origin browser requests can supply this header; cross-site forms cannot.
// Keep CORS closed: allowing arbitrary credentialed origins would defeat this check.
export const requireBrowserRequest: RequestHandler = (req, _res, next) => {
  if (req.get("X-Requested-With") !== "ROADTOUNINA") {
    next(
      new ApiError(
        403,
        ErrorCode.REQUEST_HEADER_REQUIRED,
        "A same-origin application request is required.",
      ),
    );
    return;
  }
  next();
};

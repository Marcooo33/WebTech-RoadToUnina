import jwt from "jsonwebtoken";
import type { StringValue } from "ms";
import { env } from "../config/env.loader.js";

const ALGORITHM = "HS256";

export interface AccessToken {
  token: string;
  expiresInMs: number;
}

export function signAccessToken(userId: string): AccessToken {
  const token = jwt.sign({}, env.JWT_SECRET, {
    algorithm: ALGORITHM,
    subject: userId,
    expiresIn: env.JWT_EXPIRES_IN as StringValue,
  });

  const decoded = jwt.decode(token) as { exp?: number } | null;
  const expiresInMs = decoded?.exp ? decoded.exp * 1000 - Date.now() : 0;

  return { token, expiresInMs };
}

export function verifyAccessToken(token: string): string | undefined {
  const payload = jwt.verify(token, env.JWT_SECRET, {
    algorithms: [ALGORITHM],
  });

  if (typeof payload === "string") {
    return undefined;
  }

  return payload.sub;
}

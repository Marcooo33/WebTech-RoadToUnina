import type { RequestHandler } from "express";
import { createRateLimit } from "./rate-limit.js";

export const AUTH_RATE_LIMITS = {
  login: { limit: 30, windowMs: 15 * 60_000 },
  register: { limit: 10, windowMs: 60 * 60_000 },
  account: { limit: 30, windowMs: 15 * 60_000 },
} as const;

export function createAuthRateLimits(enabled = true) {
  const make = ({
    limit,
    windowMs,
  }: {
    limit: number;
    windowMs: number;
  }): RequestHandler =>
    enabled ? createRateLimit(limit, windowMs) : (_req, _res, next) => next();
  return {
    login: make(AUTH_RATE_LIMITS.login),
    register: make(AUTH_RATE_LIMITS.register),
    account: make(AUTH_RATE_LIMITS.account),
  };
}

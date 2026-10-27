import type { RequestHandler } from "express";
import { errorBody, ErrorCode } from "../shared/errors.js";

interface Window {
  count: number;
  expiresAt: number;
}

// Single-process, bounded storage fits the Free service. Expired entries are
// removed on requests; no timer or external state is required.
export function createRateLimit(
  limit: number,
  windowMs: number,
  now = Date.now,
  capacity = 2000,
): RequestHandler {
  const clients = new Map<string, Window>();
  return (req, res, next) => {
    const time = now();
    for (const [key, value] of clients) {
      if (value.expiresAt <= time) clients.delete(key);
    }
    const key = req.ip ?? "unknown";
    let window = clients.get(key);
    if (!window) {
      // Fail closed when full rather than evicting an active limit.
      if (clients.size >= capacity) {
        res.set("Retry-After", String(Math.ceil(windowMs / 1000)));
        res
          .status(429)
          .json(
            errorBody(
              ErrorCode.RATE_LIMITED,
              "Too many requests. Please try again later.",
            ),
          );
        return;
      }
      window = { count: 0, expiresAt: time + windowMs };
      clients.set(key, window);
    }
    if (window.count >= limit) {
      res.set(
        "Retry-After",
        String(Math.max(1, Math.ceil((window.expiresAt - time) / 1000))),
      );
      res
        .status(429)
        .json(
          errorBody(
            ErrorCode.RATE_LIMITED,
            "Too many requests. Please try again later.",
          ),
        );
      return;
    }
    window.count++;
    next();
  };
}

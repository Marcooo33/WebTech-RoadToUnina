import { createHash, timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { errorBody, ErrorCode } from "../../shared/errors.js";

export interface DbHealthOptions {
  secret?: string;
  readDatabase: () => Promise<unknown>;
  now?: () => number;
}

export function createDbHealthRouter({
  secret,
  readDatabase,
  now = Date.now,
}: DbHealthOptions): Router {
  const router = Router();
  const digest = secret ? createHash("sha256").update(secret).digest() : null;
  let windowStart = now();
  let count = 0;
  let busy = false;
  router.get("/db", async (req, res) => {
    res.set("Cache-Control", "no-store");
    if (!digest) {
      res.status(404).json(errorBody(ErrorCode.NOT_FOUND, "Route not found"));
      return;
    }
    const supplied = req.get("X-Health-Secret") ?? "";
    const suppliedDigest = createHash("sha256").update(supplied).digest();
    if (!timingSafeEqual(digest, suppliedDigest)) {
      res.status(404).json(errorBody(ErrorCode.NOT_FOUND, "Route not found"));
      return;
    }
    const time = now();
    if (time - windowStart >= 3_600_000) {
      windowStart = time;
      count = 0;
    }
    if (count >= 12 || busy) {
      res.set(
        "Retry-After",
        busy
          ? "60"
          : String(
              Math.max(1, Math.ceil((windowStart + 3_600_000 - time) / 1000)),
            ),
      );
      res
        .status(429)
        .json(
          errorBody(
            ErrorCode.RATE_LIMITED,
            "Database check temporarily limited.",
          ),
        );
      return;
    }
    count++;
    busy = true;
    try {
      await readDatabase();
      res.json({ status: "ok" });
    } catch {
      // Never return database errors, connection strings, or query results.
      res
        .status(503)
        .json(
          errorBody(
            ErrorCode.DATABASE_UNAVAILABLE,
            "Database temporarily unavailable.",
          ),
        );
    } finally {
      busy = false;
    }
  });
  return router;
}

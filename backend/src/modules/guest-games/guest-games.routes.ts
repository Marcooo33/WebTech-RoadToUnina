import { Router, type RequestHandler } from "express";
import {
  authenticate,
  optionalAuthenticate,
  requireBrowserRequest,
} from "../../middleware/auth.middleware.js";
import { GUEST_TOKEN_COOKIE, setGuestCookie } from "../../shared/cookies.js";
import { ApiError, ErrorCode } from "../../shared/errors.js";
import {
  asObject,
  rejectUnknownKeys,
  validationError,
} from "../../shared/validation.js";
import { parseGameId, parseMoveInput } from "../games/games.validation.js";
import type { GuestGamesService } from "./guest-games.service.js";
import {
  GUEST_TTL_MS,
  GuestGamesService as GuestService,
} from "./guest-games.service.js";

function revision(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0)
    throw validationError("Invalid guest revision");
  return value as number;
}
const anonymous: RequestHandler = (req, _res, next) => {
  next(
    req.auth
      ? new ApiError(
          403,
          ErrorCode.GUEST_PLAY_REQUIRES_ANONYMOUS,
          "Guest gameplay requires an anonymous visitor. Your game has not been changed.",
        )
      : undefined,
  );
};
export function createGuestGamesRouter(service: GuestGamesService): Router {
  const router = Router();
  router.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  router.use(requireBrowserRequest, optionalAuthenticate);
  // Cookie identity is opaque; an invalid value never selects another identity.
  const token = (req: Parameters<RequestHandler>[0]) => {
    const value = req.cookies?.[GUEST_TOKEN_COOKIE];
    return typeof value === "string" && /^[a-f0-9]{64}$/.test(value)
      ? value
      : "";
  };
  router.get("/", (req, res) => {
    const identity = token(req) || GuestService.newToken();
    // Establish identity before creation so other tabs can observe pending work.
    if (!token(req))
      setGuestCookie(
        res,
        identity,
        new Date(Date.now() + GUEST_TTL_MS).toISOString(),
      );
    res.json(service.summary(identity));
  });
  router.post("/", anonymous, async (req, res) => {
    const body = asObject(req.body);
    rejectUnknownKeys(
      body,
      ["replaceGameId", "replaceRevision"],
      "Invalid guest creation request",
    );
    let replacement: { gameId: string; revision: number } | undefined;
    if (body.replaceGameId !== undefined || body.replaceRevision !== undefined)
      replacement = {
        gameId: parseGameId(body.replaceGameId),
        revision: revision(body.replaceRevision),
      };
    try {
      service.throttle(req.ip ?? "unknown");
    } catch (error) {
      res.set("Retry-After", "600");
      throw error;
    }
    const identity = token(req) || GuestService.newToken();
    const state = await service.create(identity, replacement);
    setGuestCookie(res, identity, state.expiresAt);
    res.status(201).json(state);
  });
  // Renew cookies only when the service actually renewed lastActivityAt.
  const handle =
    (
      action: (
        req: Parameters<RequestHandler>[0],
        identity: string,
        id: string,
      ) => Promise<unknown>,
      status = 200,
    ): RequestHandler =>
    async (req, res) => {
      const identity = token(req);
      const id = parseGameId(req.params.gameId);
      const before = service.expiresAt(identity);
      try {
        const result = await action(req, identity, id);
        const after = service.expiresAt(identity);
        if (after && after !== before) setGuestCookie(res, identity, after);
        if (status === 204) res.status(204).end();
        else res.status(status).json(result);
      } catch (error) {
        const after = service.expiresAt(identity);
        if (after && after !== before) setGuestCookie(res, identity, after);
        throw error;
      }
    };
  router.get(
    "/:gameId",
    handle((req, identity, id) => service.get(identity, id, !!req.auth)),
  );
  router.get(
    "/:gameId/article",
    anonymous,
    handle((_req, identity, id) => service.article(identity, id)),
  );
  router.post(
    "/:gameId/moves",
    anonymous,
    handle((req, identity, id) => {
      const body = asObject(req.body);
      rejectUnknownKeys(
        body,
        ["toTitle", "revision"],
        "Invalid guest move request",
      );
      const input = parseMoveInput({ toTitle: body.toTitle });
      return service.move(identity, id, revision(body.revision), input.toTitle);
    }),
  );
  router.post(
    "/:gameId/backtrack",
    anonymous,
    handle((req, identity, id) => {
      const body = asObject(req.body);
      rejectUnknownKeys(body, ["revision"], "Invalid guest request");
      return service.move(identity, id, revision(body.revision));
    }),
  );
  router.post(
    "/:gameId/pause",
    anonymous,
    handle((req, identity, id) => {
      const body = asObject(req.body);
      rejectUnknownKeys(body, ["revision"], "Invalid guest request");
      return service.pause(identity, id, revision(body.revision));
    }, 204),
  );
  router.delete(
    "/:gameId",
    handle((req, identity, id) => {
      const body = asObject(req.body);
      rejectUnknownKeys(body, ["revision"], "Invalid guest request");
      return service.discard(identity, id, revision(body.revision), !!req.auth);
    }, 204),
  );
  router.post("/:gameId/claim", authenticate, async (req, res) => {
    rejectUnknownKeys(asObject(req.body), [], "Invalid claim request");
    const identity = token(req);
    const id = parseGameId(req.params.gameId);
    try {
      const result = await service.claim(identity, id, req.auth!.userId);
      const expires = service.expiresAt(identity);
      if (expires && !result.replay) setGuestCookie(res, identity, expires);
      res
        .status(result.replay ? 200 : 201)
        .json({ gameId: result.gameId, status: result.status });
    } catch (error) {
      const expires = service.expiresAt(identity);
      if (
        error instanceof ApiError &&
        error.code === ErrorCode.GUEST_CLAIM_FAILED &&
        expires
      )
        setGuestCookie(res, identity, expires);
      throw error;
    }
  });
  return router;
}

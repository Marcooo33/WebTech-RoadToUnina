import assert from "node:assert/strict";
import { test } from "node:test";
import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { StringValue } from "ms";
import { env } from "../config/env.loader.js";
import { ACCESS_TOKEN_COOKIE } from "../shared/cookies.js";
import { ApiError, ErrorCode } from "../shared/errors.js";
import { createAuthenticate, type AuthIdentity } from "./auth.middleware.js";

const userId = "2b2c1f8e-6a6a-4b2b-9f1e-1a2b3c4d5e6f";

function sign(
  options: { subject?: string; expiresIn?: StringValue } = {},
): string {
  return jwt.sign({}, env.JWT_SECRET, {
    algorithm: "HS256",
    subject: options.subject ?? userId,
    expiresIn: options.expiresIn ?? "1h",
  });
}

async function invoke(
  cookies?: Record<string, string>,
  active = true,
): Promise<{
  error?: unknown;
  auth?: AuthIdentity;
}> {
  const req = { cookies: cookies ?? {} } as unknown as Request;
  let nextError: unknown;
  let resolveNext!: () => void;
  const nextCalled = new Promise<void>((resolve) => {
    resolveNext = resolve;
  });
  const authenticate = createAuthenticate(async () =>
    active ? { id: userId } : null,
  );

  authenticate(req, {} as Response, (error?: unknown) => {
    nextError = error;
    resolveNext();
  });

  await nextCalled;

  return { error: nextError, auth: req.auth };
}

function isAuthRequired(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status === 401 &&
    error.code === ErrorCode.AUTHENTICATION_REQUIRED
  );
}

test("rejects a missing cookie with 401 AUTHENTICATION_REQUIRED", async () => {
  const { error, auth } = await invoke();

  assert.equal(isAuthRequired(error), true);
  assert.equal(auth, undefined);
});

test("rejects an invalid JWT with 401 AUTHENTICATION_REQUIRED", async () => {
  const { error } = await invoke({ [ACCESS_TOKEN_COOKIE]: "not-a-jwt" });

  assert.equal(isAuthRequired(error), true);
});

test("rejects an expired JWT with 401 AUTHENTICATION_REQUIRED", async () => {
  const { error } = await invoke({
    [ACCESS_TOKEN_COOKIE]: sign({ expiresIn: "-1s" }),
  });

  assert.equal(isAuthRequired(error), true);
});

test("rejects a JWT whose sub is not a valid UUID", async () => {
  const { error } = await invoke({
    [ACCESS_TOKEN_COOKIE]: sign({ subject: "not-a-uuid" }),
  });

  assert.equal(isAuthRequired(error), true);
});

test("exposes the authenticated identity for a valid active user", async () => {
  const { error, auth } = await invoke({ [ACCESS_TOKEN_COOKIE]: sign() });

  assert.equal(error, undefined);
  assert.deepEqual(auth, { userId });
});

test("rejects a valid JWT for a deleted user", async () => {
  const { error, auth } = await invoke(
    { [ACCESS_TOKEN_COOKIE]: sign() },
    false,
  );

  assert.equal(isAuthRequired(error), true);
  assert.equal(auth, undefined);
});

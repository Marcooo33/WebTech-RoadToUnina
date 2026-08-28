import assert from "node:assert/strict";
import { test } from "node:test";
import jwt from "jsonwebtoken";
import { env } from "../config/env.loader.js";
import { signAccessToken, verifyAccessToken } from "./jwt.js";

const userId = "2b2c1f8e-6a6a-4b2b-9f1e-1a2b3c4d5e6f";

test("signs a token whose sub, iat and exp are set and contains no profile data", () => {
  const { token, expiresInMs } = signAccessToken(userId);

  assert.ok(token.length > 0);
  assert.ok(expiresInMs > 0);

  const payload = jwt.decode(token) as Record<string, unknown>;

  assert.equal(payload.sub, userId);
  assert.equal(typeof payload.iat, "number");
  assert.equal(typeof payload.exp, "number");
  assert.equal(payload.username, undefined);
  assert.equal(payload.email, undefined);
});

test("verifyAccessToken returns the subject for a valid token", () => {
  const { token } = signAccessToken(userId);

  assert.equal(verifyAccessToken(token), userId);
});

test("verifyAccessToken throws for an invalid token", () => {
  assert.throws(() => verifyAccessToken("not-a-real-token"));
});

test("verifyAccessToken throws for a token signed with the wrong secret", () => {
  const forged = jwt.sign({}, "a-different-secret-that-is-long-enough", {
    algorithm: "HS256",
    subject: userId,
    expiresIn: "1h",
  });

  assert.throws(() => verifyAccessToken(forged));
});

test("verifyAccessToken throws for an expired token", () => {
  const expired = jwt.sign({}, env.JWT_SECRET, {
    algorithm: "HS256",
    subject: userId,
    expiresIn: "-1s",
  });

  assert.throws(() => verifyAccessToken(expired));
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { hashPassword, verifyPassword } from "./password.js";

test("hashes a password into a bcrypt hash, never plaintext", async () => {
  const hash = await hashPassword("supersecret");

  assert.notEqual(hash, "supersecret");
  assert.match(hash, /^\$2[aby]\$\d{2}\$/);
});

test("hash validates against the original password using bcrypt.compare", async () => {
  const hash = await hashPassword("supersecret");

  assert.equal(await verifyPassword("supersecret", hash), true);
});

test("hash does not validate against a wrong password", async () => {
  const hash = await hashPassword("supersecret");

  assert.equal(await verifyPassword("wrongpassword", hash), false);
});

test("produces a unique hash per call (random salt)", async () => {
  const first = await hashPassword("supersecret");
  const second = await hashPassword("supersecret");

  assert.notEqual(first, second);
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { loginSchema, normalizeEmail, registerSchema } from "./auth.schema.js";

test("registerSchema rejects a username shorter than 3 characters", () => {
  const result = registerSchema.safeParse({
    username: "ab",
    email: "marco@example.com",
    password: "password",
  });

  assert.equal(result.success, false);
});

test("registerSchema rejects a password shorter than 8 characters", () => {
  const result = registerSchema.safeParse({
    username: "marco",
    email: "marco@example.com",
    password: "short",
  });

  assert.equal(result.success, false);
});

test("registerSchema rejects a password longer than 128 characters", () => {
  const result = registerSchema.safeParse({
    username: "marco",
    email: "marco@example.com",
    password: "x".repeat(129),
  });

  assert.equal(result.success, false);
});

test("registerSchema rejects an invalid email", () => {
  const result = registerSchema.safeParse({
    username: "marco",
    email: "not-an-email",
    password: "password",
  });

  assert.equal(result.success, false);
});

test("registerSchema accepts a valid registration", () => {
  const result = registerSchema.safeParse({
    username: "  marco  ",
    email: "  Marco@Example.com  ",
    password: "password",
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.username, "marco");
    assert.equal(result.data.email, "Marco@Example.com");
  }
});

test("loginSchema requires identifier and password", () => {
  assert.equal(loginSchema.safeParse({}).success, false);
  assert.equal(loginSchema.safeParse({ identifier: "marco" }).success, false);
  assert.equal(
    loginSchema.safeParse({ identifier: "marco", password: "password" }).success,
    true,
  );
});

test("normalizeEmail trims and lowercases", () => {
  assert.equal(normalizeEmail("  Marco@Example.com  "), "marco@example.com");
});

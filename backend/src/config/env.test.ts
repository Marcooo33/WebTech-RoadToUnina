import assert from "node:assert/strict";
import { test } from "node:test";
import { parseEnv } from "./env.js";

const validEnv = {
  DATABASE_URL: "postgresql://user:pass@host:5432/db",
  JWT_SECRET: "a-secret-that-is-long-enough-0123456789",
};

test("parseEnv returns parsed values for valid input", () => {
  const result = parseEnv({
    ...validEnv,
    PORT: "4000",
    NODE_ENV: "production",
    JWT_EXPIRES_IN: "1h",
  });

  assert.equal(result.DATABASE_URL, "postgresql://user:pass@host:5432/db");
  assert.equal(result.PORT, 4000);
  assert.equal(result.NODE_ENV, "production");
  assert.equal(result.JWT_SECRET, "a-secret-that-is-long-enough-0123456789");
  assert.equal(result.JWT_EXPIRES_IN, "1h");
});

test("parseEnv defaults PORT, NODE_ENV and JWT_EXPIRES_IN", () => {
  const result = parseEnv(validEnv);

  assert.equal(result.PORT, 3000);
  assert.equal(result.NODE_ENV, "development");
  assert.equal(result.JWT_EXPIRES_IN, "8h");
});

test("parseEnv throws when DATABASE_URL is missing", () => {
  assert.throws(() => parseEnv({ JWT_SECRET: validEnv.JWT_SECRET }), /DATABASE_URL/);
});

test("parseEnv throws when JWT_SECRET is missing", () => {
  assert.throws(
    () => parseEnv({ DATABASE_URL: validEnv.DATABASE_URL }),
    /JWT_SECRET/,
  );
});

test("parseEnv throws when JWT_SECRET is too short", () => {
  assert.throws(
    () => parseEnv({ ...validEnv, JWT_SECRET: "too-short" }),
    /JWT_SECRET/,
  );
});

test("parseEnv throws when PORT is invalid", () => {
  assert.throws(
    () => parseEnv({ ...validEnv, PORT: "not-a-number" }),
    /PORT/,
  );
});

test("parseEnv throws when NODE_ENV is invalid", () => {
  assert.throws(
    () => parseEnv({ ...validEnv, NODE_ENV: "staging" }),
    /NODE_ENV/,
  );
});

test("parseEnv accepts valid JWT_EXPIRES_IN duration strings", () => {
  for (const value of ["8h", "1d", "60", "30m", "2 days"]) {
    const result = parseEnv({ ...validEnv, JWT_EXPIRES_IN: value });

    assert.equal(result.JWT_EXPIRES_IN, value);
  }
});

test("parseEnv throws when JWT_EXPIRES_IN is not a valid duration", () => {
  assert.throws(
    () => parseEnv({ ...validEnv, JWT_EXPIRES_IN: "not-a-duration" }),
    /JWT_EXPIRES_IN/,
  );
});

test("parseEnv throws when JWT_EXPIRES_IN is not positive", () => {
  assert.throws(
    () => parseEnv({ ...validEnv, JWT_EXPIRES_IN: "0" }),
    /JWT_EXPIRES_IN/,
  );
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { parseEnv } from "./env.js";

test("parseEnv returns parsed values for valid input", () => {
  const result = parseEnv({
    DATABASE_URL: "postgresql://user:pass@host:5432/db",
    PORT: "4000",
  });

  assert.equal(result.DATABASE_URL, "postgresql://user:pass@host:5432/db");
  assert.equal(result.PORT, 4000);
});

test("parseEnv defaults PORT to 3000", () => {
  const result = parseEnv({
    DATABASE_URL: "postgresql://user:pass@host:5432/db",
  });

  assert.equal(result.PORT, 3000);
});

test("parseEnv throws when DATABASE_URL is missing", () => {
  assert.throws(() => parseEnv({}), /DATABASE_URL/);
});

test("parseEnv throws when PORT is invalid", () => {
  assert.throws(
    () =>
      parseEnv({
        DATABASE_URL: "postgresql://user:pass@host:5432/db",
        PORT: "not-a-number",
      }),
    /PORT/,
  );
});

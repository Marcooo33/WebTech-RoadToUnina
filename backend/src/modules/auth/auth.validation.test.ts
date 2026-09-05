import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiError } from "../../shared/errors.js";
import {
  normalizeEmail,
  parseLoginInput,
  parseRegisterInput,
} from "./auth.validation.js";

const validRegistration = {
  username: "marco",
  email: "marco@example.com",
  password: "password",
};

test("parseRegisterInput trims username and email but not password", () => {
  const input = parseRegisterInput({
    username: "  marco  ",
    email: "  Marco@Example.com  ",
    password: " keep spaces ",
  });

  assert.equal(input.username, "marco");
  assert.equal(input.email, "Marco@Example.com");
  assert.equal(input.password, " keep spaces ");
});

test("parseRegisterInput rejects a username shorter than 3 or longer than 30", () => {
  assert.throws(
    () => parseRegisterInput({ ...validRegistration, username: "ab" }),
    ApiError,
  );
  assert.throws(
    () => parseRegisterInput({ ...validRegistration, username: "x".repeat(31) }),
    ApiError,
  );
});

test("parseRegisterInput rejects a password shorter than 8 or longer than 128", () => {
  assert.throws(
    () => parseRegisterInput({ ...validRegistration, password: "short" }),
    ApiError,
  );
  assert.throws(
    () => parseRegisterInput({ ...validRegistration, password: "x".repeat(129) }),
    ApiError,
  );
});

test("parseRegisterInput rejects an invalid email", () => {
  for (const email of ["not-an-email", "a@b", "a b@example.com", "@example.com"]) {
    assert.throws(
      () => parseRegisterInput({ ...validRegistration, email }),
      ApiError,
      `expected ${email} to be rejected`,
    );
  }
});

test("parseRegisterInput rejects a missing field", () => {
  assert.throws(() => parseRegisterInput({}), ApiError);
  assert.throws(() => parseRegisterInput({ username: "marco" }), ApiError);
  assert.throws(() => parseRegisterInput("nope"), ApiError);
});

test("parseLoginInput requires a non-empty identifier and password", () => {
  assert.throws(() => parseLoginInput({}), ApiError);
  assert.throws(() => parseLoginInput({ identifier: "marco" }), ApiError);
  assert.throws(
    () => parseLoginInput({ identifier: "   ", password: "x" }),
    ApiError,
  );

  const input = parseLoginInput({ identifier: "  marco  ", password: "pw" });
  assert.deepEqual(input, { identifier: "marco", password: "pw" });
});

test("normalizeEmail trims and lowercases", () => {
  assert.equal(normalizeEmail("  Marco@Example.com  "), "marco@example.com");
});

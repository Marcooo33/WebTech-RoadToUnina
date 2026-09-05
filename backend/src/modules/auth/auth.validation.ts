import { asObject, validationError } from "../../shared/validation.js";

export interface RegisterInput {
  username: string;
  email: string;
  password: string;
}

export interface LoginInput {
  identifier: string;
  password: string;
}

const USERNAME_MIN = 3;
const USERNAME_MAX = 30;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;
const EMAIL_MAX = 255;

// Intentionally minimal: one "@" with non-empty, whitespace-free sides and a dot
// in the domain. A full RFC 5322 regex is not worth maintaining or explaining;
// deliverability is confirmed elsewhere, not by this check.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function requireString(body: Record<string, unknown>, key: string): string {
  const value = body[key];

  if (typeof value !== "string") {
    throw validationError(`${key} is required`);
  }

  return value;
}

export function parseRegisterInput(body: unknown): RegisterInput {
  const obj = asObject(body);
  const username = requireString(obj, "username").trim();
  const email = requireString(obj, "email").trim();
  const password = requireString(obj, "password");

  if (username.length < USERNAME_MIN || username.length > USERNAME_MAX) {
    throw validationError(
      `username must be between ${USERNAME_MIN} and ${USERNAME_MAX} characters`,
    );
  }

  if (email.length > EMAIL_MAX || !EMAIL_PATTERN.test(email)) {
    throw validationError("email must be a valid email address");
  }

  if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
    throw validationError(
      `password must be between ${PASSWORD_MIN} and ${PASSWORD_MAX} characters`,
    );
  }

  return { username, email, password };
}

export function parseLoginInput(body: unknown): LoginInput {
  const obj = asObject(body);
  const identifier = requireString(obj, "identifier").trim();
  const password = requireString(obj, "password");

  if (identifier.length === 0) {
    throw validationError("identifier is required");
  }

  if (password.length === 0) {
    throw validationError("password is required");
  }

  return { identifier, password };
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

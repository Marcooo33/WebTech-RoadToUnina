import ms from "ms";
import type { StringValue } from "ms";

export interface Env {
  DATABASE_URL: string;
  PORT: number;
  NODE_ENV: "development" | "test" | "production";
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  E2E_FAKE_WIKIPEDIA: "0" | "1";
}

type RawEnv = Record<string, string | undefined>;

const JWT_SECRET_MIN_LENGTH = 32;

function fail(reason: string): never {
  throw new Error(`Invalid environment configuration: ${reason}`);
}

function requiredString(raw: RawEnv, name: string): string {
  const value = raw[name];

  if (value === undefined || value.trim() === "") {
    fail(`${name} is required`);
  }

  return value;
}

function parsePort(value: string | undefined): number {
  if (value === undefined || value === "") {
    return 3000;
  }

  const port = Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    fail(`PORT must be an integer between 1 and 65535 (received "${value}")`);
  }

  return port;
}

function parseNodeEnv(value: string | undefined): Env["NODE_ENV"] {
  if (value === undefined || value === "") {
    return "development";
  }

  if (value === "development" || value === "test" || value === "production") {
    return value;
  }

  fail(
    `NODE_ENV must be one of development, test, production (received "${value}")`,
  );
}

function parseJwtSecret(raw: RawEnv): string {
  const value = requiredString(raw, "JWT_SECRET");

  if (value.length < JWT_SECRET_MIN_LENGTH) {
    fail(`JWT_SECRET must be at least ${JWT_SECRET_MIN_LENGTH} characters`);
  }

  return value;
}

function parseJwtExpiresIn(value: string | undefined): string {
  if (value === undefined || value === "") {
    return "8h";
  }

  const duration = ms(value as StringValue);

  if (typeof duration !== "number" || !Number.isFinite(duration) || duration <= 0) {
    fail(
      `JWT_EXPIRES_IN must be a positive duration such as "8h", "1d" or "60" (received "${value}")`,
    );
  }

  return value;
}

function parseFlag(value: string | undefined, name: string): "0" | "1" {
  if (value === undefined || value === "") {
    return "0";
  }

  if (value === "0" || value === "1") {
    return value;
  }

  fail(`${name} must be "0" or "1" (received "${value}")`);
}

/**
 * Validates process environment at startup and returns a fully typed config.
 * Missing or malformed values throw immediately so the server never boots in a
 * half-configured state. `E2E_FAKE_WIKIPEDIA` is test-only (see server.ts).
 */
export function parseEnv(raw: RawEnv): Env {
  return {
    DATABASE_URL: requiredString(raw, "DATABASE_URL"),
    PORT: parsePort(raw.PORT),
    NODE_ENV: parseNodeEnv(raw.NODE_ENV),
    JWT_SECRET: parseJwtSecret(raw),
    JWT_EXPIRES_IN: parseJwtExpiresIn(raw.JWT_EXPIRES_IN),
    E2E_FAKE_WIKIPEDIA: parseFlag(raw.E2E_FAKE_WIKIPEDIA, "E2E_FAKE_WIKIPEDIA"),
  };
}

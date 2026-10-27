import ms from "ms";
import type { StringValue } from "ms";

export interface Env {
  DATABASE_URL: string;
  PORT: number;
  NODE_ENV: "development" | "test" | "production";
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  E2E_FAKE_WIKIPEDIA: "0" | "1";
  PUBLIC_ORIGIN?: string;
  TRUST_PROXY_HOPS: number;
  SERVE_FRONTEND: "0" | "1";
  DB_HEALTH_SECRET?: string;
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

  if (
    typeof duration !== "number" ||
    !Number.isFinite(duration) ||
    duration <= 0
  ) {
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

/** Validates the environment at startup; throws on missing or malformed values. */
export function parseEnv(raw: RawEnv): Env {
  const nodeEnv = parseNodeEnv(raw.NODE_ENV);
  const fakeWikipedia = parseFlag(raw.E2E_FAKE_WIKIPEDIA, "E2E_FAKE_WIKIPEDIA");
  if (nodeEnv === "production" && fakeWikipedia === "1") {
    fail("E2E_FAKE_WIKIPEDIA cannot be enabled in production");
  }
  const publicOrigin =
    raw.PUBLIC_ORIGIN?.trim() || raw.RENDER_EXTERNAL_URL?.trim() || undefined;
  if (publicOrigin) {
    let url: URL;
    try {
      url = new URL(publicOrigin);
    } catch {
      fail("PUBLIC_ORIGIN must be a URL origin");
    }
    if (
      url.origin !== publicOrigin ||
      url.username ||
      url.password ||
      !["http:", "https:"].includes(url.protocol) ||
      (nodeEnv === "production" && url.protocol !== "https:")
    )
      fail(
        "PUBLIC_ORIGIN must be an origin without path; production requires HTTPS",
      );
  } else if (nodeEnv === "production") {
    fail("PUBLIC_ORIGIN or RENDER_EXTERNAL_URL is required in production");
  }
  const proxyHops = Number(raw.TRUST_PROXY_HOPS ?? "0");
  if (!Number.isInteger(proxyHops) || proxyHops < 0 || proxyHops > 5) {
    fail("TRUST_PROXY_HOPS must be an integer between 0 and 5");
  }
  const healthSecret = raw.DB_HEALTH_SECRET?.trim() || undefined;
  if (healthSecret && healthSecret.length < 32) {
    fail("DB_HEALTH_SECRET must be at least 32 characters when configured");
  }
  return {
    DATABASE_URL: requiredString(raw, "DATABASE_URL"),
    PORT: parsePort(raw.PORT),
    NODE_ENV: nodeEnv,
    JWT_SECRET: parseJwtSecret(raw),
    JWT_EXPIRES_IN: parseJwtExpiresIn(raw.JWT_EXPIRES_IN),
    E2E_FAKE_WIKIPEDIA: fakeWikipedia,
    PUBLIC_ORIGIN: publicOrigin,
    TRUST_PROXY_HOPS: proxyHops,
    SERVE_FRONTEND: parseFlag(
      raw.SERVE_FRONTEND ?? (nodeEnv === "production" ? "1" : "0"),
      "SERVE_FRONTEND",
    ),
    DB_HEALTH_SECRET: healthSecret,
  };
}

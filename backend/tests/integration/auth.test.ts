import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import { app } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";

let server: Server;
let baseUrl: string;
const createdUserIds: string[] = [];

interface ErrorBody {
  error?: { code?: string; message?: string };
}

interface ProfileBody {
  id?: string;
  username?: string;
  email?: string;
  avatarUrl?: string | null;
  createdAt?: string;
  passwordHash?: unknown;
  token?: unknown;
}

function unique(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

function parseSetCookie(setCookie: string): {
  name: string;
  value: string;
  attributes: Record<string, string>;
} {
  const [first, ...rest] = setCookie.split(";");
  const [name, value] = first.split("=");

  const attributes: Record<string, string> = {};
  for (const part of rest) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq === -1) {
      attributes[trimmed.toLowerCase()] = "";
    } else {
      attributes[trimmed.slice(0, eq).toLowerCase()] = trimmed.slice(eq + 1);
    }
  }

  return { name, value, attributes };
}

async function post(
  path: string,
  body?: Record<string, string>,
  cookie?: string,
): Promise<{ status: number; body: ProfileBody & ErrorBody; setCookies: string[] }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cookie) {
    headers.Cookie = cookie;
  }

  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  const json = text ? (JSON.parse(text) as ProfileBody & ErrorBody) : {};

  return { status: res.status, body: json, setCookies: res.headers.getSetCookie() };
}

async function register(
  username: string,
  email: string,
  password: string,
): Promise<{ status: number; body: ProfileBody & ErrorBody; setCookies: string[] }> {
  const result = await post("/api/auth/register", { username, email, password });

  if (result.status === 201 && typeof result.body.id === "string") {
    createdUserIds.push(result.body.id);
  }

  return result;
}

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));

  if (createdUserIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }

  await prisma.$disconnect();
});

test("successful registration returns 201, UserProfileDto and an HttpOnly access_token cookie", async () => {
  const username = unique("reg");
  const email = `${username}@example.com`;

  const result = await register(username, email, "password123");

  assert.equal(result.status, 201);
  assert.equal(result.body.username, username);
  assert.equal(result.body.email, email);
  assert.equal(result.body.avatarUrl, null);
  assert.equal(typeof result.body.id, "string");
  assert.equal(typeof result.body.createdAt, "string");
  assert.equal(result.body.passwordHash, undefined);
  assert.equal(result.body.token, undefined);

  assert.equal(result.setCookies.length, 1);
  const cookie = parseSetCookie(result.setCookies[0]);
  assert.equal(cookie.name, "access_token");
  assert.ok(cookie.value.length > 0);
  assert.equal(cookie.attributes.httponly, "");
  assert.equal(cookie.attributes.samesite, "Lax");
  assert.equal(cookie.attributes.path, "/");
  assert.equal(cookie.attributes.secure, undefined);
});

test("registration stores a bcrypt hash, never the plaintext password", async () => {
  const username = unique("hash");
  const email = `${username}@example.com`;
  const password = "password123";

  const result = await register(username, email, password);
  assert.equal(result.status, 201);

  const stored = await prisma.user.findUnique({
    where: { id: result.body.id as string },
  });
  assert.ok(stored);
  assert.notEqual(stored.passwordHash, password);
  assert.match(stored.passwordHash, /^\$2[aby]\$\d{2}\$/);
});

test("duplicate username returns 409 USERNAME_TAKEN", async () => {
  const username = unique("dupuser");
  const first = await register(username, `${username}@example.com`, "password123");
  assert.equal(first.status, 201);

  const second = await register(username, `${unique("other")}@example.com`, "password123");

  assert.equal(second.status, 409);
  assert.equal(second.body.error?.code, "USERNAME_TAKEN");
});

test("duplicate email returns 409 EMAIL_TAKEN", async () => {
  const email = `${unique("dupemail")}@example.com`;
  const first = await register(unique("one"), email, "password123");
  assert.equal(first.status, 201);

  const second = await register(unique("two"), email, "password123");

  assert.equal(second.status, 409);
  assert.equal(second.body.error?.code, "EMAIL_TAKEN");
});

test("login succeeds with the username", async () => {
  const username = unique("loginuser");
  await register(username, `${username}@example.com`, "password123");

  const result = await post("/api/auth/login", {
    identifier: username,
    password: "password123",
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.username, username);
  assert.equal(result.body.passwordHash, undefined);
  assert.equal(result.body.token, undefined);
  assert.equal(result.setCookies.length, 1);
});

test("login succeeds with the email, normalized case-insensitively", async () => {
  const username = unique("loginemail");
  const email = `${unique("MixedCase")}@Example.com`;
  await register(username, email, "password123");

  const result = await post("/api/auth/login", {
    identifier: email.toLowerCase(),
    password: "password123",
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.username, username);
});

test("login with an incorrect password returns 401 INVALID_CREDENTIALS", async () => {
  const username = unique("wrongpw");
  await register(username, `${username}@example.com`, "password123");

  const result = await post("/api/auth/login", {
    identifier: username,
    password: "wrong-password",
  });

  assert.equal(result.status, 401);
  assert.equal(result.body.error?.code, "INVALID_CREDENTIALS");
});

test("login with an unknown identifier returns 401 INVALID_CREDENTIALS", async () => {
  const result = await post("/api/auth/login", {
    identifier: unique("nobody"),
    password: "password123",
  });

  assert.equal(result.status, 401);
  assert.equal(result.body.error?.code, "INVALID_CREDENTIALS");
});

test("GET /api/auth/me returns the authenticated user", async () => {
  const username = unique("me");
  const registerResult = await register(username, `${username}@example.com`, "password123");
  const token = parseSetCookie(registerResult.setCookies[0]).value;

  const res = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Cookie: `access_token=${token}` },
  });
  const body = (await res.json()) as ProfileBody & ErrorBody;

  assert.equal(res.status, 200);
  assert.equal(body.username, username);
  assert.equal(body.passwordHash, undefined);
});

test("GET /api/auth/me without authentication returns 401 AUTHENTICATION_REQUIRED", async () => {
  const res = await fetch(`${baseUrl}/api/auth/me`);
  const body = (await res.json()) as ProfileBody & ErrorBody;

  assert.equal(res.status, 401);
  assert.equal(body.error?.code, "AUTHENTICATION_REQUIRED");
});

test("GET /api/auth/me with an invalid JWT returns 401 AUTHENTICATION_REQUIRED", async () => {
  const res = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Cookie: "access_token=not-a-valid-token" },
  });
  const body = (await res.json()) as ProfileBody & ErrorBody;

  assert.equal(res.status, 401);
  assert.equal(body.error?.code, "AUTHENTICATION_REQUIRED");
});

test("logout returns 204 and clears the access_token cookie", async () => {
  const username = unique("logout");
  const registerResult = await register(username, `${username}@example.com`, "password123");
  const token = parseSetCookie(registerResult.setCookies[0]).value;

  const res = await fetch(`${baseUrl}/api/auth/logout`, {
    method: "POST",
    headers: { Cookie: `access_token=${token}` },
  });

  assert.equal(res.status, 204);

  const setCookies = res.headers.getSetCookie();
  assert.equal(setCookies.length, 1);
  const cleared = parseSetCookie(setCookies[0]);
  assert.equal(cleared.name, "access_token");
  assert.equal(cleared.value, "");
});

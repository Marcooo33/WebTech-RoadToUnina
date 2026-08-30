import { randomUUID } from "node:crypto";
import { expect, type BrowserContext } from "@playwright/test";

export interface TestUser {
  username: string;
  email: string;
  password: string;
}

/** A fresh, collision-free identity. The DB is reset once, so uniqueness per test
 *  is what keeps scenarios independent. */
export function uniqueUser(prefix = "e2e"): TestUser {
  const tag = randomUUID().replace(/-/g, "").slice(0, 12);
  return {
    username: `${prefix}_${tag}`,
    email: `${prefix}_${tag}@example.test`,
    password: "e2e-Password-123",
  };
}

/**
 * Register `user` through the API client bound to `context`, so the HttpOnly
 * `access_token` cookie lands in that BrowserContext's jar and every page it
 * opens is authenticated. Returns nothing useful beyond that side effect.
 */
export async function registerInContext(
  context: BrowserContext,
  user: TestUser,
): Promise<void> {
  const response = await context.request.post("/api/auth/register", {
    data: { username: user.username, email: user.email, password: user.password },
  });
  expect(
    response.ok(),
    `register failed: ${response.status()} ${await response.text()}`,
  ).toBeTruthy();
}

export async function loginInContext(
  context: BrowserContext,
  user: TestUser,
): Promise<void> {
  const response = await context.request.post("/api/auth/login", {
    data: { identifier: user.username, password: user.password },
  });
  expect(response.ok(), `login failed: ${response.status()}`).toBeTruthy();
}

/** Only `id` is consumed by the specs; the API returns a full GameDto. */
export interface SeededGame {
  id: string;
}

export async function createGameInContext(
  context: BrowserContext,
  mode: "CLICK" | "TIME",
  difficulty: "EASY" | "MEDIUM" | "HARD",
): Promise<SeededGame> {
  const response = await context.request.post("/api/games", {
    data: { mode, difficulty },
  });
  expect(
    response.status(),
    `create game failed: ${await response.text()}`,
  ).toBe(201);
  return (await response.json()) as SeededGame;
}

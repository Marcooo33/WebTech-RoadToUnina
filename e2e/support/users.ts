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

/** Registers `user` via the API so the auth cookie lands in `context`'s jar. */
export async function registerInContext(
  context: BrowserContext,
  user: TestUser,
): Promise<void> {
  const response = await context.request.post("/api/auth/register", {
    headers: { "X-Requested-With": "ROADTOUNINA" },
    data: {
      username: user.username,
      email: user.email,
      password: user.password,
    },
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
    headers: { "X-Requested-With": "ROADTOUNINA" },
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

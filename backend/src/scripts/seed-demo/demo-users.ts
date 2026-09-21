/**
 * Demo accounts created by the production demo seed.
 *
 * Plaintext passwords exist only as these two constants and are hashed with the
 * application's own `hashPassword` (bcrypt, cost 12) before any row is built —
 * no database row object ever carries a plaintext password field.
 *
 * Usernames and emails must satisfy the real registration rules from
 * `modules/auth/auth.validation.ts` (username 3-30 chars, email matching
 * `EMAIL_PATTERN` and at most 255 chars). The seed re-checks them.
 */

export const DEMO_PASSWORD = "12345678";
export const BOT_PASSWORD = "RoadToUninaDemo26!";

export interface DemoUser {
  readonly username: string;
  readonly email: string;
  /** The presentation account. Exactly one user is flagged. */
  readonly isPresentationAccount: boolean;
}

const BOT_USERNAMES = [
  "alex",
  "giulia",
  "lorenzo",
  "sara",
  "davide",
  "chiara",
  "matteo",
  "elena",
  "simone",
  "valentina",
] as const;

export const DEMO_USERS: readonly DemoUser[] = [
  {
    username: "demo",
    email: "demo@roadtounina.local",
    isPresentationAccount: true,
  },
  ...BOT_USERNAMES.map((username) => ({
    username,
    email: `${username}@roadtounina.local`,
    isPresentationAccount: false,
  })),
];

export const PRESENTATION_USERNAME = "demo";

export function passwordFor(user: DemoUser): string {
  return user.isPresentationAccount ? DEMO_PASSWORD : BOT_PASSWORD;
}

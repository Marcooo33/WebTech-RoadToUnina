import ms from "ms";
import type { StringValue } from "ms";
import { z } from "zod";

function isPositiveDuration(value: string): boolean {
  const duration = ms(value as StringValue);

  return typeof duration === "number" && Number.isFinite(duration) && duration > 0;
}

const jwtExpiresInSchema = z
  .string()
  .min(1)
  .default("8h")
  .refine(isPositiveDuration, {
    message: 'JWT_EXPIRES_IN must be a valid duration (e.g. "8h", "1d", "60")',
  });

export const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN: jwtExpiresInSchema,
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(raw: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(raw);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("\n- ");

    throw new Error(`Invalid environment configuration:\n- ${details}`);
  }

  return result.data;
}

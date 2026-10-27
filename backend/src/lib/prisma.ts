import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { env } from "../config/env.loader.js";

const adapter = new PrismaPg({
  connectionString: env.DATABASE_URL,
  // Bound unavailable database connection attempts; normal query execution is
  // unchanged and the pool can establish fresh connections after recovery.
  connectionTimeoutMillis: 5_000,
});

export const prisma = new PrismaClient({ adapter });

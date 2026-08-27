import { app } from "./app.js";
import { env } from "./config/env.loader.js";
import { prisma } from "./lib/prisma.js";

async function main(): Promise<void> {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    console.error(
      "Failed to connect to the database. Verify the DATABASE_URL configuration.",
    );
    process.exit(1);
  }

  const server = app.listen(env.PORT, () => {
    console.log(`Server listening on http://localhost:${env.PORT}`);
  });

  const shutdown = (signal: string): void => {
    console.log(`\n${signal} received, shutting down...`);
    server.close(() => {
      prisma
        .$disconnect()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
    });
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

void main();

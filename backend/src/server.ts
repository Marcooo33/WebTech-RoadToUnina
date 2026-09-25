import { createApp } from "./app.js";
import { env } from "./config/env.loader.js";
import { prisma } from "./lib/prisma.js";
import { createE2EWikipediaService } from "./testing/e2e-wikipedia.js";

// Composition root: in the Playwright E2E environment the live MediaWiki
// integration is replaced by the deterministic fixture adapter. This is the only
// place that decision is made.
const app =
  env.E2E_FAKE_WIKIPEDIA === "1"
    ? createApp({ wikipediaService: createE2EWikipediaService() })
    : createApp();

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

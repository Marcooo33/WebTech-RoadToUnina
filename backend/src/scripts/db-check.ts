import { prisma } from "../lib/prisma.js";

async function main(): Promise<void> {
  await prisma.$queryRaw`SELECT 1`;
  console.log("Database connection OK");
}

main()
  .then(() => prisma.$disconnect())
  .then(() => process.exit(0))
  .catch(() => {
    console.error(
      "Database connection failed. Verify the DATABASE_URL configuration.",
    );
    process.exit(1);
  });

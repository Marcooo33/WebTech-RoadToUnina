// Single entry point for the backend integration suite:
//
//   start the local PostgreSQL test container (shared with the E2E suite)
//   -> ensure the roadtounina_integration database exists
//   -> apply Prisma migrations to it
//   -> run the integration tests against it
//
// The container is the one defined in e2e/docker-compose.yml (host port 55432).
// The E2E suite uses database `roadtounina_e2e` in that same instance; this
// suite uses `roadtounina_integration`. They never share data.
//
// The container is left running afterwards for fast iteration; stop it with
// `npm run test:integration:down` (or `cd e2e && npm run db:down`).
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const composeFile = path.resolve(here, "..", "..", "e2e", "docker-compose.yml");
const prepareScript = path.join(here, "prepare-integration-db.ts");
const setupScript = pathToFileURL(path.join(here, "setup.ts")).href;

// TEST_DATABASE gates the safety guard in tests/support/db.ts.
const env = { ...process.env, TEST_DATABASE: "integration" };

function run(command, args, extra = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", shell: false, env, ...extra });
  return result.status ?? 1;
}

const dockerArgs = ["compose", "-f", composeFile];

let exitCode = run("docker", [...dockerArgs, "up", "-d", "--wait"]);
if (exitCode !== 0) {
  console.error("\nFailed to start the local PostgreSQL test container (docker compose up).");
  process.exit(exitCode);
}

exitCode = run("node", ["--import", "tsx", prepareScript]);
if (exitCode !== 0) {
  process.exit(exitCode);
}

// Extra CLI args select specific files, e.g.
//   npm run test:integration -- tests/integration/auth.test.ts
const testTargets = process.argv.slice(2);
exitCode = run("node", [
  "--import",
  "tsx",
  "--import",
  setupScript,
  "--test",
  ...(testTargets.length > 0 ? testTargets : ["tests/**/*.test.ts"]),
]);

process.exit(exitCode);

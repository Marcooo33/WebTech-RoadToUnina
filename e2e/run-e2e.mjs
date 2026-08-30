// Single entry point for the E2E suite: bring the throwaway database up, run
// Playwright, and always tear it down again — even when `docker compose up`
// itself fails after partially creating the container, and even on a non-zero
// Playwright exit. If the process is hard-killed (SIGKILL) the container/volume
// may survive; `npm run db:down` is the documented recovery command.
import { spawnSync } from "node:child_process";

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit", shell: false });
  return result.status ?? 1;
}

let exitCode = 0;

try {
  const upStatus = run("docker", ["compose", "up", "-d", "--wait"]);
  if (upStatus !== 0) {
    console.error("\nFailed to start the E2E database (docker compose up).");
    exitCode = upStatus;
  } else {
    exitCode = run("npx", ["playwright", "test", ...process.argv.slice(2)]);
  }
} finally {
  // `down -v` is safe to run whether or not anything came up.
  const downStatus = run("docker", ["compose", "down", "-v"]);
  if (downStatus !== 0) {
    console.error(
      "\nWarning: could not stop the E2E database. Run `npm run db:down` to clean up.",
    );
    if (exitCode === 0) {
      exitCode = downStatus;
    }
  }
}

process.exit(exitCode);

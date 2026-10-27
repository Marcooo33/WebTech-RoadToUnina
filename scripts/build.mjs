import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repositoryRoot = new URL("../", import.meta.url);
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

function run(directory, args) {
  const result = spawnSync(npm, args, {
    cwd: fileURLToPath(new URL(`${directory}/`, repositoryRoot)),
    env: process.env,
    stdio: "inherit",
    shell: false,
  });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) process.exit(result.status ?? 1);
}

// Build tools are required even when Render sets NODE_ENV=production.
run("frontend", ["ci", "--include=dev"]);
run("backend", ["ci", "--include=dev"]);
run("frontend", ["run", "build"]);
run("backend", ["run", "prisma:generate"]);
run("backend", ["run", "build"]);
// Deliberately no database connection, migrations or server startup here.

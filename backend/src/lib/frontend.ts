import { existsSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import express, { type Express } from "express";

// Both src/lib and dist/lib are two levels below backend/.
export const frontendDirectory = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../frontend/dist/frontend/browser",
);

export function serveFrontend(app: Express, directory: string): void {
  const indexFile = resolve(directory, "index.html");
  if (!existsSync(indexFile)) {
    throw new Error("Angular build missing. Run node scripts/build.mjs before starting production.");
  }

  app.use(express.static(directory, {
    index: false,
    redirect: false,
    dotfiles: "ignore",
    setHeaders(res, file) {
      const hashedBundle = /-[\w-]{8,}\.(?:js|css)$/.test(file);
      res.setHeader("Cache-Control", file === indexFile
        ? "no-cache"
        : hashedBundle
          ? "public, max-age=31536000, immutable"
          : "public, max-age=3600");
    },
  }));

  // API 404s must be mounted before this. Missing assets and dotfiles stay 404s.
  app.use((req, res, next) => {
    if (
      !["GET", "HEAD"].includes(req.method) ||
      !req.accepts("html") ||
      extname(req.path) ||
      req.path.split("/").some((segment) => segment.startsWith("."))
    ) {
      next();
      return;
    }
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(indexFile);
  });
}

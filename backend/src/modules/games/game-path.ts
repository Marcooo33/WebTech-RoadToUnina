import type { PageRefDto } from "./games.types.js";

export interface ActivePathMove {
  type: "NAVIGATION" | "BACKTRACK";
  toPageId: number;
  toPageTitle: string;
}

export function reconstructActivePath(
  start: PageRefDto,
  moves: ActivePathMove[],
): PageRefDto[] {
  const path: PageRefDto[] = [{ pageId: start.pageId, title: start.title }];

  for (const move of moves) {
    if (move.type === "NAVIGATION") {
      path.push({ pageId: move.toPageId, title: move.toPageTitle });
      continue;
    }

    if (path.length > 1) {
      path.pop();
    }
  }

  return path;
}

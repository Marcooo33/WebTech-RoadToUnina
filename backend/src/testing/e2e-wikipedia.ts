import { normalizeMediaWikiTitle } from "../modules/wikipedia/wikipedia.validation.js";
import { TARGET_PAGE_ID, TARGET_PAGE_TITLE } from "../config/game.js";
import type {
  NormalizedArticle,
  PlayableLink,
  WikipediaArticleSource,
} from "../modules/wikipedia/wikipedia.types.js";

/**
 * Deterministic in-memory Wikipedia used by the Playwright E2E suite (see
 * `e2e/`). It is selected only by the composition root (`server.ts`) when
 * `E2E_FAKE_WIKIPEDIA=1`; no domain or application code branches on it.
 *
 * This module is the single source of truth for the fixture page graph. The E2E
 * tests only hard-code the handful of ids/titles they assert on
 * (`e2e/support/constants.ts`); they do not redefine the graph.
 *
 * Graph (every game starts on {@link E2E_START_PAGE_ID}):
 *
 *   4100 Partenope (sirena)  -> 4101, 4102, 4103
 *   4101 Golfo di Napoli     -> 4102, 4104, 4100
 *   4102 Storia di Napoli    -> 4104, 4105
 *   4103 Magna Grecia        -> 4105
 *   4104 Napoli              -> 4105, TARGET
 *   4105 Campania            -> 4104, 4101
 *   TARGET                   -> 4104
 *
 * Notable paths:
 * - shortest win: 4100 -> 4101 -> 4104 -> TARGET (3 navigation clicks);
 * - MEDIUM backtrack limit: 4100 -> 4101 -> 4102 -> 4104 -> 4105, then backtrack
 *   x3 (-> 4104 -> 4102 -> 4101); a 4th backtrack is BACKTRACK_LIMIT_REACHED,
 *   distinct from "already at the starting page".
 */
export const E2E_START_PAGE_ID = 4100;

interface FixturePage {
  title: string;
  links: number[];
}

const PAGES = new Map<number, FixturePage>([
  [4100, { title: "Partenope (sirena)", links: [4101, 4102, 4103] }],
  [4101, { title: "Golfo di Napoli", links: [4102, 4104, 4100] }],
  [4102, { title: "Storia di Napoli", links: [4104, 4105] }],
  [4103, { title: "Magna Grecia", links: [4105] }],
  [4104, { title: "Napoli", links: [4105, TARGET_PAGE_ID] }],
  [4105, { title: "Campania", links: [4104, 4101] }],
  [TARGET_PAGE_ID, { title: TARGET_PAGE_TITLE, links: [4104] }],
]);

function titleOf(pageId: number): string {
  return PAGES.get(pageId)?.title ?? `Pagina ${pageId}`;
}

function linksOf(pageId: number): PlayableLink[] {
  const page = PAGES.get(pageId);
  if (!page) {
    return [];
  }
  return page.links.map((id) => ({ title: titleOf(id) }));
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Mirrors the shape produced by the real article parser: playable links
// are <a data-page-title> anchors with no href, so the Angular
// article renderer turns them into game actions.
function renderContentHtml(pageId: number): string {
  const title = titleOf(pageId);
  const links = linksOf(pageId);

  const anchors = links
    .map(
      (link) =>
        `<a data-page-title="${escapeHtml(
          link.title,
        )}">${escapeHtml(link.title)}</a>`,
    )
    .join(", ");

  const body =
    links.length > 0
      ? `<p>${escapeHtml(
          title,
        )} è una pagina della Wikipedia di prova per ROADTOUNINA. Da qui puoi raggiungere: ${anchors}.</p>`
      : `<p>${escapeHtml(title)} è una pagina della Wikipedia di prova per ROADTOUNINA.</p>`;

  return body;
}

export function createE2EWikipediaService(): WikipediaArticleSource {
  return {
    async getStartingPage() {
      return { pageId: E2E_START_PAGE_ID, title: titleOf(E2E_START_PAGE_ID) };
    },

    async getArticle(pageId: number): Promise<NormalizedArticle> {
      return {
        pageId,
        title: titleOf(pageId),
        contentHtml: renderContentHtml(pageId),
        links: linksOf(pageId),
      };
    },

    async resolveNavigation(pageId: number, toTitle: string) {
      const title = normalizeMediaWikiTitle(toTitle);
      if (!linksOf(pageId).some((link) => link.title === title)) return null;
      const target = [...PAGES].find(([, page]) => page.title === title);
      return target ? { pageId: target[0], title: target[1].title } : null;
    },
  };
}

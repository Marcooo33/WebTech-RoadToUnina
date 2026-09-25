import { TARGET_PAGE_ID } from "../../config/game.js";
import { normalizeArticle } from "./article-parser.js";
import { MediaWikiClient, type ParsedPage } from "./mediawiki.client.js";
import { WikipediaError } from "./wikipedia.errors.js";
import { normalizeMediaWikiTitle } from "./wikipedia.validation.js";
import type {
  NormalizedArticle,
  WikipediaArticleSource,
  WikipediaPageIdentity,
} from "./wikipedia.types.js";

// A starting page must be a real article, not a stub with nowhere to go.
const RANDOM_CANDIDATES = 10;
const MIN_START_LENGTH_BYTES = 500;
const MIN_START_LINKS = 5;

// Every move reads the current article (to validate the link) and the
// destination: without a cache each move costs ~3 MediaWiki requests, enough
// to hit its rate limit with a handful of concurrent players.
const CACHE_SIZE = 100;
const CACHE_TTL_MS = 10 * 60_000;

export class WikipediaService implements WikipediaArticleSource {
  private readonly cache = new Map<
    number,
    { article: NormalizedArticle; expiresAt: number }
  >();

  constructor(private readonly client = new MediaWikiClient()) {}

  async getStartingPage(): Promise<WikipediaPageIdentity> {
    const candidates = await this.client.randomPages(RANDOM_CANDIDATES);
    for (const candidate of candidates) {
      if (
        candidate.pageId === TARGET_PAGE_ID ||
        candidate.length < MIN_START_LENGTH_BYTES
      ) {
        continue;
      }
      const article = await this.getArticle(candidate.pageId);
      if (article.links.length >= MIN_START_LINKS) {
        return { pageId: article.pageId, title: article.title };
      }
    }
    throw new WikipediaError(
      "NO_SUITABLE_STARTING_PAGE",
      "No suitable starting page among the random candidates",
    );
  }

  async getArticle(pageId: number): Promise<NormalizedArticle> {
    const cached = this.cache.get(pageId);
    if (cached && cached.expiresAt > Date.now()) return cached.article;

    const page = await this.client.parse({ pageId });
    if (page === null) {
      throw new WikipediaError("PAGE_NOT_FOUND", `Article ${pageId} not found`);
    }
    return this.remember(page);
  }

  async resolveNavigation(
    fromPageId: number,
    toTitle: string,
  ): Promise<WikipediaPageIdentity | null> {
    const title = normalizeMediaWikiTitle(toTitle);
    const current = await this.getArticle(fromPageId);
    if (!current.links.some((link) => link.title === title)) return null;

    // Loading the destination here (following redirects) guarantees a move is
    // never persisted towards an article that cannot be loaded, and warms the
    // cache for the article the player sees next.
    const destination = await this.client.parse({ title: title! });
    if (destination === null) return null;
    const article = this.remember(destination);
    return { pageId: article.pageId, title: article.title };
  }

  // Normalizes a parsed page and caches it, evicting the oldest entry.
  private remember(page: ParsedPage): NormalizedArticle {
    const article = normalizeArticle(
      { pageId: page.pageId, title: page.title },
      page.html,
      page.linkTitles,
    );
    this.cache.delete(page.pageId);
    if (this.cache.size >= CACHE_SIZE) {
      this.cache.delete(this.cache.keys().next().value!);
    }
    this.cache.set(page.pageId, { article, expiresAt: Date.now() + CACHE_TTL_MS });
    return article;
  }
}

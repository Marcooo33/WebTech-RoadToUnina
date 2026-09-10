import { TARGET_PAGE_ID } from "../../config/game.js";
import { ArticleParserService } from "./article-parser.service.js";
import { MediaWikiClient } from "./mediawiki.client.js";
import { WikipediaError } from "./wikipedia.errors.js";
import { normalizeMediaWikiTitle } from "./wikipedia.validation.js";
import type {
  NormalizedArticle,
  WikipediaArticleSource,
  WikipediaPageIdentity,
} from "./wikipedia.types.js";

export interface StartingPageFilterConfig {
  minArticleLengthBytes: number;
  minEligibleLinks: number;
  maxRandomAttempts: number;
}

export const DEFAULT_STARTING_PAGE_FILTER: StartingPageFilterConfig = {
  minArticleLengthBytes: 500,
  minEligibleLinks: 5,
  maxRandomAttempts: 10,
};

export interface WikipediaServiceOptions {
  client?: MediaWikiClient;
  parser?: ArticleParserService;
  startingPageFilter?: StartingPageFilterConfig;
}

const ARTICLE_CACHE_SIZE = 32;
const ARTICLE_CACHE_TTL_MS = 60_000;

export class WikipediaService implements WikipediaArticleSource {
  private readonly client: MediaWikiClient;
  private readonly parser: ArticleParserService;
  private readonly filter: StartingPageFilterConfig;
  // One bounded cache also shares in-flight loads. Failed loads are removed.
  private readonly articles = new Map<
    number,
    {
      expiresAt: number;
      article: Promise<NormalizedArticle>;
    }
  >();

  constructor(options: WikipediaServiceOptions = {}) {
    this.client = options.client ?? new MediaWikiClient();
    this.parser = options.parser ?? new ArticleParserService();
    this.filter = options.startingPageFilter ?? DEFAULT_STARTING_PAGE_FILTER;
  }

  async getArticle(pageId: number): Promise<NormalizedArticle> {
    const cached = this.articles.get(pageId);
    if (cached && cached.expiresAt > Date.now()) {
      this.articles.delete(pageId);
      this.articles.set(pageId, cached);
      return structuredClone(await cached.article);
    }
    return structuredClone(
      await this.cacheArticle(pageId, this.loadArticle(pageId)),
    );
  }

  async resolveNavigation(
    fromPageId: number,
    toTitle: string,
  ): Promise<WikipediaPageIdentity | null> {
    const title = normalizeMediaWikiTitle(toTitle);
    if (title === null) return null;
    const article = await this.getArticle(fromPageId);
    if (!article.links.some((link) => link.title === title)) return null;
    // Only the clicked, reachable title is resolved, including redirects.
    return this.client.resolveTitle(title);
  }

  async resolvePage(title: string): Promise<WikipediaPageIdentity | null> {
    return this.client.resolveTitle(title);
  }

  async getRandomStartingPage(): Promise<WikipediaPageIdentity> {
    const seen = new Set<number>();
    for (
      let attempt = 0;
      attempt < this.filter.maxRandomAttempts;
      attempt += 1
    ) {
      const [candidate] = await this.client.getRandomArticles(1);
      if (
        !candidate ||
        candidate.id === TARGET_PAGE_ID ||
        seen.has(candidate.id)
      )
        continue;
      seen.add(candidate.id);
      const info = await this.client.getPageInfo(candidate.id);
      // Recheck redirects: the page may have changed since list=random.
      if (
        info.redirect ||
        info.pageId === TARGET_PAGE_ID ||
        info.length === undefined ||
        info.length < this.filter.minArticleLengthBytes
      )
        continue;
      const article = await this.cacheArticle(
        info.pageId,
        this.loadArticle(info.pageId, info),
      );
      if (article.links.length >= this.filter.minEligibleLinks) {
        return { pageId: article.pageId, title: article.title };
      }
    }
    throw new WikipediaError(
      "NO_SUITABLE_STARTING_PAGE",
      "No suitable starting page found after the maximum number of attempts",
    );
  }

  private cacheArticle(
    pageId: number,
    article: Promise<NormalizedArticle>,
  ): Promise<NormalizedArticle> {
    const entry = { expiresAt: Date.now() + ARTICLE_CACHE_TTL_MS, article };
    this.articles.delete(pageId);
    this.articles.set(pageId, entry);
    if (this.articles.size > ARTICLE_CACHE_SIZE) {
      this.articles.delete(this.articles.keys().next().value!);
    }
    void article.then(
      () => {
        entry.expiresAt = Date.now() + ARTICLE_CACHE_TTL_MS;
      },
      () => {
        if (this.articles.get(pageId) === entry) this.articles.delete(pageId);
      },
    );
    return article;
  }

  private async loadArticle(
    pageId: number,
    info?: Awaited<ReturnType<MediaWikiClient["getPageInfo"]>>,
  ): Promise<NormalizedArticle> {
    const page = info ?? (await this.client.getPageInfo(pageId));
    if (page.redirect) {
      throw new WikipediaError(
        "PAGE_NOT_FOUND",
        "The stored article is now a redirect",
      );
    }
    const parsed = await this.client.getArticleHtml(pageId);
    if (parsed.title !== page.title) {
      throw new WikipediaError(
        "INVALID_RESPONSE",
        "Article changed while loading",
      );
    }
    return this.parser.normalize({ pageId, title: parsed.title }, parsed.html);
  }
}

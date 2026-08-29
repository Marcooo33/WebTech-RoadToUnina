import { TARGET_PAGE_ID } from "../../config/game.js";
import { ArticleParserService } from "./article-parser.service.js";
import { MediaWikiClient } from "./mediawiki.client.js";
import { WikipediaError } from "./wikipedia.errors.js";
import {
  isValidMediaWikiPageId,
  normalizeMediaWikiTitle,
} from "./wikipedia.validation.js";
import type {
  MediaWikiLink,
  MediaWikiRandomItem,
  NormalizedArticle,
  PlayableLink,
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

function isValidRandomCandidate(candidate: MediaWikiRandomItem): boolean {
  return (
    isValidMediaWikiPageId(candidate.id) &&
    candidate.ns === 0 &&
    normalizeMediaWikiTitle(candidate.title) !== null
  );
}

function hasSuitableArticleLength(
  length: unknown,
  minArticleLengthBytes: number,
): boolean {
  return (
    typeof length === "number" &&
    Number.isFinite(length) &&
    Number.isInteger(length) &&
    length >= minArticleLengthBytes
  );
}

export class WikipediaService {
  private readonly client: MediaWikiClient;
  private readonly parser: ArticleParserService;
  private readonly filter: StartingPageFilterConfig;

  constructor(options: WikipediaServiceOptions = {}) {
    this.client = options.client ?? new MediaWikiClient();
    this.parser = options.parser ?? new ArticleParserService();
    this.filter = options.startingPageFilter ?? DEFAULT_STARTING_PAGE_FILTER;
  }

  async getArticle(pageId: number): Promise<NormalizedArticle> {
    const article = await this.resolveArticle(pageId);

    return this.parser.normalize(
      { pageId: article.pageId, title: article.title },
      article.html,
      article.playableLinks,
    );
  }

  async getValidInternalLinks(pageId: number): Promise<PlayableLink[]> {
    const article = await this.resolveArticle(pageId);
    return article.playableLinks.map(({ pageId: resolvedPageId, title }) => ({
      pageId: resolvedPageId,
      title,
    }));
  }

  async isValidNavigation(
    fromPageId: number,
    targetPageId: number,
  ): Promise<boolean> {
    const links = await this.getValidInternalLinks(fromPageId);
    return links.some((link) => link.pageId === targetPageId);
  }

  async getRandomStartingPage(): Promise<WikipediaPageIdentity> {
    for (let attempt = 0; attempt < this.filter.maxRandomAttempts; attempt += 1) {
      const candidates = await this.client.getRandomArticles(1);
      const candidate = candidates[0];

      if (!candidate) {
        continue;
      }

      if (!isValidRandomCandidate(candidate)) {
        continue;
      }

      const title = normalizeMediaWikiTitle(candidate.title);
      if (title === null) {
        continue;
      }

      const canonical = await this.resolveCandidate(title, candidate.id);

      if (canonical === null) {
        continue;
      }

      if (canonical.pageId === TARGET_PAGE_ID) {
        continue;
      }

      if (await this.isSuitableStartingPage(canonical)) {
        return canonical;
      }
    }

    throw new WikipediaError(
      "NO_SUITABLE_STARTING_PAGE",
      "No suitable starting page found after the maximum number of attempts",
    );
  }

  async resolvePage(title: string): Promise<WikipediaPageIdentity | null> {
    return this.client.resolveTitle(title);
  }

  private async resolveCandidate(
    title: string,
    directPageId: number,
  ): Promise<WikipediaPageIdentity | null> {
    const resolutions = await this.client.resolveTitles([
      { pageId: directPageId, title },
    ]);
    const resolution = resolutions.get(title);

    if (!resolution || resolution.kind === "UNRESOLVED") {
      return null;
    }

    return resolution.canonical;
  }

  // Single authoritative derivation of an article's playable links: fetch the
  // HTML and raw links, apply contextual filtering, then canonical resolution.
  // Article rendering, navigation validation and starting-page eligibility all
  // consume this same result so the meaning of "playable link" never diverges.
  private async resolveArticle(pageId: number): Promise<{
    pageId: number;
    title: string;
    html: string;
    length?: number;
    playableLinks: PlayableLink[];
  }> {
    const [html, links] = await Promise.all([
      this.client.getArticleHtml(pageId),
      this.client.getArticleLinks(pageId),
    ]);

    const playableLinks = await this.resolvePlayableLinks(links.links, html.html);

    return {
      pageId: links.pageId,
      title: links.title,
      html: html.html,
      length: links.length,
      playableLinks,
    };
  }

  private async resolvePlayableLinks(
    links: MediaWikiLink[],
    html: string,
  ): Promise<PlayableLink[]> {
    const sourceById = new Map<string, number>();

    for (const link of links) {
      if (link.ns !== 0 || !isValidMediaWikiPageId(link.pageid)) {
        continue;
      }

      const title = normalizeMediaWikiTitle(link.title);
      if (title === null || sourceById.has(title)) {
        continue;
      }
      sourceById.set(title, link.pageid);
    }

    const playableTitles = this.parser.collectPlayableTitles(html);

    const sources: { pageId: number; title: string }[] = [];
    for (const title of playableTitles) {
      const pageId = sourceById.get(title);
      if (pageId === undefined) {
        continue;
      }
      sources.push({ pageId, title });
    }

    return this.resolveSources(sources);
  }

  private async resolveSources(
    sources: { pageId: number; title: string }[],
  ): Promise<PlayableLink[]> {
    const resolutions = await this.client.resolveTitles(sources);

    const playable: PlayableLink[] = [];

    for (const source of sources) {
      const resolution = resolutions.get(source.title);

      // Fail closed: a link without a trustworthy canonical identity is
      // excluded rather than falling back to a redirect's own id/title.
      if (!resolution || resolution.kind === "UNRESOLVED") {
        continue;
      }

      playable.push({
        pageId: resolution.canonical.pageId,
        title: resolution.canonical.title,
        sourceTitle: source.title,
      });
    }

    return playable;
  }

  private async isSuitableStartingPage(
    candidate: WikipediaPageIdentity,
  ): Promise<boolean> {
    const article = await this.resolveArticle(candidate.pageId);

    if (!hasSuitableArticleLength(article.length, this.filter.minArticleLengthBytes)) {
      return false;
    }

    return article.playableLinks.length >= this.filter.minEligibleLinks;
  }
}

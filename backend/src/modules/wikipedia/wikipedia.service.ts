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

function toPlayableLinks(links: MediaWikiLink[]): PlayableLink[] {
  const playable: PlayableLink[] = [];

  for (const link of links) {
    if (link.ns !== 0 || !isValidMediaWikiPageId(link.pageid)) {
      continue;
    }

    const title = normalizeMediaWikiTitle(link.title);
    if (title === null) {
      continue;
    }

    playable.push({ pageId: link.pageid, title });
  }

  return playable;
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
    const [html, links] = await Promise.all([
      this.client.getArticleHtml(pageId),
      this.client.getArticleLinks(pageId),
    ]);

    return this.parser.normalize(
      { pageId: links.pageId, title: links.title },
      html.html,
      toPlayableLinks(links.links),
    );
  }

  async getValidInternalLinks(pageId: number): Promise<PlayableLink[]> {
    const links = await this.client.getArticleLinks(pageId);
    return toPlayableLinks(links.links);
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

      const title = normalizeMediaWikiTitle(candidate.title) as string;

      if (await this.isSuitableStartingPage({ id: candidate.id, title })) {
        return { pageId: candidate.id, title };
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

  private async isSuitableStartingPage(candidate: {
    id: number;
    title: string;
  }): Promise<boolean> {
    const links = await this.client.getArticleLinks(candidate.id);

    if (!hasSuitableArticleLength(links.length, this.filter.minArticleLengthBytes)) {
      return false;
    }

    const playable = toPlayableLinks(links.links);
    return playable.length >= this.filter.minEligibleLinks;
  }
}

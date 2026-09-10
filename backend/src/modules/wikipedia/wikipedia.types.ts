export interface WikipediaPageIdentity {
  pageId: number;
  title: string;
}

export interface PlayableLink {
  title: string;
}

export interface NormalizedArticle {
  pageId: number;
  title: string;
  contentHtml: string;
  links: PlayableLink[];
}

// The subset of the Wikipedia integration that the games module depends on: the
// authoritative current article and its playable internal links. `WikipediaService`
// (real MediaWiki) and the deterministic E2E fake both implement this, so the
// composition root can swap them without the games module knowing.
export interface WikipediaArticleSource {
  getArticle(pageId: number): Promise<NormalizedArticle>;
  resolveNavigation(
    fromPageId: number,
    toTitle: string,
  ): Promise<WikipediaPageIdentity | null>;
}

export interface MediaWikiApiError {
  code: string;
  info: string;
}

export interface MediaWikiRedirect {
  from: string;
  to: string;
}

export interface MediaWikiNormalized {
  from: string;
  to: string;
}

export interface MediaWikiPage {
  pageid?: number;
  ns?: number;
  title?: string;
  missing?: boolean;
  length?: number;
  redirect?: boolean;
}

export interface MediaWikiRandomItem {
  id: number;
  ns: number;
  title: string;
}

export interface MediaWikiQueryResponse {
  query?: {
    pages?: MediaWikiPage[];
    random?: MediaWikiRandomItem[];
    redirects?: MediaWikiRedirect[];
    normalized?: MediaWikiNormalized[];
  };
  error?: MediaWikiApiError;
}

export interface MediaWikiParseResponse {
  parse?: {
    pageid: number;
    title: string;
    text?: string | { "*": string };
    redirects?: MediaWikiRedirect[];
  };
  error?: MediaWikiApiError;
}

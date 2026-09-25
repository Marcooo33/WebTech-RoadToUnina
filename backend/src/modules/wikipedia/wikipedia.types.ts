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

// What the games module needs from Wikipedia. `WikipediaService` (real
// MediaWiki) and the deterministic E2E fake both implement it, so the
// composition root can swap them without the games module knowing.
export interface WikipediaArticleSource {
  getStartingPage(): Promise<WikipediaPageIdentity>;
  getArticle(pageId: number): Promise<NormalizedArticle>;
  // Returns the destination only if `toTitle` is a playable link of the
  // current article and exists (redirects are followed).
  resolveNavigation(
    fromPageId: number,
    toTitle: string,
  ): Promise<WikipediaPageIdentity | null>;
}

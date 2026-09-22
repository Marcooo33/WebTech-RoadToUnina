// contentHtml is already sanitized server-side (strict tag allowlist, no href,
// no schemes); playable internal links come as <a data-page-title> elements.
// The client compares pageId against the game's current page and reloads the
// article if they don't match.
export interface ArticleDto {
  gameId: string;
  pageId: number;
  title: string;
  contentHtml: string;
  links: { title: string }[];
}

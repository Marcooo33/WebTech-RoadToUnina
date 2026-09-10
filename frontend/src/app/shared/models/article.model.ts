/**
 * Sanitized current-article representation for the active game (docs/api.md §3.7).
 *
 * `contentHtml` is already normalized/sanitized by the ROADTOUNINA backend
 * (strict tag allowlist, no `href`, no schemes); playable internal links are
 * `<a data-page-title>` elements. The client checks `pageId`
 * against the game's current page and reloads the article if they disagree.
 */
export interface ArticleDto {
  gameId: string;
  pageId: number;
  title: string;
  contentHtml: string;
  links: { title: string }[];
}

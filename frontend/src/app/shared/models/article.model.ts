// contentHtml is sanitized server-side; playable links are <a data-page-title>.
// The client reloads the article if pageId isn't the game's current page.
export interface ArticleDto {
  gameId: string;
  pageId: number;
  title: string;
  contentHtml: string;
  links: { title: string }[];
}

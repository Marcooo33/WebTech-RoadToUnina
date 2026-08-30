import { PageRef, SessionDto } from './game.model';

/**
 * Sanitized current-article representation for the active game (docs/api.md §3.9).
 *
 * `version` mirrors the `Game.version` this article was rendered for; the client
 * uses it as a consistency check and must not render the HTML if the game has
 * moved on. `contentHtml` is already normalized/sanitized by the ROADTOUNINA
 * backend (strict tag allowlist, no `href`, no schemes); playable internal links
 * are `<a data-page-id data-page-title>` elements.
 */
export interface ArticleDto {
  gameId: string;
  pageId: number;
  title: string;
  version: number;
  contentHtml: string;
  links: PageRef[];
}

/**
 * Returned by every session operation so the client stays in sync with the
 * authoritative accumulated timing and game version (docs/api.md §3.8).
 *
 * `effectivePlayTimeMs` is the accumulated total from *previous* (ended/expired)
 * sessions; it does not include the time elapsed in the currently running
 * session. The visual timer must therefore not re-baseline itself from a plain
 * heartbeat response (see docs/api.md §2.11 / §6.2).
 */
export interface SessionResponseDto {
  session: SessionDto;
  effectivePlayTimeMs: number;
  gameVersion: number;
}

import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { SafeHtml } from '@angular/platform-browser';

/**
 * Renders the sanitized current article and turns clicks on playable links into
 * game actions, without ever letting the browser navigate out of ROADTOUNINA
 * (docs/game-rules.md §7–8, docs/architecture.md §9).
 *
 * `html` is a {@link SafeHtml} produced by {@link GamePage} from
 * `ArticleDto.contentHtml`. The trust decision lives there, at the single point
 * that knows the HTML came from our own sanitizing backend.
 *
 * Link handling is delegated: one listener on the container, not one per anchor.
 */
@Component({
  selector: 'app-wikipedia-article',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './wikipedia-article.html',
  styleUrl: './wikipedia-article.css',
})
export class WikipediaArticle {
  readonly title = input.required<string>();
  readonly html = input.required<SafeHtml>();
  /** When true, playable links are inert (a move is already in flight). */
  readonly disabled = input(false);

  /** Emits the MediaWiki `pageId` of a playable link the user activated. */
  readonly navigate = output<number>();

  onClick(event: MouseEvent): void {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    // No anchor in the sanitized content may ever drive real browser navigation,
    // playable or not.
    const anchor = target.closest('a');
    if (anchor) {
      event.preventDefault();
    }

    const playable = target.closest('a[data-page-id]');
    if (!playable) {
      return;
    }

    const raw = playable.getAttribute('data-page-id');
    const pageId = Number(raw);
    if (raw === null || raw.trim() === '' || !Number.isSafeInteger(pageId) || pageId <= 0) {
      return;
    }

    if (this.disabled()) {
      return;
    }

    this.navigate.emit(pageId);
  }
}

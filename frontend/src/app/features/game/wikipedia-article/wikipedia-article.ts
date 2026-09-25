import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  Injector,
  input,
  OnChanges,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { SafeHtml } from '@angular/platform-browser';

interface TocEntry {
  id: string;
  label: string;
  level: number;
}

// Renders the sanitized article and turns clicks on playable links into game
// actions (one delegated listener), never letting the browser navigate away.
@Component({
  selector: 'app-wikipedia-article',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet],
  templateUrl: './wikipedia-article.html',
  styleUrl: './wikipedia-article.css',
})
export class WikipediaArticle implements OnChanges {
  private readonly injector = inject(Injector);
  private readonly articleBody = viewChild.required<ElementRef<HTMLElement>>('articleBody');

  readonly title = input.required<string>();
  readonly html = input.required<SafeHtml>();
  // When true, playable links are inert (a move is already in flight).
  readonly disabled = input(false);

  // Emits the normalized title of the link the user activated.
  readonly navigate = output<string>();
  readonly tocEntries = signal<TocEntry[]>([]);

  ngOnChanges(): void {
    afterNextRender(() => this.rebuildToc(), { injector: this.injector });
  }

  onTocClick(event: MouseEvent, id: string): void {
    event.preventDefault();
    const body = this.articleBody().nativeElement;
    const heading = body.ownerDocument.getElementById(id);
    if (heading && body.contains(heading)) {
      const reducedMotion =
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
      heading.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
    }
  }

  onClick(event: MouseEvent): void {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    // No anchor in the sanitized content should ever trigger real browser
    // navigation, playable or not.
    const anchor = target.closest('a');
    if (anchor) {
      event.preventDefault();
    }

    const playable = target.closest('a[data-page-title]');
    if (!playable) {
      return;
    }

    const title = playable.getAttribute('data-page-title');
    if (title === null || title.trim() === '') {
      return;
    }

    if (this.disabled()) {
      return;
    }

    this.navigate.emit(title);
  }

  private rebuildToc(): void {
    const headings = this.articleBody().nativeElement.querySelectorAll<HTMLElement>(
      'h2[id], h3[id], h4[id], h5[id], h6[id]',
    );
    this.tocEntries.set(
      Array.from(headings, (heading) => ({
        id: heading.id,
        label: heading.textContent?.trim() ?? '',
        level: Number(heading.tagName.slice(1)),
      })).filter((entry) => entry.label !== ''),
    );
  }
}

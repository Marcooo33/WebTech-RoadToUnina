import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  input,
  OnChanges,
  SimpleChanges,
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
  host: { '[attr.aria-busy]': 'disabled()' },
})
export class WikipediaArticle implements OnChanges {
  private readonly injector = inject(Injector);
  private readonly articleBody = viewChild.required<ElementRef<HTMLElement>>('articleBody');
  private readonly articleTitle = viewChild.required<ElementRef<HTMLElement>>('articleTitle');

  readonly title = input.required<string>();
  readonly html = input.required<SafeHtml>();
  // When true, playable links are inert (a move is already in flight).
  readonly disabled = input(false);

  // Emits the normalized title of the link the user activated.
  readonly navigate = output<string>();
  readonly tocEntries = signal<TocEntry[]>([]);

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      if (typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(() => this.updateScrollRegions());
      observer.observe(this.articleBody().nativeElement);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    afterNextRender(
      () => {
        if (changes['html']) {
          this.prepareContent();
          this.rebuildToc();
        }
        this.updatePlayableState();
        this.updateScrollRegions();
      },
      { injector: this.injector },
    );
  }

  focusTitle(): void {
    const heading = this.articleTitle().nativeElement;
    heading.focus({ preventScroll: true });
    heading.scrollIntoView({ behavior: 'instant', block: 'start', inline: 'nearest' });
  }

  onTocClick(event: MouseEvent, id: string): void {
    event.preventDefault();
    const body = this.articleBody().nativeElement;
    const heading = body.ownerDocument.getElementById(id);
    if (heading && body.contains(heading)) {
      for (
        let ancestor = heading.parentElement;
        ancestor && ancestor !== body;
        ancestor = ancestor.parentElement
      ) {
        if (ancestor instanceof HTMLDetailsElement) ancestor.open = true;
      }
      this.updateScrollRegions();
      const reducedMotion =
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
      heading.scrollIntoView({
        behavior: reducedMotion ? 'auto' : 'smooth',
        block: 'start',
        inline: 'nearest',
      });
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

  onAuxClick(event: MouseEvent): void {
    if (event.target instanceof Element && event.target.closest('a')) event.preventDefault();
  }

  private prepareContent(): void {
    const body = this.articleBody().nativeElement;
    for (const anchor of body.querySelectorAll<HTMLAnchorElement>('a[data-page-title]')) {
      if (!anchor.dataset['pageTitle']?.trim()) continue;
      // A local fragment gives these existing sanitized anchors native link and
      // Enter semantics. The delegated click still owns every game action.
      anchor.setAttribute('href', '#wikipedia-article-title');
    }
    this.presentInfoboxes(body);
    for (const content of body.querySelectorAll<HTMLElement>('table, pre')) {
      if (content.parentElement?.closest('.wiki__scroll-region, table')) continue;
      const placeholder = body.ownerDocument.createComment('scroll presentation');
      content.replaceWith(placeholder);
      placeholder.replaceWith(
        this.scrollable(content, content.tagName === 'PRE' ? 'Codice' : 'Tabella'),
      );
    }
  }

  private presentInfoboxes(body: HTMLElement): void {
    const tables = Array.from(
      body.querySelectorAll<HTMLTableElement>('table.infobox, table.sinottico'),
    ).filter(
      (table) => !table.parentElement?.closest('.wiki__facts, table.infobox, table.sinottico'),
    );
    if (tables.length === 0) return;
    const paragraphs = Array.from(body.querySelectorAll('p')).filter(
      (paragraph) => paragraph.textContent?.trim() && !paragraph.closest('table, .wiki__facts'),
    );
    const heading = Array.from(body.querySelectorAll('h2, h3, h4, h5, h6')).find(
      (entry) => !entry.closest('table'),
    );
    const introduction = heading
      ? paragraphs
          .filter(
            (paragraph) =>
              paragraph.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING,
          )
          .at(-1)
      : paragraphs[0];
    let insertionPoint: Element | undefined = introduction;
    for (const [index, table] of tables.entries()) {
      const document = body.ownerDocument;
      const details = document.createElement('details');
      details.className = 'wiki__facts';
      const summary = document.createElement('summary');
      summary.textContent =
        tables.length === 1 ? 'Scheda informativa' : `Scheda informativa ${index + 1}`;
      details.append(summary);
      // Move the original sanitized table intact. No rows, links or media are
      // summarized, cloned or discarded to match the prototype's short sample.
      const placeholder = document.createComment('infobox presentation');
      table.replaceWith(placeholder);
      details.append(this.scrollable(table, 'Tabella informativa'));
      if (insertionPoint) insertionPoint.after(details);
      else placeholder.replaceWith(details);
      placeholder.remove();
      insertionPoint = details;
      details.addEventListener('toggle', () => this.updateScrollRegions());
    }
  }

  private scrollable(content: HTMLElement, label: string): HTMLElement {
    const document = content.ownerDocument;
    const block = document.createElement('div');
    block.className = 'wiki__scroll-block';
    const hint = document.createElement('p');
    hint.className = 'wiki__scroll-hint';
    hint.hidden = true;
    hint.textContent = 'Scorri orizzontalmente per leggere il contenuto completo.';
    const region = document.createElement('div');
    region.className = 'wiki__scroll-region';
    region.setAttribute('role', 'region');
    region.setAttribute('aria-label', label);
    region.append(content);
    block.append(hint, region);
    return block;
  }

  private updateScrollRegions(): void {
    for (const region of this.articleBody().nativeElement.querySelectorAll<HTMLElement>(
      '.wiki__scroll-region',
    )) {
      const overflow = region.clientWidth > 0 && region.scrollWidth > region.clientWidth + 1;
      if (overflow) region.tabIndex = 0;
      else region.removeAttribute('tabindex');
      const hint = region.previousElementSibling;
      if (hint instanceof HTMLElement) hint.hidden = !overflow;
    }
  }

  private updatePlayableState(): void {
    for (const anchor of this.articleBody().nativeElement.querySelectorAll('a[data-page-title]')) {
      if (this.disabled()) anchor.setAttribute('aria-disabled', 'true');
      else anchor.removeAttribute('aria-disabled');
    }
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

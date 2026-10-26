import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DomSanitizer } from '@angular/platform-browser';
import { WikipediaArticle } from './wikipedia-article';

const article = `<div>
  <table class="infobox"><tbody><tr><th>Original facts</th><td><a data-page-title="Roma">Roma</a></td></tr>
  <tr><td colspan="2"><img src="https://upload.wikimedia.org/example.png" alt="Original image" width="240" height="120"></td></tr>
  <tr><td>Nested</td><td><table class="sinottico"><tbody><tr><td>Nested fact</td></tr></tbody></table></td></tr></tbody></table>
  <p>First introductory paragraph with <a data-page-title="Napoli"><b>Napoli</b></a>.</p>
  <div><p>Second introductory paragraph.</p></div>
  <table class="sinottico"><tbody><tr><td>Second facts</td><td><a data-page-title="Italia">Italia</a></td></tr></tbody></table>
  <h2 id="rtu-section-Description">Description</h2><p>Article body.</p>
  <h3 id="rtu-section-Details">Details</h3><p>More content.</p>
  <table><caption>Data table</caption><tbody><tr><td>Preserved data</td></tr></tbody></table>
  <pre><code>const original = 42;</code></pre>
</div>`;

describe('WikipediaArticle', () => {
  let component: WikipediaArticle;
  let fixture: ComponentFixture<WikipediaArticle>;
  let scroll = vi.fn<(options?: boolean | ScrollIntoViewOptions) => void>();
  const originalScroll = HTMLElement.prototype.scrollIntoView;

  beforeEach(async () => {
    scroll = vi.fn<(options?: boolean | ScrollIntoViewOptions) => void>();
    HTMLElement.prototype.scrollIntoView = scroll;
    await TestBed.configureTestingModule({ imports: [WikipediaArticle] }).compileComponents();
    fixture = TestBed.createComponent(WikipediaArticle);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('title', 'Napoli');
    fixture.componentRef.setInput(
      'html',
      TestBed.inject(DomSanitizer).bypassSecurityTrustHtml(article),
    );
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => {
    HTMLElement.prototype.scrollIntoView = originalScroll;
  });

  it('gives every playable sanitized link native local-link semantics', () => {
    const links = Array.from(
      fixture.nativeElement.querySelectorAll('a[data-page-title]'),
    ) as HTMLAnchorElement[];
    expect(links.length).toBe(3);
    expect(links.every((link) => link.getAttribute('href') === '#wikipedia-article-title')).toBe(
      true,
    );
    expect(links.every((link) => link.tabIndex === 0)).toBe(true);
    expect(fixture.nativeElement.querySelector('article').getAttribute('lang')).toBe('it');
  });

  it('delegates a single activation from nested link content and prevents browser navigation', () => {
    const navigate = vi.fn();
    component.navigate.subscribe(navigate);
    const bold = fixture.nativeElement.querySelector('a[data-page-title="Napoli"] b');
    const activation = new MouseEvent('click', { bubbles: true, cancelable: true, detail: 0 });
    bold.dispatchEvent(activation);
    expect(activation.defaultPrevented).toBe(true);
    expect(navigate).toHaveBeenCalledExactlyOnceWith('Napoli');
  });

  it('does not open an alternate browser destination from an auxiliary click', () => {
    const navigate = vi.fn();
    component.navigate.subscribe(navigate);
    const event = new MouseEvent('auxclick', { button: 1, bubbles: true, cancelable: true });
    fixture.nativeElement.querySelector('a[data-page-title="Napoli"]').dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('blocks mouse and keyboard-generated clicks during busy without discarding links', async () => {
    const navigate = vi.fn();
    component.navigate.subscribe(navigate);
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    await fixture.whenStable();
    const link = fixture.nativeElement.querySelector(
      'a[data-page-title="Napoli"]',
    ) as HTMLAnchorElement;
    expect(link.getAttribute('aria-disabled')).toBe('true');
    expect(link.getAttribute('href')).toBe('#wikipedia-article-title');
    expect(fixture.nativeElement.getAttribute('aria-busy')).toBe('true');
    link.click();
    link.dispatchEvent(new MouseEvent('click', { detail: 0, bubbles: true, cancelable: true }));
    expect(navigate).not.toHaveBeenCalled();
    fixture.componentRef.setInput('disabled', false);
    fixture.detectChanges();
    await fixture.whenStable();
    link.click();
    expect(navigate).toHaveBeenCalledExactlyOnceWith('Napoli');
  });

  it('keeps complete original infoboxes, nested tables, links and media after the introduction', () => {
    const body = fixture.nativeElement.querySelector('.wiki__body') as HTMLElement;
    const facts = Array.from(body.querySelectorAll('details.wiki__facts'));
    expect(facts.length).toBe(2);
    expect(body.querySelectorAll('table').length).toBe(4);
    expect(body.querySelectorAll('a[data-page-title]').length).toBe(3);
    expect(facts[0].textContent).toContain('Nested fact');
    expect(facts[0].querySelector('td[colspan="2"] img')?.getAttribute('alt')).toBe(
      'Original image',
    );
    expect(facts[0].querySelector('img')?.getAttribute('width')).toBe('240');
    expect(facts[1].textContent).toContain('Second facts');
    const introduction = Array.from(body.querySelectorAll('p')).find(
      (p) => p.textContent === 'Second introductory paragraph.',
    )!;
    expect(introduction.nextElementSibling).toBe(facts[0]);
    expect(facts[0].nextElementSibling).toBe(facts[1]);
    expect(body.querySelector('pre code')?.textContent).toBe('const original = 42;');
  });

  it('does not duplicate presentation wrappers when only busy changes', async () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelectorAll('details.wiki__facts').length).toBe(2);
    expect(fixture.nativeElement.querySelectorAll('.wiki__scroll-region').length).toBe(4);
  });

  it('retains TOC heading levels and focuses the original section on navigation', () => {
    expect(component.tocEntries()).toEqual([
      { id: 'rtu-section-Description', label: 'Description', level: 2 },
      { id: 'rtu-section-Details', label: 'Details', level: 3 },
    ]);
    const event = new MouseEvent('click', { cancelable: true });
    component.onTocClick(event, 'rtu-section-Details');
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(
      fixture.nativeElement.querySelector('#rtu-section-Details'),
    );
    expect(scroll).toHaveBeenCalledWith(
      expect.objectContaining({ block: 'start', inline: 'nearest' }),
    );
  });

  it('opens every closed disclosure ancestor before focusing a TOC heading inside an infobox', async () => {
    fixture.componentRef.setInput(
      'html',
      TestBed.inject(DomSanitizer).bypassSecurityTrustHtml(
        '<table class="infobox"><tbody><tr><td><h3 id="rtu-section-facts">Dati della scheda</h3>' +
          '<a data-page-title="Roma">Roma</a></td></tr></tbody></table>' +
          '<p>Introduzione completa.</p><h2 id="rtu-section-body">Corpo</h2><p>Articolo.</p>',
      ),
    );
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const body = fixture.nativeElement.querySelector('.wiki__body') as HTMLElement;
    const facts = body.querySelector('details.wiki__facts') as HTMLDetailsElement;
    const heading = body.querySelector('#rtu-section-facts') as HTMLElement;
    const originalLink = facts.querySelector('a[data-page-title]');
    // Exercise nested presentation disclosures without changing sanitized data.
    const outer = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = 'Nested presentation';
    facts.replaceWith(outer);
    outer.append(summary, facts);
    expect(facts.open).toBe(false);
    expect(outer.open).toBe(false);
    expect(component.tocEntries().some((entry) => entry.id === heading.id)).toBe(true);
    const focus = vi.spyOn(heading, 'focus');
    component.onTocClick(new MouseEvent('click', { cancelable: true }), heading.id);
    expect(facts.open).toBe(true);
    expect(outer.open).toBe(true);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(document.activeElement).toBe(heading);
    expect(facts.querySelector('a[data-page-title]')).toBe(originalLink);
    expect(body.querySelector('#rtu-section-facts')).toBe(heading);
    expect(scroll).toHaveBeenCalledWith(
      expect.objectContaining({ block: 'start', inline: 'nearest' }),
    );
  });

  it('focuses the new article title without an independent horizontal scroll', () => {
    component.focusTitle();
    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('.wiki__title'));
    expect(scroll).toHaveBeenCalledExactlyOnceWith({
      behavior: 'instant',
      block: 'start',
      inline: 'nearest',
    });
  });

  it('handles a complete article without headings or an infobox', async () => {
    fixture.componentRef.setInput(
      'html',
      TestBed.inject(DomSanitizer).bypassSecurityTrustHtml(
        '<p>Only text and <a data-page-title="Roma">a link</a>.</p>',
      ),
    );
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.tocEntries()).toEqual([]);
    expect(fixture.nativeElement.querySelector('details')).toBeNull();
    expect(fixture.nativeElement.querySelector('a[data-page-title]').getAttribute('href')).toBe(
      '#wikipedia-article-title',
    );
  });
});

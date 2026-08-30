import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DomSanitizer } from '@angular/platform-browser';
import { WikipediaArticle } from './wikipedia-article';

const HTML = `
  <p>Intro with a <a data-page-id="123" data-page-title="Playable">playable link</a> inside.</p>
  <p>A <a data-page-id="0">bad id</a>, a <a data-page-id="-4">negative</a> and a
     <a data-page-id="12.5">non-integer</a>.</p>
  <p>An <a href="https://evil.example/attack">escaped external</a> anchor and plain
     <span>flattened</span> text.</p>
`;

describe('WikipediaArticle', () => {
  let fixture: ComponentFixture<WikipediaArticle>;
  let emitted: number[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [WikipediaArticle] }).compileComponents();
    fixture = TestBed.createComponent(WikipediaArticle);
    emitted = [];
    fixture.componentInstance.navigate.subscribe((id) => emitted.push(id));

    const sanitizer = TestBed.inject(DomSanitizer);
    fixture.componentRef.setInput('title', 'Test article');
    fixture.componentRef.setInput('html', sanitizer.bypassSecurityTrustHtml(HTML));
    fixture.componentRef.setInput('disabled', false);
    fixture.detectChanges();
  });

  function click(selector: string): void {
    const el = (fixture.nativeElement as HTMLElement).querySelector(selector) as HTMLElement;
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  }

  it('emits the page id when a playable link is activated', () => {
    click('a[data-page-id="123"]');
    expect(emitted).toEqual([123]);
  });

  it('ignores anchors whose data-page-id is not a positive safe integer', () => {
    click('a[data-page-id="0"]');
    click('a[data-page-id="-4"]');
    click('a[data-page-id="12.5"]');
    expect(emitted).toEqual([]);
  });

  it('prevents default navigation for any remaining anchor and never emits for it', () => {
    const external = (fixture.nativeElement as HTMLElement).querySelector('a[href]') as HTMLElement;
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    external.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(emitted).toEqual([]);
  });

  it('does nothing when the user clicks plain text', () => {
    click('span');
    click('p');
    expect(emitted).toEqual([]);
  });

  it('does not emit while disabled', () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    click('a[data-page-id="123"]');
    expect(emitted).toEqual([]);
  });
});

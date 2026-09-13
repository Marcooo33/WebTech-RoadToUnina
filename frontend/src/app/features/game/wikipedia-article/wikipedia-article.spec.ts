import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DomSanitizer } from '@angular/platform-browser';
import { WikipediaArticle } from './wikipedia-article';

const HTML = `
  <table class="infobox"><tbody><tr><td>
    <a data-page-title="Playable"><span>playable link</span></a>
  </td></tr></tbody></table>
  <p>A <a data-page-title="">empty</a>, a <a data-page-title="   ">whitespace</a> and a
     <a data-page-id="123">legacy id</a>.</p>
  <p>An <a href="https://evil.example/attack">escaped external</a> anchor and plain
     <span>flattened</span> text.</p>
`;

describe('WikipediaArticle', () => {
  let fixture: ComponentFixture<WikipediaArticle>;
  let emitted: string[];

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

  function click(selector: string): MouseEvent {
    const el = (fixture.nativeElement as HTMLElement).querySelector(selector) as HTMLElement;
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    el.dispatchEvent(event);
    return event;
  }

  it('delegates a nested infobox click once and prevents browser navigation', () => {
    const event = click('.infobox a[data-page-title="Playable"] span');
    expect(event.defaultPrevented).toBe(true);
    expect(emitted).toEqual(['Playable']);
  });

  it('ignores empty titles and legacy page-ID annotations', () => {
    click('a[data-page-title=""]');
    click('a[data-page-title="   "]');
    click('a[data-page-id="123"]');
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
    click('p span');
    click('p');
    expect(emitted).toEqual([]);
  });

  it('does not emit while disabled', () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    click('a[data-page-title="Playable"]');
    expect(emitted).toEqual([]);
  });
});

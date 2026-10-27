import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { GuestGamesService } from '../../core/services/guest-games.service';
import { GuestGameSummary } from '../../shared/models/game.model';
import { LandingPage } from './landing-page';

const existing: GuestGameSummary = {
  game: {
    id: 'guest-example',
    mode: 'CLICK',
    difficulty: 'EASY',
    status: 'IN_PROGRESS',
    startPageTitle: 'Roma',
    currentPageId: 2,
    currentPageTitle: 'Napoli',
    clickCount: 1,
    backtrackCount: 0,
    effectivePlayTimeMs: 18000,
    startedAt: '2026-10-26T00:00:00Z',
    completedAt: null,
  },
  revision: 3,
  expiresAt: '2026-10-27T00:00:00Z',
};

describe('LandingPage presentation', () => {
  let fixture: ComponentFixture<LandingPage>;
  let create: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    create = vi.fn();
    await TestBed.configureTestingModule({
      imports: [LandingPage],
      providers: [
        provideRouter([]),
        {
          provide: GuestGamesService,
          useValue: {
            summary: () => of({ game: null, revision: null, expiresAt: null }),
            notice: signal(null),
            create,
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(LandingPage);
    fixture.detectChanges();
  });

  it('explains the three steps once and retains the ranked history route', () => {
    const section = fixture.nativeElement.querySelector('#how-to');
    const steps = Array.from(section.querySelectorAll('ol li p')).map((step) =>
      (step as HTMLElement).textContent?.trim(),
    );
    expect(steps).toEqual([
      'Start from a random Italian Wikipedia article.',
      'Navigate through internal Wikipedia links.',
      'Reach the Federico II article.',
    ]);
    expect(section.querySelector('a[href="/history"]').textContent).toContain(
      'Explore ranked game history',
    );
    expect(section.textContent).not.toMatch(/CLICK|TIME/);
    expect(fixture.nativeElement.querySelector('#example-route')).toBeNull();
    expect(fixture.nativeElement.querySelector('.preview-caption').getAttribute('href')).toBe(
      '#how-to',
    );
    expect(fixture.nativeElement.querySelector('.hero-description').textContent).toContain(
      'random Italian article',
    );
    expect(fixture.nativeElement.querySelector('.preview-heading').textContent).toContain(
      'Example journey',
    );
    expect(fixture.nativeElement.querySelector('a[href="/register"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('a[href="/login"]')).not.toBeNull();
  });

  it('keeps word separators when responsive line breaks are hidden', () => {
    const text = (selector: string) =>
      fixture.nativeElement.querySelector(selector).textContent.replace(/\s+/g, ' ').trim();
    expect(text('.hero-actions > span')).toBe('No account needed. Follow the article links.');
    expect(text('.hero-description')).toContain('The Wikipedia navigation game.');
    expect(text('.how-heading p')).toBe('One random article. Every link is a choice.');
  });

  it('connects the destination imagery to the actual goal article', () => {
    const destination = fixture.nativeElement.querySelector('.destination-gallery');
    expect(destination.querySelector('.destination-article-name').textContent).toContain(
      'Università degli Studi di Napoli Federico II',
    );
    expect(destination.textContent).toContain('Wikipedia article to finish your game.');
    expect(destination.querySelector('a[href="#home-title"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.landing img').length).toBe(3);
  });

  it('reveals the example without starting a guest game', () => {
    const details = fixture.nativeElement.querySelector('.article-link') as HTMLDetailsElement;
    details.querySelector('summary')!.click();
    expect(details.open).toBe(true);
    expect(details.textContent).toContain('Università degli Studi di Napoli Federico II');
    expect(create).not.toHaveBeenCalled();
  });

  it('keeps Play as Guest visible with and without the recovery panel', () => {
    const primary = () => fixture.nativeElement.querySelector('.hero-actions button');
    expect(primary().textContent).toContain('Play as Guest');
    expect(fixture.nativeElement.querySelector('[data-testid="guest-existing"]')).toBeNull();
    fixture.componentInstance.current.set(existing);
    fixture.detectChanges();
    const panel = fixture.nativeElement.querySelector('[data-testid="guest-existing"]');
    expect(panel.getAttribute('aria-labelledby')).toBe('guest-title');
    expect(panel.querySelector('h2').textContent).toContain('Your next link awaits.');
    expect(primary().textContent).toContain('Play as Guest');
    expect(primary().disabled).toBe(false);
    expect(create).not.toHaveBeenCalled();
  });

  it('keeps replacement confirmation wired to the existing action and busy state', () => {
    fixture.componentInstance.current.set(existing);
    fixture.componentInstance.confirming.set(true);
    fixture.detectChanges();
    const replace = vi.spyOn(fixture.componentInstance, 'replace').mockResolvedValue();
    const confirm = Array.from(fixture.nativeElement.querySelectorAll('button')).find(
      (button) => (button as HTMLButtonElement).textContent?.trim() === 'Confirm Start New',
    ) as HTMLButtonElement;
    confirm.click();
    expect(replace).toHaveBeenCalledOnce();
    fixture.componentInstance.busy.set(true);
    fixture.detectChanges();
    const buttons = fixture.nativeElement.querySelectorAll('[data-testid="guest-existing"] button');
    expect(Array.from(buttons).every((button) => (button as HTMLButtonElement).disabled)).toBe(
      true,
    );
    expect(fixture.nativeElement.querySelector('.hero-actions button').disabled).toBe(true);
  });

  it('preserves existing-game resume and the explicit replacement confirmation', () => {
    fixture.componentInstance.current.set(existing);
    fixture.detectChanges();
    const panel = fixture.nativeElement.querySelector('[data-testid="guest-existing"]');
    expect(panel.querySelector('a').getAttribute('href')).toBe('/guest/game/guest-example');
    expect(panel.querySelector('a').textContent.trim()).toBe('Resume');
    panel.querySelector('button').click();
    fixture.detectChanges();
    expect(panel.querySelector('[role="alert"]').textContent).toContain(
      'Discard your current progress',
    );
    expect(create).not.toHaveBeenCalled();
    const cancel = Array.from(panel.querySelectorAll('button')).find(
      (button) => (button as HTMLButtonElement).textContent?.trim() === 'Cancel',
    ) as HTMLButtonElement;
    cancel.click();
    fixture.detectChanges();
    expect(panel.querySelector('[role="alert"]')).toBeNull();
    expect(create).not.toHaveBeenCalled();
  });

  it('keeps unsaved-result wording and disables conflicting actions while busy', () => {
    fixture.componentInstance.current.set({
      ...existing,
      game: { ...existing.game!, status: 'COMPLETED' },
    });
    fixture.componentInstance.busy.set(true);
    fixture.detectChanges();
    const panel = fixture.nativeElement.querySelector('[data-testid="guest-existing"]');
    expect(panel.textContent).toContain('unsaved guest result');
    expect(panel.querySelector('a').textContent.trim()).toBe('View Result');
    expect(panel.querySelector('button').disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('.hero-actions button').disabled).toBe(true);
  });
});

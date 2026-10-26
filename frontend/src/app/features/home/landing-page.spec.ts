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

  it('labels the informative completed example without making its stops game actions', () => {
    const stops = Array.from(fixture.nativeElement.querySelectorAll('.atlas-route h3')).map(
      (heading) => (heading as HTMLElement).textContent?.trim(),
    );
    expect(stops).toEqual(['Roma', 'Napoli', 'Federico II']);
    expect(fixture.nativeElement.querySelector('.route-caption').textContent).toContain(
      'example from a completed game',
    );
    expect(fixture.nativeElement.querySelector('.atlas-route a, .atlas-route button')).toBeNull();
    expect(fixture.nativeElement.querySelector('a[href="/history"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('a[href="/register"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('a[href="/login"]')).not.toBeNull();
  });

  it('keeps word separators when responsive line breaks are hidden', () => {
    const text = (selector: string) =>
      fixture.nativeElement.querySelector(selector).textContent.replace(/\s+/g, ' ').trim();
    expect(text('.hero-actions > span')).toBe('No account needed. Follow the article links.');
    expect(text('.game-description')).toBe('The Wikipedia navigation game.');
    expect(text('.atlas-stop:nth-child(1) p')).toBe('A starting point, not a straight line.');
    expect(text('.atlas-stop:nth-child(2) p')).toBe('One article opens another possibility.');
    expect(text('.atlas-stop:nth-child(3) p')).toBe('Università degli Studi di Napoli Federico II');
    expect(text('.how-to > div p')).toBe(
      'Curiosity is your compass. The links are your only way forward.',
    );
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

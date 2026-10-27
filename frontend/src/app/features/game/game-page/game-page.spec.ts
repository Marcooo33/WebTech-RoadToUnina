import { Router, provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { GamePage } from './game-page';
import { GamesService } from '../../../core/services/games.service';
import { GuestGamesService } from '../../../core/services/guest-games.service';
import { PreparedGameStateDto } from '../../../shared/models/game.model';
import { ApiError } from '../../../shared/models/api-error.model';

const state: PreparedGameStateDto = {
  game: {
    id: '00000000-0000-4000-8000-000000000001',
    mode: 'CLICK',
    difficulty: 'EASY',
    status: 'IN_PROGRESS',
    startPageId: 1,
    startPageTitle: 'Roma',
    currentPageId: 1,
    currentPageTitle: 'Roma',
    clickCount: 0,
    backtrackCount: 0,
    effectivePlayTimeMs: 18000,
    startedAt: '2026-10-26T00:00:00Z',
    completedAt: null,
    createdAt: '2026-10-26T00:00:00Z',
    path: [{ pageId: 1, title: 'Roma' }],
    moves: [],
  },
  article: {
    gameId: '00000000-0000-4000-8000-000000000001',
    links: [{ title: 'Napoli' }],
    pageId: 1,
    title: 'Roma',
    contentHtml:
      '<p>Read <a data-page-title="Napoli">Napoli</a>.</p><h2 id="rtu-section-body">Corpo</h2><p>Article body.</p>',
  },
};

describe('GamePage presentation', () => {
  let component: GamePage;
  let fixture: ComponentFixture<GamePage>;
  let load: Subject<PreparedGameStateDto>;
  let mutation: Subject<PreparedGameStateDto>;
  let move: ReturnType<typeof vi.fn>;
  let pause: ReturnType<typeof vi.fn>;
  const originalScroll = HTMLElement.prototype.scrollIntoView;

  beforeEach(async () => {
    HTMLElement.prototype.scrollIntoView = vi.fn();
    load = new Subject();
    mutation = new Subject();
    move = vi.fn(() => mutation);
    pause = vi.fn(() => of(void 0));
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: GamesService, useValue: { get: () => load, move, pause, pauseOnExit: vi.fn() } },
        { provide: GuestGamesService, useValue: {} },
      ],
      imports: [GamePage],
    }).compileComponents();
    fixture = TestBed.createComponent(GamePage);
    fixture.componentRef.setInput('id', state.game.id);
    component = fixture.componentInstance;
    fixture.detectChanges();
    load.next(state);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });
  afterEach(() => {
    HTMLElement.prototype.scrollIntoView = originalScroll;
    vi.restoreAllMocks();
  });

  it('renders a single HUD, keeps the real leave action and focuses the loaded article', () => {
    expect(fixture.nativeElement.querySelectorAll('app-game-hud').length).toBe(1);
    const articleArea = fixture.nativeElement.querySelector('.game__main');
    expect(articleArea.tagName).toBe('DIV');
    const hud = fixture.nativeElement.querySelector('app-game-hud');
    expect(
      hud.compareDocumentPosition(articleArea) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    const leave = fixture.nativeElement.querySelector('app-game-hud .hud__exit');
    expect(leave.getAttribute('aria-label')).toBe('Esci dalla partita');
    expect(fixture.nativeElement.querySelector('.game__article-toolbar a')).toBeNull();
    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('.wiki__title'));
  });

  it('requires confirmation before leaving and keeps cancellation in the game', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const dialog = fixture.nativeElement.querySelector('.game__exit-dialog') as HTMLDialogElement;
    dialog.showModal = vi.fn(() => {
      dialog.open = true;
    });
    dialog.close = vi.fn(() => {
      dialog.open = false;
    });
    const trigger = fixture.nativeElement.querySelector('.hud__exit') as HTMLButtonElement;
    trigger.click();
    expect(dialog.showModal).toHaveBeenCalledOnce();
    expect(navigate).not.toHaveBeenCalled();
    dialog.querySelector<HTMLButtonElement>('[autofocus]')!.click();
    expect(dialog.open).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
    component.confirmExit();
    expect(navigate).not.toHaveBeenCalled();
    trigger.click();
    dialog.querySelector<HTMLButtonElement>('.btn--danger')!.click();
    expect(navigate).toHaveBeenCalledExactlyOnceWith('/');
  });

  it('applies the measured HUD obstruction as a presentation-only scroll offset', () => {
    component.onHudHeightChanged(139);
    expect((fixture.nativeElement as HTMLElement).style.getPropertyValue('--game-hud-height')).toBe(
      '139px',
    );
  });

  it('scrolls a covered article link only by the new margin after HUD growth without moving focus', () => {
    const trigger = fixture.nativeElement.querySelector('.hud__path-toggle') as HTMLElement;
    trigger.focus();
    component.onHudHeightChanged(107);
    const link = fixture.nativeElement.querySelector('a[data-page-title]') as HTMLElement;
    link.focus();
    vi.spyOn(link, 'getBoundingClientRect').mockReturnValue({ top: 124, bottom: 152 } as DOMRect);
    const hud = fixture.nativeElement.querySelector('app-game-hud') as HTMLElement;
    vi.spyOn(hud, 'getBoundingClientRect').mockReturnValue({ top: 0, bottom: 207 } as DOMRect);
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      scrollMarginTop: '227px',
    } as CSSStyleDeclaration);
    const scroll = vi.spyOn(window, 'scrollBy').mockImplementation(() => {});
    component.onHudHeightChanged(207);
    expect(scroll).toHaveBeenCalledExactlyOnceWith({ top: -103, left: 0, behavior: 'instant' });
    expect(document.activeElement).toBe(link);
    expect((fixture.nativeElement as HTMLElement).style.getPropertyValue('--game-hud-height')).toBe(
      '207px',
    );
  });

  it.each(['.wiki__title', '#rtu-section-body', '.wiki__toc-compact a'])(
    'keeps the focused article heading or TOC entry visible after HUD growth: %s',
    (selector) => {
      (fixture.nativeElement.querySelector('.hud__path-toggle') as HTMLElement).focus();
      component.onHudHeightChanged(107);
      const focused = fixture.nativeElement.querySelector(selector) as HTMLElement;
      focused.tabIndex = -1;
      focused.focus();
      vi.spyOn(focused, 'getBoundingClientRect').mockReturnValue({
        top: 125,
        bottom: 158,
      } as DOMRect);
      const hud = fixture.nativeElement.querySelector('app-game-hud') as HTMLElement;
      vi.spyOn(hud, 'getBoundingClientRect').mockReturnValue({ top: 0, bottom: 180 } as DOMRect);
      vi.spyOn(window, 'getComputedStyle').mockReturnValue({
        scrollMarginTop: '200px',
      } as CSSStyleDeclaration);
      const scroll = vi.spyOn(window, 'scrollBy').mockImplementation(() => {});
      component.onHudHeightChanged(180);
      expect(scroll).toHaveBeenCalledExactlyOnceWith({ top: -75, left: 0, behavior: 'instant' });
      expect(document.activeElement).toBe(focused);
    },
  );

  it('does not scroll an article focus that is already visible or is outside the viewport', () => {
    (fixture.nativeElement.querySelector('.hud__path-toggle') as HTMLElement).focus();
    component.onHudHeightChanged(107);
    const link = fixture.nativeElement.querySelector('a[data-page-title]') as HTMLElement;
    link.focus();
    const bounds = vi
      .spyOn(link, 'getBoundingClientRect')
      .mockReturnValue({ top: 219, bottom: 247 } as DOMRect);
    const hud = fixture.nativeElement.querySelector('app-game-hud') as HTMLElement;
    vi.spyOn(hud, 'getBoundingClientRect').mockReturnValue({ top: 0, bottom: 207 } as DOMRect);
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      scrollMarginTop: '227px',
    } as CSSStyleDeclaration);
    const scroll = vi.spyOn(window, 'scrollBy').mockImplementation(() => {});
    component.onHudHeightChanged(207);
    expect(scroll).not.toHaveBeenCalled();
    bounds.mockReturnValue({ top: -40, bottom: -12 } as DOMRect);
    component.onHudHeightChanged(230);
    expect(scroll).not.toHaveBeenCalled();
    bounds.mockReturnValue({ top: 1000, bottom: 1028 } as DOMRect);
    component.onHudHeightChanged(250);
    expect(scroll).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(link);
  });

  it.each(['.hud__path-toggle', '.game__dialog-close'])(
    'does not scroll focus inside HUD or dialog when its height increases: %s',
    (selector) => {
      const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
      dialog.open = true;
      const focused = fixture.nativeElement.querySelector(selector) as HTMLElement;
      focused.focus();
      const scroll = vi.spyOn(window, 'scrollBy').mockImplementation(() => {});
      component.onHudHeightChanged(207);
      expect(scroll).not.toHaveBeenCalled();
      expect(document.activeElement).toBe(focused);
    },
  );

  it('opens and closes the native path dialog and restores the existing trigger', () => {
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    // jsdom wiring test; real modal Tab/Escape behavior is verified in Chromium.
    const show = vi.fn(() => {
      dialog.open = true;
    });
    const close = vi.fn(() => {
      dialog.open = false;
      dialog.dispatchEvent(new Event('close'));
    });
    dialog.showModal = show;
    dialog.close = close;
    const trigger = fixture.nativeElement.querySelector('.hud__path-toggle') as HTMLButtonElement;
    vi.spyOn(trigger, 'getClientRects').mockReturnValue({ length: 1 } as DOMRectList);
    expect(dialog.querySelector('app-game-path')).toBeNull();
    trigger.click();
    fixture.detectChanges();
    expect(show).toHaveBeenCalledOnce();
    expect(dialog.querySelectorAll('.path__item').length).toBe(1);
    expect(dialog.getAttribute('aria-labelledby')).toBe('path-title');
    expect(dialog.querySelector('.game__path-target')?.textContent).toContain(
      'Università degli Studi di Napoli Federico II',
    );
    dialog.querySelector<HTMLButtonElement>('.game__dialog-close')!.click();
    fixture.detectChanges();
    expect(close).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(trigger);
    expect(dialog.querySelector('app-game-path')).toBeNull();
  });

  it('returns focus to the desktop path summary when a resized dialog loses its mobile trigger', () => {
    const trigger = fixture.nativeElement.querySelector('.hud__path-toggle') as HTMLButtonElement;
    vi.spyOn(trigger, 'getClientRects').mockReturnValue({ length: 0 } as DOMRectList);
    component.pathOpen.set(true);
    component.onPathClosed();
    expect(component.pathOpen()).toBe(false);
    expect(document.activeElement).toBe(
      fixture.nativeElement.querySelector('.game__desktop-path summary'),
    );
  });

  it('keeps a single move in flight and focuses the backend-provided next article', async () => {
    const link = fixture.nativeElement.querySelector('a[data-page-title]') as HTMLAnchorElement;
    link.dispatchEvent(new MouseEvent('click', { detail: 0, bubbles: true, cancelable: true }));
    fixture.detectChanges();
    link.click();
    expect(move).toHaveBeenCalledExactlyOnceWith(state.game.id, 'Napoli');
    expect(component.busy()).toBe(true);
    expect(fixture.nativeElement.querySelectorAll('.hud__busy').length).toBe(1);
    mutation.next({
      game: {
        ...state.game,
        currentPageId: 2,
        currentPageTitle: 'Napoli',
        clickCount: 9,
        path: [...state.game.path, { pageId: 2, title: 'Napoli' }],
      },
      article: {
        gameId: state.game.id,
        links: [],
        pageId: 2,
        title: 'Napoli',
        contentHtml: '<p>Next article.</p>',
      },
    });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const title = fixture.nativeElement.querySelector('.wiki__title');
    expect(title.textContent.trim()).toBe('Napoli');
    expect(document.activeElement).toBe(title);
    expect(fixture.nativeElement.querySelector('[data-testid="hud-clicks"]').textContent).toBe('9');
    expect(component.busy()).toBe(false);
  });

  it('renders a recoverable playing error once inside the persistent HUD', async () => {
    component.onNavigate('Napoli');
    mutation.error(new ApiError(502, 'WIKIPEDIA_UNAVAILABLE', 'Upstream unavailable.'));
    fixture.detectChanges();
    await fixture.whenStable();
    const notices = fixture.nativeElement.querySelectorAll('.notice[role="status"]');
    expect(notices.length).toBe(1);
    expect(notices[0].closest('.hud__feedback')).not.toBeNull();
    expect(notices[0].textContent).toContain(
      'Wikipedia è temporaneamente non disponibile. Riprova.',
    );
    expect(fixture.nativeElement.querySelectorAll('[role="status"]').length).toBe(1);
    expect(fixture.nativeElement.querySelectorAll('app-error-banner').length).toBe(1);
    expect(component.phase()).toBe('playing');
  });

  it('renders an unexpected playing error once in the same HUD without changing the game', async () => {
    component.onNavigate('Napoli');
    mutation.error(new ApiError(500, 'INTERNAL_ERROR', 'An unexpected game error occurred.'));
    fixture.detectChanges();
    await fixture.whenStable();
    const alerts = fixture.nativeElement.querySelectorAll('[role="alert"]');
    expect(alerts.length).toBe(1);
    expect(alerts[0].closest('.hud__feedback')).not.toBeNull();
    expect(alerts[0].textContent).toContain('An unexpected game error occurred.');
    expect(fixture.nativeElement.querySelectorAll('app-error-banner').length).toBe(1);
    expect(fixture.nativeElement.querySelector('.wiki__title').textContent.trim()).toBe('Roma');
    expect(component.busy()).toBe(false);
  });

  it('keeps non-playing feedback once outside the HUD with the existing recovery actions', () => {
    component.phase.set('error');
    component.error.set('This game could not be loaded.');
    component.notice.set('Existing recovery notice.');
    fixture.detectChanges();
    const alerts = fixture.nativeElement.querySelectorAll('[role="alert"]');
    const notices = fixture.nativeElement.querySelectorAll('.notice[role="status"]');
    expect(alerts.length).toBe(1);
    expect(notices.length).toBe(1);
    expect(alerts[0].closest('app-game-hud')).toBeNull();
    expect(fixture.nativeElement.querySelector('app-game-hud')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Riprova');
    expect(fixture.nativeElement.textContent).toContain('Torna al riepilogo');
  });

  it('preserves the existing pause-before-leave call', () => {
    const result = component.pauseBeforeLeave();
    expect(pause).toHaveBeenCalledExactlyOnceWith(state.game.id);
    expect(typeof result).not.toBe('boolean');
  });
});

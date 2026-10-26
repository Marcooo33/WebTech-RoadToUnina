import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GameHud } from './game-hud';

const game = {
  mode: 'CLICK',
  difficulty: 'EASY',
  clickCount: 37,
  backtrackCount: 0,
  path: [
    { pageId: 1, title: 'Start' },
    { pageId: 2, title: 'Current' },
  ],
};

describe('GameHud', () => {
  let component: GameHud;
  let fixture: ComponentFixture<GameHud>;
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [GameHud] }).compileComponents();
    fixture = TestBed.createComponent(GameHud);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('game', game);
    fixture.componentRef.setInput('displayTimeMs', 18000);
    fixture.detectChanges();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('uses official click input independently of the number of visited articles', () => {
    expect(fixture.nativeElement.querySelector('[data-testid="hud-clicks"]').textContent).toBe(
      '37',
    );
    expect(fixture.nativeElement.querySelector('.hud__stat--primary dt').textContent).toContain(
      'Clicks',
    );
    expect(fixture.nativeElement.querySelectorAll('dl').length).toBe(1);
  });

  it('changes the primary metric for TIME using the original duration input', () => {
    fixture.componentRef.setInput('game', { ...game, mode: 'TIME' });
    fixture.componentRef.setInput('displayTimeMs', 90123000);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.hud__stat--primary dd').textContent).toBe(
      '25:02:03',
    );
    expect(fixture.nativeElement.querySelector('[data-testid="hud-clicks"]').textContent).toBe(
      '37',
    );
  });

  it('preserves MEDIUM remaining backtracks and the exhausted limit', () => {
    fixture.componentRef.setInput('game', { ...game, difficulty: 'MEDIUM', backtrackCount: 2 });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.hud__remaining').textContent.trim()).toBe('(1)');
    expect(component.canBacktrack()).toBe(true);
    fixture.componentRef.setInput('game', { ...game, difficulty: 'MEDIUM', backtrackCount: 3 });
    fixture.detectChanges();
    expect(component.backtracksLeft()).toBe(0);
    expect(fixture.nativeElement.querySelector('.hud__backtrack').disabled).toBe(true);
  });

  it('hides the forbidden action on HARD and disables it for the initial article', () => {
    fixture.componentRef.setInput('game', { ...game, difficulty: 'HARD' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.hud__backtrack')).toBeNull();
    fixture.componentRef.setInput('game', { ...game, path: [game.path[0]] });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.hud__backtrack').disabled).toBe(true);
  });

  it('keeps busy feedback persistent and prevents conflicting backtracks', () => {
    const backtrack = vi.fn();
    component.backtrack.subscribe(backtrack);
    fixture.nativeElement.querySelector('.hud__backtrack').click();
    expect(backtrack).toHaveBeenCalledOnce();
    fixture.componentRef.setInput('busy', true);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('.hud__backtrack').click();
    expect(backtrack).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.querySelectorAll('[role="status"]').length).toBe(1);
    expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain(
      'Opening the next article',
    );
  });

  it('requests the path dialog and can restore focus to its trigger', () => {
    const path = vi.fn();
    component.pathRequested.subscribe(path);
    fixture.nativeElement.querySelector('.hud__path-toggle').click();
    expect(path).toHaveBeenCalledOnce();
    const trigger = fixture.nativeElement.querySelector('.hud__path-toggle') as HTMLButtonElement;
    vi.spyOn(trigger, 'getClientRects').mockReturnValue({ length: 1 } as DOMRectList);
    expect(component.focusPathTrigger()).toBe(true);
    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('.hud__path-toggle'));
  });

  it('reports that a hidden Path trigger cannot receive restored focus', () => {
    const trigger = fixture.nativeElement.querySelector('.hud__path-toggle') as HTMLButtonElement;
    vi.spyOn(trigger, 'getClientRects').mockReturnValue({ length: 0 } as DOMRectList);
    const focus = vi.spyOn(trigger, 'focus');
    expect(component.focusPathTrigger()).toBe(false);
    expect(focus).not.toHaveBeenCalled();
  });

  it('reports the actual compact height and zero obstruction on desktop', () => {
    const height = vi.fn();
    component.heightChanged.subscribe(height);
    vi.spyOn(fixture.nativeElement as HTMLElement, 'getBoundingClientRect').mockReturnValue({
      height: 139,
    } as DOMRect);
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    component.measureHeight();
    expect(height).toHaveBeenLastCalledWith(139);
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    component.measureHeight();
    expect(height).toHaveBeenLastCalledWith(0);
  });
});

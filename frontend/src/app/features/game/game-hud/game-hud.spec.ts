import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GameDto } from '../../../shared/models/game.model';
import { GameHud } from './game-hud';

function gameDto(over: Partial<GameDto> = {}): GameDto {
  return {
    id: 'g1',
    mode: 'CLICK',
    difficulty: 'EASY',
    status: 'IN_PROGRESS',
    startPageId: 1,
    startPageTitle: 'Start',
    currentPageId: 2,
    currentPageTitle: 'Current',
    clickCount: 3,
    backtrackCount: 0,
    effectivePlayTimeMs: 65_000,
    version: 4,
    startedAt: '2026-08-01T00:00:00.000Z',
    completedAt: null,
    createdAt: '2026-08-01T00:00:00.000Z',
    path: [
      { pageId: 1, title: 'Start' },
      { pageId: 2, title: 'Current' },
    ],
    moves: [],
    activeSession: null,
    ...over,
  };
}

describe('GameHud', () => {
  let fixture: ComponentFixture<GameHud>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [GameHud] }).compileComponents();
    fixture = TestBed.createComponent(GameHud);
  });

  function render(game: GameDto, busy = false): HTMLElement {
    fixture.componentRef.setInput('game', game);
    fixture.componentRef.setInput('displayTimeMs', 65_000);
    fixture.componentRef.setInput('busy', busy);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows mode, difficulty, click count and the formatted timer', () => {
    const el = render(gameDto({ mode: 'TIME', clickCount: 7 }));
    expect(el.textContent).toContain('TIME');
    expect(el.textContent).toContain('EASY');
    expect(el.textContent).toContain('7');
    expect(el.textContent).toContain('1:05');
  });

  it('EASY: unlimited backtracking, button enabled', () => {
    const el = render(gameDto({ difficulty: 'EASY' }));
    expect(el.textContent).toContain('unlimited');
    expect(el.querySelector('button')?.disabled).toBe(false);
  });

  it('MEDIUM: shows remaining backtracks, never negative', () => {
    expect(
      render(gameDto({ difficulty: 'MEDIUM', backtrackCount: 1 })).textContent ?? '',
    ).toContain('Backtracks left: 2 / 3');
    const exhausted = render(gameDto({ difficulty: 'MEDIUM', backtrackCount: 5 }));
    expect(exhausted.textContent).toContain('Backtracks left: 0 / 3');
    expect(exhausted.querySelector('button')?.disabled).toBe(true);
  });

  it('HARD: no backtrack control at all', () => {
    const el = render(gameDto({ difficulty: 'HARD' }));
    expect(el.textContent).toContain('not available');
    expect(el.querySelector('button')).toBeNull();
  });

  it('disables backtracking while a mutation is in flight or the path is at the start', () => {
    expect(fixtureCanBacktrack(gameDto({ difficulty: 'EASY' }), true)).toBe(false);
    expect(
      fixtureCanBacktrack(gameDto({ difficulty: 'EASY', path: [{ pageId: 1, title: 'Start' }] })),
    ).toBe(false);
  });

  function fixtureCanBacktrack(game: GameDto, busy = false): boolean {
    render(game, busy);
    return fixture.componentInstance.canBacktrack();
  }

  it('emits backtrack when the button is clicked', () => {
    let emitted = 0;
    fixture.componentInstance.backtrack.subscribe(() => (emitted += 1));
    const el = render(gameDto({ difficulty: 'EASY' }));
    el.querySelector('button')?.click();
    expect(emitted).toBe(1);
  });
});

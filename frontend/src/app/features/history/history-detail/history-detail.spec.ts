import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { HistoryDetail } from './history-detail';
import { HistoryService } from '../../../core/services/history.service';
import { CompletedGameDetailDto } from '../../../shared/models/history.model';

const game: CompletedGameDetailDto = {
  gameId: 'finished-game',
  mode: 'CLICK',
  difficulty: 'MEDIUM',
  clickCount: 5,
  backtrackCount: 1,
  effectivePlayTimeMs: 58000,
  startPageId: 1,
  startPageTitle: 'Roma',
  completedAt: '2026-10-26T00:00:00Z',
  player: { id: 'player', username: 'Navigator' },
  path: [
    { pageId: 1, title: 'Roma' },
    { pageId: 2, title: 'Università degli Studi di Napoli Federico II' },
  ],
  moves: [
    {
      sequence: 1,
      type: 'NAVIGATION',
      fromPageId: 1,
      fromPageTitle: 'Roma',
      toPageId: 2,
      toPageTitle: 'Napoli',
      createdAt: '2026-10-26T00:00:00Z',
    },
  ],
};

describe('HistoryDetail presentation', () => {
  let fixture: ComponentFixture<HistoryDetail>;
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: HistoryService, useValue: { get: () => of(game) } },
      ],
      imports: [HistoryDetail],
    }).compileComponents();
    fixture = TestBed.createComponent(HistoryDetail);
    fixture.componentRef.setInput('gameId', game.gameId);
    fixture.detectChanges();
  });

  it('identifies a completed game, preserves the complete read-only route and deleted-player fallback', () => {
    expect(fixture.nativeElement.querySelector('h1').textContent).toContain(
      'Partita completata da Navigator',
    );
    expect(fixture.nativeElement.querySelectorAll('.path__item').length).toBe(2);
    expect(fixture.nativeElement.querySelector('app-game-path a, app-game-path button')).toBeNull();
    fixture.componentInstance.game.set({ ...game, player: null });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('h1 span').textContent).toBe('Utente eliminato');
  });

  it('keeps every chronological move column in a named keyboard-scrollable region', () => {
    const wrap = fixture.nativeElement.querySelector('.moves-wrap');
    expect(wrap.getAttribute('role')).toBe('region');
    expect(wrap.getAttribute('aria-label')).toBe('Tabella delle azioni');
    expect(wrap.tabIndex).toBe(0);
    expect(
      Array.from(wrap.querySelectorAll('thead th')).map((cell) =>
        (cell as HTMLElement).textContent?.trim(),
      ),
    ).toEqual(['#', 'Tipo', 'Da', 'A', 'Tempo']);
    const row = wrap.querySelector('tbody tr');
    expect(row.querySelectorAll('th, td').length).toBe(5);
    for (const value of ['1', 'Navigazione', 'Roma', 'Napoli'])
      expect(row.textContent).toContain(value);
  });
});

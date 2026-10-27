import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { GameDto } from '../../../shared/models/game.model';
import { GameResult } from './game-result';

const game: GameDto = {
  id: 'finished-game',
  mode: 'CLICK',
  difficulty: 'MEDIUM',
  status: 'COMPLETED',
  startPageId: 1,
  startPageTitle: 'Roma',
  currentPageId: 3,
  currentPageTitle: 'Università degli Studi di Napoli Federico II',
  clickCount: 72,
  backtrackCount: 2,
  effectivePlayTimeMs: 18000,
  startedAt: '2026-10-26T00:00:00Z',
  completedAt: '2026-10-26T00:00:18Z',
  createdAt: '2026-10-26T00:00:00Z',
  path: [
    { pageId: 1, title: 'Roma' },
    { pageId: 2, title: 'Napoli' },
    { pageId: 3, title: 'Università degli Studi di Napoli Federico II' },
  ],
  moves: [],
};

describe('GameResult presentation', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GameResult],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('shows the official primary metric and complete read-only route for both modes', () => {
    const fixture = TestBed.createComponent(GameResult);
    fixture.componentRef.setInput('game', game);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.result__primary dd').textContent.trim()).toBe(
      '72',
    );
    expect(fixture.nativeElement.querySelectorAll('.path__item').length).toBe(3);
    expect(fixture.nativeElement.querySelector('.result__destination').textContent).toContain(
      game.currentPageTitle,
    );
    expect(fixture.nativeElement.querySelector('app-game-path a, app-game-path button')).toBeNull();
    fixture.componentRef.setInput('game', { ...game, mode: 'TIME' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.result__primary dt').textContent.trim()).toBe(
      'Tempo effettivo',
    );
    expect(fixture.nativeElement.querySelector('.result__primary dd').textContent.trim()).toBe(
      '0:18',
    );
  });

  it('keeps the unsaved guest warning and existing save/return actions', () => {
    const fixture = TestBed.createComponent(GameResult);
    fixture.componentRef.setInput('game', game);
    fixture.componentRef.setInput('guest', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Questo risultato non è ancora salvato.');
    const notice = fixture.nativeElement.querySelector('.status');
    const path = fixture.nativeElement.querySelector('.result__path');
    expect(notice.compareDocumentPosition(path) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(fixture.nativeElement.querySelector('a[href="/register"]').textContent).toContain(
      'Registrati per salvare il risultato',
    );
    expect(fixture.nativeElement.querySelector('a[href="/login"]').textContent).toContain(
      'Accedi per salvare il risultato',
    );
    expect(fixture.nativeElement.querySelector('a[href="/"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('a[href="/new-game"]')).toBeNull();
  });

  it('keeps all authenticated result actions without adding a new flow', () => {
    const fixture = TestBed.createComponent(GameResult);
    fixture.componentRef.setInput('game', game);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('a[href="/history/finished-game"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('a[href="/history"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('a[href="/"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('a[href="/new-game"]')).toBeNull();
  });
});

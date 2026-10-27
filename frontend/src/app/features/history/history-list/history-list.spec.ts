import { signal } from '@angular/core';
import { provideRouter, Router, ActivatedRoute, convertToParamMap } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { HistoryList } from './history-list';
import { HistoryService } from '../../../core/services/history.service';
import { AuthService } from '../../../core/auth/auth.service';
import { ApiError } from '../../../shared/models/api-error.model';

const response = {
  mode: 'CLICK',
  difficulty: 'EASY',
  page: 1,
  limit: 20,
  total: 1,
  totalPages: 1,
  items: [
    {
      rank: 1,
      gameId: 'finished-game',
      username: 'Navigator',
      clickCount: 3,
      effectivePlayTimeMs: 58000,
      completedAt: '2026-10-26T00:00:00Z',
    },
  ],
};

describe('HistoryList presentation', () => {
  let fixture: ComponentFixture<HistoryList>;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let navigate: ReturnType<typeof vi.spyOn>;
  let list = vi.fn();
  beforeEach(async () => {
    params = new BehaviorSubject(convertToParamMap({ mode: 'CLICK', difficulty: 'EASY' }));
    list = vi.fn(() => of(response));
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: HistoryService, useValue: { list } },
        { provide: AuthService, useValue: { user: signal(null) } },
      ],
      imports: [HistoryList],
    }).compileComponents();
    const route = TestBed.inject(ActivatedRoute);
    vi.spyOn(route, 'queryParamMap', 'get').mockReturnValue(params.asObservable());
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(HistoryList);
    fixture.detectChanges();
    await fixture.whenStable();
  });
  afterEach(() => vi.restoreAllMocks());

  it('associates the reused panel with the selected tab and exposes one tab stop', () => {
    const tabs = fixture.nativeElement.querySelectorAll('[role="tab"]');
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(tabs[0].tabIndex).toBe(0);
    expect(tabs[1].tabIndex).toBe(-1);
    expect(tabs[0].getAttribute('aria-controls')).toBe('history-panel');
    expect(
      fixture.nativeElement.querySelector('[role="tabpanel"]').getAttribute('aria-labelledby'),
    ).toBe('history-mode-CLICK');
  });

  it.each([
    ['CLICK', 'ArrowRight', 'TIME'],
    ['CLICK', 'ArrowLeft', 'TIME'],
    ['TIME', 'Home', 'CLICK'],
    ['CLICK', 'End', 'TIME'],
  ])('supports %s %s focus and the existing selection query for %s', (start, key, target) => {
    params.next(convertToParamMap({ mode: start, difficulty: 'EASY', page: '3' }));
    fixture.detectChanges();
    const tab = fixture.nativeElement.querySelector(`#history-mode-${start}`) as HTMLButtonElement;
    tab.focus();
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    tab.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(
      fixture.nativeElement.querySelector(`#history-mode-${target}`),
    );
    expect(navigate).toHaveBeenLastCalledWith(
      [],
      expect.objectContaining({
        queryParams: { mode: target, page: null },
        queryParamsHandling: 'merge',
      }),
    );
    params.next(convertToParamMap({ mode: target, difficulty: 'EASY' }));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector(`#history-mode-${target}`).tabIndex).toBe(0);
    expect(
      fixture.nativeElement.querySelector('[role="tabpanel"]').getAttribute('aria-labelledby'),
    ).toBe(`history-mode-${target}`);
  });

  it('keeps all ranking data and delegates difficulty changes to the same URL query', () => {
    const row = fixture.nativeElement.querySelector('tbody tr');
    for (const value of ['Navigator', '3', '0:58']) expect(row.textContent).toContain(value);
    expect(row.querySelector('a').getAttribute('href')).toBe('/history/finished-game');
    fixture.componentInstance.selectDifficulty('HARD');
    expect(navigate).toHaveBeenLastCalledWith(
      [],
      expect.objectContaining({ queryParams: { difficulty: 'HARD', page: null } }),
    );
  });

  it('localizes the deleted-player placeholder without changing ranking data', () => {
    const item = { ...response.items[0], username: 'Deleted user' };
    fixture.componentInstance.result.set({ ...response, mode: 'CLICK', difficulty: 'EASY', items: [item] });
    fixture.detectChanges();
    const row = fixture.nativeElement.querySelector('tbody tr');
    expect(row.querySelector('.player').textContent).toContain('Utente eliminato');
    expect(row.querySelector('a').getAttribute('aria-label')).toBe(
      'Visualizza la partita di Utente eliminato',
    );
    expect(item.username).toBe('Deleted user');
  });

  it('preserves distinct empty and error states without adding a retry action', () => {
    fixture.componentInstance.result.set({
      ...response,
      mode: 'CLICK',
      difficulty: 'EASY',
      items: [],
      total: 0,
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.empty-state')).not.toBeNull();
    list.mockReturnValueOnce(
      throwError(() => new ApiError(503, 'INTERNAL_ERROR', 'History unavailable.')),
    );
    params.next(convertToParamMap({ mode: 'TIME', difficulty: 'EASY' }));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(
      'History unavailable.',
    );
    expect(fixture.nativeElement.querySelector('.empty-state')).toBeNull();
    expect(fixture.nativeElement.querySelector('[role="tabpanel"]').textContent).not.toContain(
      'Riprova',
    );
  });
});

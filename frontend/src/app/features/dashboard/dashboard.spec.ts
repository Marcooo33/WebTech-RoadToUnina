import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { Dashboard } from './dashboard';
import { AuthService } from '../../core/auth/auth.service';
import { PostAuthGuestService } from '../../core/auth/post-auth-guest.service';
import { GamesService } from '../../core/services/games.service';
import { StatsService } from '../../core/services/stats.service';
import { GameListItemDto } from '../../shared/models/game.model';

const game: GameListItemDto = {
  id: 'saved-route',
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
};

describe('Dashboard', () => {
  let component: Dashboard;
  let fixture: ComponentFixture<Dashboard>;
  let remove: ReturnType<typeof vi.fn>;
  let deletion: Subject<void>;

  beforeEach(async () => {
    deletion = new Subject();
    remove = vi.fn(() => deletion);
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { user: signal({ username: 'Navigator' }) } },
        {
          provide: PostAuthGuestService,
          useValue: {
            finish: () => Promise.resolve(),
            busy: signal(false),
            message: signal(null),
            retryable: signal(false),
          },
        },
        { provide: GamesService, useValue: { list: () => of([]), remove } },
        {
          provide: StatsService,
          useValue: {
            get: () =>
              of({
                completedGames: 1,
                inProgressGames: 0,
                bestClick: null,
                bestTime: null,
                averageClicks: 7,
                averageEffectiveTimeMs: null,
              }),
          },
        },
      ],
      imports: [Dashboard],
    }).compileComponents();
    fixture = TestBed.createComponent(Dashboard);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('puts both groups of routes before statistics in document order', () => {
    const headings = Array.from(
      fixture.nativeElement.querySelectorAll('section[aria-labelledby]'),
    ).map((section) => (section as HTMLElement).getAttribute('aria-labelledby'));
    expect(headings).toEqual(['games-title', 'completed-games-title', 'stats-title']);
  });

  it('explains average scopes and uses a returning-player safe empty action', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Average clicks · CLICK');
    expect(text).toContain('Average time · TIME');
    expect(text).toContain('Start a new game');
    expect(text).not.toContain('first game');
    expect(component.statistics()?.averageClicks).toBe(7);
    expect(component.statistics()?.averageEffectiveTimeMs).toBeNull();
  });

  it('keeps Resume navigation and requires explicit confirmation before deleting', () => {
    component.inProgress.set([game]);
    fixture.detectChanges();
    const row = fixture.nativeElement.querySelector('[data-testid="game-row"]');
    expect(row.querySelector('a').getAttribute('href')).toBe('/game/saved-route');
    row.querySelector('.game-row__delete').click();
    fixture.detectChanges();
    expect(remove).not.toHaveBeenCalled();
    const confirmation = row.querySelector('[aria-label="Confirm game deletion"]');
    confirmation.querySelector('.link-btn--danger').click();
    fixture.detectChanges();
    expect(remove).toHaveBeenCalledExactlyOnceWith('saved-route');
    expect(confirmation.textContent).toContain('Deleting…');
    expect(confirmation.querySelector('button').disabled).toBe(true);
    deletion.next();
    deletion.complete();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="game-row"]')).toBeNull();
  });

  it('shows the current limit once and preserves its disabled new-game action', () => {
    component.inProgress.set(
      Array.from({ length: 10 }, (_, index) => ({ ...game, id: `game-${index}` })),
    );
    fixture.detectChanges();
    const count = fixture.nativeElement.querySelector('#games-title .games__count');
    expect(count.textContent.trim()).toBe('10 / 10');
    expect(fixture.nativeElement.querySelectorAll('#games-title .games__count').length).toBe(1);
    expect(fixture.nativeElement.querySelector('.page-header button').disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain(
      '10-game limit',
    );
  });
});

import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  ParamMap,
  Router,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { errorInterceptor } from '../../../core/interceptors/error.interceptor';
import { LeaderboardDto } from '../../../shared/models/leaderboard.model';
import { LeaderboardPage } from './leaderboard-page';

function board(over: Partial<LeaderboardDto> = {}): LeaderboardDto {
  return {
    mode: 'CLICK',
    difficulty: 'EASY',
    items: [
      {
        rank: 1,
        gameId: 'g1',
        username: 'marco',
        clickCount: 6,
        effectivePlayTimeMs: 300_000,
        completedAt: '2026-08-01T00:00:00.000Z',
      },
      {
        rank: 2,
        gameId: 'g2',
        username: 'lucia',
        clickCount: 8,
        effectivePlayTimeMs: 200_000,
        completedAt: '2026-08-02T00:00:00.000Z',
      },
    ],
    ...over,
  };
}

describe('LeaderboardPage', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<LeaderboardPage>;
  let queryParamMap: BehaviorSubject<ParamMap>;
  let navigate: ReturnType<typeof vi.spyOn>;

  function create(): void {
    fixture = TestBed.createComponent(LeaderboardPage);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    queryParamMap = new BehaviorSubject<ParamMap>(convertToParamMap({}));

    await TestBed.configureTestingModule({
      imports: [LeaderboardPage],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { clearUser: vi.fn() } },
        { provide: ActivatedRoute, useValue: { queryParamMap } },
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });

  afterEach(() => http.verify());

  it('defaults to CLICK / EASY and canonicalises the URL', () => {
    create();

    http.expectOne('/api/leaderboards/click?difficulty=EASY').flush(board());
    expect(navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        queryParams: { mode: 'CLICK', difficulty: 'EASY' },
        replaceUrl: true,
      }),
    );
  });

  it('reads mode + difficulty from the URL without re-navigating', () => {
    queryParamMap.next(convertToParamMap({ mode: 'TIME', difficulty: 'HARD' }));
    create();

    http.expectOne('/api/leaderboards/time?difficulty=HARD').flush(board({ mode: 'TIME' }));
    expect(navigate).not.toHaveBeenCalled();
  });

  it('requests the TIME board when the mode tab changes', () => {
    queryParamMap.next(convertToParamMap({ mode: 'CLICK', difficulty: 'EASY' }));
    create();
    http.expectOne('/api/leaderboards/click?difficulty=EASY').flush(board());

    fixture.componentInstance.selectMode('TIME');
    expect(navigate).toHaveBeenLastCalledWith(
      [],
      expect.objectContaining({ queryParams: { mode: 'TIME' } }),
    );
  });

  it('always sends a difficulty when the difficulty filter changes', () => {
    queryParamMap.next(convertToParamMap({ mode: 'CLICK', difficulty: 'EASY' }));
    create();
    http.expectOne('/api/leaderboards/click?difficulty=EASY').flush(board());

    fixture.componentInstance.selectDifficulty('MEDIUM');
    expect(navigate).toHaveBeenLastCalledWith(
      [],
      expect.objectContaining({ queryParams: { difficulty: 'MEDIUM' } }),
    );
  });

  it('falls back to valid defaults for an invalid query string', () => {
    queryParamMap.next(convertToParamMap({ mode: 'nope', difficulty: 'nope' }));
    create();

    http.expectOne('/api/leaderboards/click?difficulty=EASY').flush(board());
  });

  it('renders entries in the exact order returned by the API (no client re-ranking)', () => {
    queryParamMap.next(convertToParamMap({ mode: 'TIME', difficulty: 'EASY' }));
    create();
    // API order: marco (rank 1) before lucia (rank 2), even though TIME-sorted
    // lucia has the lower effective time. The component must not reorder.
    http.expectOne('/api/leaderboards/time?difficulty=EASY').flush(board({ mode: 'TIME' }));
    fixture.detectChanges();

    const rows = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr'));
    expect(rows.map((r) => r.querySelector('td:nth-child(2)')?.textContent?.trim())).toEqual([
      'marco',
      'lucia',
    ]);
  });

  it('shows the empty-category message', () => {
    create();
    http.expectOne('/api/leaderboards/click?difficulty=EASY').flush(board({ items: [] }));
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'No completed games in this category yet.',
    );
  });

  it('drops the previous board when a re-fetch fails', () => {
    queryParamMap.next(convertToParamMap({ mode: 'CLICK', difficulty: 'EASY' }));
    create();
    http.expectOne('/api/leaderboards/click?difficulty=EASY').flush(board());
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('tbody tr')).not.toBeNull();

    queryParamMap.next(convertToParamMap({ mode: 'TIME', difficulty: 'EASY' }));
    http
      .expectOne('/api/leaderboards/time?difficulty=EASY')
      .flush(
        { error: { code: 'INTERNAL_ERROR', message: 'boom' } },
        { status: 500, statusText: 'Error' },
      );
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('table')).toBeNull();
    expect(el.textContent).not.toContain('CLICK · EASY');
  });
});

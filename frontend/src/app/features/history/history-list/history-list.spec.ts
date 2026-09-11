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
import { HistoryListDto } from '../../../shared/models/history.model';
import { HistoryList } from './history-list';

function historyPage(over: Partial<HistoryListDto> = {}): HistoryListDto {
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
    page: 1,
    limit: 20,
    total: 2,
    totalPages: 1,
    ...over,
  };
}

describe('HistoryList', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<HistoryList>;
  let queryParamMap: BehaviorSubject<ParamMap>;
  let navigate: ReturnType<typeof vi.spyOn>;

  function create(): void {
    fixture = TestBed.createComponent(HistoryList);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    queryParamMap = new BehaviorSubject<ParamMap>(convertToParamMap({}));

    await TestBed.configureTestingModule({
      imports: [HistoryList],
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

  it('defaults to CLICK / EASY, loads page one and canonicalises the URL', () => {
    create();

    const request = http.expectOne(
      '/api/history/click?difficulty=EASY&page=1&limit=20',
    );
    expect(request.request.method).toBe('GET');
    request.flush(historyPage());

    expect(navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        queryParams: { mode: 'CLICK', difficulty: 'EASY' },
        replaceUrl: true,
      }),
    );
  });

  it('reads mode, difficulty and page from the URL', () => {
    queryParamMap.next(
      convertToParamMap({ mode: 'TIME', difficulty: 'HARD', page: '2' }),
    );
    create();

    http
      .expectOne('/api/history/time?difficulty=HARD&page=2&limit=20')
      .flush(historyPage({ mode: 'TIME', difficulty: 'HARD', page: 2 }));
    expect(navigate).not.toHaveBeenCalled();
  });

  it('falls back to valid mode and difficulty defaults', () => {
    queryParamMap.next(convertToParamMap({ mode: 'nope', difficulty: 'nope' }));
    create();

    http
      .expectOne('/api/history/click?difficulty=EASY&page=1&limit=20')
      .flush(historyPage());
  });

  it('changes ranked views and resets pagination', () => {
    queryParamMap.next(convertToParamMap({ mode: 'CLICK', difficulty: 'EASY', page: '3' }));
    create();
    http
      .expectOne('/api/history/click?difficulty=EASY&page=3&limit=20')
      .flush(historyPage({ page: 3 }));

    fixture.componentInstance.selectMode('TIME');
    expect(navigate).toHaveBeenLastCalledWith(
      [],
      expect.objectContaining({ queryParams: { mode: 'TIME', page: null } }),
    );

    fixture.componentInstance.selectDifficulty('MEDIUM');
    expect(navigate).toHaveBeenLastCalledWith(
      [],
      expect.objectContaining({ queryParams: { difficulty: 'MEDIUM', page: null } }),
    );
  });

  it('renders API ranking order and links every entry to its detail', () => {
    queryParamMap.next(convertToParamMap({ mode: 'TIME', difficulty: 'EASY' }));
    create();
    http
      .expectOne('/api/history/time?difficulty=EASY&page=1&limit=20')
      .flush(historyPage({ mode: 'TIME' }));
    fixture.detectChanges();

    const rows = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr'),
    );
    expect(rows.map((row) => row.querySelector('td')?.textContent?.trim())).toEqual(['1', '2']);
    expect(rows.map((row) => row.querySelector('td:nth-child(2)')?.textContent?.trim())).toEqual([
      'marco',
      'lucia',
    ]);
    expect(rows[0].querySelector('a')?.getAttribute('href')).toBe('/history/g1');
    expect(rows[1].querySelector('a')?.getAttribute('href')).toBe('/history/g2');
  });

  it('paginates with global metadata in the URL', () => {
    create();
    http
      .expectOne('/api/history/click?difficulty=EASY&page=1&limit=20')
      .flush(historyPage({ total: 45, totalPages: 3 }));
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Page 1 of 3, showing 1–20 of 45');
    const [previous, next] = Array.from(
      element.querySelectorAll('.pager button'),
    ) as HTMLButtonElement[];
    expect(previous.disabled).toBe(true);
    expect(next.disabled).toBe(false);

    next.click();
    expect(navigate).toHaveBeenLastCalledWith(
      [],
      expect.objectContaining({ queryParams: { page: 2 } }),
    );
  });

  it('shows empty and error states without stale rows', () => {
    create();
    http
      .expectOne('/api/history/click?difficulty=EASY&page=1&limit=20')
      .flush(historyPage({ items: [], total: 0, totalPages: 0 }));
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'No completed games in this category yet.',
    );

    queryParamMap.next(convertToParamMap({ mode: 'TIME', difficulty: 'EASY' }));
    http
      .expectOne('/api/history/time?difficulty=EASY&page=1&limit=20')
      .flush(
        { error: { code: 'INTERNAL_ERROR', message: 'boom' } },
        { status: 500, statusText: 'Error' },
      );
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('table')).toBeNull();
  });
});

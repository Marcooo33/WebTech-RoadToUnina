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
import { CompletedGameSummaryDto, HistoryListDto } from '../../../shared/models/history.model';
import { HistoryList } from './history-list';

function summary(id: string): CompletedGameSummaryDto {
  return {
    gameId: id,
    mode: 'CLICK',
    difficulty: 'EASY',
    clickCount: 5,
    effectivePlayTimeMs: 60_000,
    startPageTitle: 'Start',
    completedAt: '2026-08-01T00:00:00.000Z',
    player: { id: 'u1', username: 'marco', avatarUrl: null },
  };
}

function page(over: Partial<HistoryListDto> = {}): HistoryListDto {
  return { items: [summary('g1'), summary('g2')], page: 1, limit: 20, total: 2, ...over };
}

describe('HistoryList', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<HistoryList>;
  let queryParamMap: BehaviorSubject<ParamMap>;
  let navigate: ReturnType<typeof vi.spyOn>;

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
    fixture = TestBed.createComponent(HistoryList);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('loads the first page with defaults from an empty query string', () => {
    const req = http.expectOne('/api/history?page=1&limit=20');
    expect(req.request.method).toBe('GET');
    req.flush(page());
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr')).toHaveLength(2);
  });

  it('reflects mode + difficulty + page from the URL in the API request', () => {
    http.expectOne('/api/history?page=1&limit=20').flush(page());

    queryParamMap.next(convertToParamMap({ mode: 'CLICK', difficulty: 'MEDIUM', page: '2' }));

    http
      .expectOne('/api/history?mode=CLICK&difficulty=MEDIUM&page=2&limit=20')
      .flush(page({ page: 2 }));
  });

  it('ignores invalid query parameters and falls back to defaults', () => {
    http.expectOne('/api/history?page=1&limit=20').flush(page());

    queryParamMap.next(convertToParamMap({ mode: 'BOGUS', difficulty: 'x', page: '-3' }));

    http.expectOne('/api/history?page=1&limit=20').flush(page());
  });

  it('omits the parameter entirely when a filter is set to All', () => {
    http.expectOne('/api/history?page=1&limit=20').flush(page());
    fixture.detectChanges();

    fixture.componentInstance.onDifficultyChange('MEDIUM');
    expect(navigate).toHaveBeenLastCalledWith(
      [],
      expect.objectContaining({ queryParams: { difficulty: 'MEDIUM', page: null } }),
    );

    fixture.componentInstance.onDifficultyChange('ALL');
    expect(navigate).toHaveBeenLastCalledWith(
      [],
      expect.objectContaining({ queryParams: { difficulty: null, page: null } }),
    );
  });

  it('resets page to 1 when a filter changes', () => {
    http.expectOne('/api/history?page=1&limit=20').flush(page());

    fixture.componentInstance.onModeChange('TIME');
    expect(navigate).toHaveBeenLastCalledWith(
      [],
      expect.objectContaining({ queryParams: { mode: 'TIME', page: null } }),
    );
  });

  it('paginates with Next / Previous', () => {
    http.expectOne('/api/history?page=1&limit=20').flush(page({ total: 45 }));
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Page 1 of 3, showing 1–20 of 45');

    const [prev, next] = Array.from(el.querySelectorAll('.pager button')) as HTMLButtonElement[];
    expect(prev.disabled).toBe(true);
    expect(next.disabled).toBe(false);

    next.click();
    expect(navigate).toHaveBeenLastCalledWith(
      [],
      expect.objectContaining({ queryParams: { page: 2 } }),
    );
  });

  it('shows an empty state with no completed games', () => {
    http.expectOne('/api/history?page=1&limit=20').flush(page({ items: [], total: 0 }));
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No completed games yet.');
  });

  it('keeps a working Previous control on an over-range page', () => {
    http.expectOne('/api/history?page=1&limit=20').flush(page());
    queryParamMap.next(convertToParamMap({ page: '3' }));
    http.expectOne('/api/history?page=3&limit=20').flush(page({ items: [], page: 3, total: 2 }));
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('No completed games on this page.');

    const [prev] = Array.from(el.querySelectorAll('.pager button')) as HTMLButtonElement[];
    expect(prev.disabled).toBe(false);
    prev.click();
    expect(navigate).toHaveBeenLastCalledWith(
      [],
      expect.objectContaining({ queryParams: { page: null } }),
    );
  });

  it('drops the previous page when a reload fails', () => {
    http.expectOne('/api/history?page=1&limit=20').flush(page());
    queryParamMap.next(convertToParamMap({ mode: 'TIME' }));
    http
      .expectOne('/api/history?mode=TIME&page=1&limit=20')
      .flush(
        { error: { code: 'INTERNAL_ERROR', message: 'boom' } },
        { status: 500, statusText: 'Error' },
      );
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('table')).toBeNull();
    expect(el.querySelector('.pager')).toBeNull();
  });
});

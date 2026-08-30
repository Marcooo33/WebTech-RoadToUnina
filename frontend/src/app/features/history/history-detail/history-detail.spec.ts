import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { errorInterceptor } from '../../../core/interceptors/error.interceptor';
import { CompletedGameDetailDto } from '../../../shared/models/history.model';
import { HistoryDetail } from './history-detail';

function detail(over: Partial<CompletedGameDetailDto> = {}): CompletedGameDetailDto {
  return {
    gameId: 'g1',
    mode: 'CLICK',
    difficulty: 'MEDIUM',
    clickCount: 4,
    backtrackCount: 1,
    effectivePlayTimeMs: 125_000,
    startPageId: 100,
    startPageTitle: 'Start',
    completedAt: '2026-08-01T10:00:00.000Z',
    path: [
      { pageId: 100, title: 'Start' },
      { pageId: 200, title: 'Federico II' },
    ],
    moves: [
      {
        sequence: 1,
        type: 'NAVIGATION',
        fromPageId: 100,
        fromPageTitle: 'Start',
        toPageId: 150,
        toPageTitle: 'Middle',
        createdAt: '2026-08-01T09:58:00.000Z',
      },
      {
        sequence: 2,
        type: 'BACKTRACK',
        fromPageId: 150,
        fromPageTitle: 'Middle',
        toPageId: 100,
        toPageTitle: 'Start',
        createdAt: '2026-08-01T09:59:00.000Z',
      },
      {
        sequence: 3,
        type: 'NAVIGATION',
        fromPageId: 100,
        fromPageTitle: 'Start',
        toPageId: 200,
        toPageTitle: 'Federico II',
        createdAt: '2026-08-01T10:00:00.000Z',
      },
    ],
    player: { id: 'u1', username: 'marco', avatarUrl: null },
    ...over,
  };
}

describe('HistoryDetail', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<HistoryDetail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HistoryDetail],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { clearUser: vi.fn() } },
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(HistoryDetail);
    fixture.componentRef.setInput('id', 'g1');
  });

  afterEach(() => http.verify());

  function load(dto = detail()): HTMLElement {
    fixture.detectChanges();
    http.expectOne('/api/history/g1').flush(dto);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders the completed-game facts and player', () => {
    const el = load();
    expect(el.textContent).toContain('marco');
    expect(el.textContent).toContain('CLICK');
    expect(el.textContent).toContain('MEDIUM');
    expect(el.textContent).toContain('2:05'); // 125s effective time
  });

  it('renders the reconstructed path with a "target" badge on the final node', () => {
    const el = load();
    const titles = Array.from(el.querySelectorAll('.path__title')).map((n) =>
      n.textContent?.trim(),
    );
    expect(titles).toEqual(['Start', 'Federico II']);
    expect(el.querySelector('.path__badge')?.textContent?.trim()).toBe('target');
  });

  it('renders every move and marks BACKTRACK rows distinctly', () => {
    const el = load();
    const rows = Array.from(el.querySelectorAll('.moves tbody tr'));
    expect(rows).toHaveLength(3);

    const backtrackRows = rows.filter((r) => r.classList.contains('moves__row--backtrack'));
    expect(backtrackRows).toHaveLength(1);
    expect(backtrackRows[0].textContent).toContain('BACKTRACK');
    expect(rows[0].classList.contains('moves__row--backtrack')).toBe(false);
    expect(rows[0].textContent).toContain('NAVIGATION');
  });

  it('shows a placeholder when there is no move history', () => {
    const el = load(detail({ moves: [] }));
    expect(el.textContent).toContain('No moves were recorded.');
  });
});

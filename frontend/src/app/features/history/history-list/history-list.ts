import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import { EMPTY, catchError, distinctUntilChanged, map, switchMap, tap } from 'rxjs';
import { HistoryService } from '../../../core/services/history.service';
import { AuthService } from '../../../core/auth/auth.service';
import { ApiError } from '../../../shared/models/api-error.model';
import { GameDifficulty, GameMode } from '../../../shared/models/game.model';
import { HistoryEntryDto, HistoryListDto } from '../../../shared/models/history.model';
import { DurationPipe } from '../../../shared/pipes/duration.pipe';
import { parseDifficulty, parseMode, parsePage } from '../../../shared/util/enum-params';
import { ErrorBanner } from '../../../shared/components/error-banner/error-banner';
import { LoadingSpinner } from '../../../shared/components/loading-spinner/loading-spinner';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucideArrowRight,
  lucideClock3,
  lucideMousePointerClick,
} from '@ng-icons/lucide';

const PAGE_SIZE = 20;
const DEFAULT_MODE: GameMode = 'CLICK';
const DEFAULT_DIFFICULTY: GameDifficulty = 'EASY';

interface HistorySelection {
  mode: GameMode;
  difficulty: GameDifficulty;
  page: number;
}

/**
 * Public completed-game History uses two ranked views, with selection and
 * pagination persisted in the URL.
 */
@Component({
  selector: 'app-history-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe, DurationPipe, ErrorBanner, LoadingSpinner, NgIcon],
  providers: [
    provideIcons({ lucideArrowLeft, lucideArrowRight, lucideClock3, lucideMousePointerClick }),
  ],
  templateUrl: './history-list.html',
  styleUrl: './history-list.css',
})
export class HistoryList {
  private readonly history = inject(HistoryService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly currentUser = inject(AuthService).user;

  readonly modes: readonly GameMode[] = ['CLICK', 'TIME'];
  readonly difficulties: readonly GameDifficulty[] = ['EASY', 'MEDIUM', 'HARD'];

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly result = signal<HistoryListDto | null>(null);
  readonly selection = signal<HistorySelection>({
    mode: DEFAULT_MODE,
    difficulty: DEFAULT_DIFFICULTY,
    page: 1,
  });

  readonly primaryMetric = computed<'clicks' | 'time'>(() =>
    this.selection().mode === 'TIME' ? 'time' : 'clicks',
  );

  /** Derived paging summary for the template (`Page X, showing N–M of total`). */
  readonly pagination = computed(() => {
    const res = this.result();
    if (!res) return null;
    const totalPages = Math.max(1, res.totalPages);
    const start = res.total === 0 || res.items.length === 0 ? 0 : (res.page - 1) * res.limit + 1;
    const end = Math.min(res.page * res.limit, res.total);
    return {
      page: res.page,
      totalPages,
      start,
      end,
      total: res.total,
      hasPrev: res.page > 1,
      hasNext: res.page < totalPages,
      // Clamp Previous so a stale/over-range `?page=` still lands on a real page.
      prevPage: Math.max(1, Math.min(res.page - 1, totalPages)),
      nextPage: res.page + 1,
    };
  });

  get items(): HistoryEntryDto[] {
    return this.result()?.items ?? [];
  }

  get emptyMessage(): string {
    const p = this.pagination();
    if (p && p.page > 1) {
      return 'No completed games on this page.';
    }
    return 'No completed games in this category yet.';
  }

  constructor() {
    this.route.queryParamMap
      .pipe(
        map((params) => ({
          mode: parseMode(params.get('mode')) ?? DEFAULT_MODE,
          difficulty: parseDifficulty(params.get('difficulty')) ?? DEFAULT_DIFFICULTY,
          page: parsePage(params.get('page')),
          rawMode: params.get('mode'),
          rawDifficulty: params.get('difficulty'),
        })),
        tap(({ mode, difficulty, rawMode, rawDifficulty }) => {
          if (rawMode !== mode || rawDifficulty !== difficulty) {
            void this.router.navigate([], {
              relativeTo: this.route,
              queryParams: { mode, difficulty },
              queryParamsHandling: 'merge',
              replaceUrl: true,
            });
          }
        }),
        map(({ mode, difficulty, page }): HistorySelection => ({ mode, difficulty, page })),
        distinctUntilChanged(
          (a, b) => a.mode === b.mode && a.difficulty === b.difficulty && a.page === b.page,
        ),
        tap((selection) => {
          this.selection.set(selection);
          this.loading.set(true);
          this.error.set(null);
        }),
        switchMap((selection) =>
          this.history
            .list(selection.mode, {
              difficulty: selection.difficulty,
              page: selection.page,
              limit: PAGE_SIZE,
            })
            .pipe(
              catchError((err: ApiError) => {
                // Drop the previous page: the filter controls already reflect the
                // new selection, so stale rows/pager under the error banner would
                // be misleading.
                this.result.set(null);
                this.error.set(err.message);
                this.loading.set(false);
                return EMPTY;
              }),
            ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((res) => {
        this.result.set(res);
        this.loading.set(false);
      });
  }

  selectMode(mode: GameMode): void {
    this.updateQuery({ mode, page: null });
  }

  selectDifficulty(difficulty: GameDifficulty): void {
    this.updateQuery({ difficulty, page: null });
  }

  goToPage(page: number): void {
    this.updateQuery({ page: page <= 1 ? null : page });
  }

  private updateQuery(patch: Params): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: patch,
      queryParamsHandling: 'merge',
    });
  }
}

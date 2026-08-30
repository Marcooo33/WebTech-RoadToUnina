import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import { EMPTY, catchError, map, switchMap, tap } from 'rxjs';
import { HistoryService } from '../../../core/services/history.service';
import { ApiError } from '../../../shared/models/api-error.model';
import { GameDifficulty, GameMode } from '../../../shared/models/game.model';
import { CompletedGameSummaryDto, HistoryListDto } from '../../../shared/models/history.model';
import { DurationPipe } from '../../../shared/pipes/duration.pipe';
import { parseDifficulty, parseMode, parsePage } from '../../../shared/util/enum-params';
import { ErrorBanner } from '../../../shared/components/error-banner/error-banner';
import { LoadingSpinner } from '../../../shared/components/loading-spinner/loading-spinner';

/** `limit` fixed by the API contract for the public history list (docs/api.md §2.7). */
const PAGE_SIZE = 20;

interface HistoryFilters {
  mode: GameMode | null;
  difficulty: GameDifficulty | null;
  page: number;
}

/**
 * Public completed-game history (docs/api.md §7.1). Filter (mode / difficulty)
 * and pagination state live entirely in the URL query string, so browser
 * back/forward restores the exact view. `All` is a UI-only state and is never
 * serialized — the corresponding query parameter is simply omitted.
 */
@Component({
  selector: 'app-history-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe, DurationPipe, ErrorBanner, LoadingSpinner],
  templateUrl: './history-list.html',
  styleUrl: './history-list.css',
})
export class HistoryList {
  private readonly history = inject(HistoryService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly result = signal<HistoryListDto | null>(null);
  readonly filters = signal<HistoryFilters>({ mode: null, difficulty: null, page: 1 });

  /** Derived paging summary for the template (`Page X, showing N–M of total`). */
  readonly pagination = computed(() => {
    const res = this.result();
    if (!res) return null;
    const totalPages = Math.max(1, Math.ceil(res.total / res.limit));
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

  get items(): CompletedGameSummaryDto[] {
    return this.result()?.items ?? [];
  }

  get filtered(): boolean {
    const f = this.filters();
    return f.mode !== null || f.difficulty !== null;
  }

  /** Empty-results message, distinguishing "nothing at all" from "nothing on
   *  this (over-range) page". */
  get emptyMessage(): string {
    const p = this.pagination();
    if (p && p.page > 1) {
      return 'No completed games on this page.';
    }
    return this.filtered ? 'No completed games match these filters.' : 'No completed games yet.';
  }

  constructor() {
    this.route.queryParamMap
      .pipe(
        map((params): HistoryFilters => ({
          mode: parseMode(params.get('mode')),
          difficulty: parseDifficulty(params.get('difficulty')),
          page: parsePage(params.get('page')),
        })),
        tap((filters) => {
          this.filters.set(filters);
          this.loading.set(true);
          this.error.set(null);
        }),
        switchMap((filters) =>
          this.history
            .list({
              page: filters.page,
              limit: PAGE_SIZE,
              ...(filters.mode ? { mode: filters.mode } : {}),
              ...(filters.difficulty ? { difficulty: filters.difficulty } : {}),
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

  onModeChange(value: string): void {
    this.updateQuery({ mode: value === 'ALL' ? null : value, page: null });
  }

  onDifficultyChange(value: string): void {
    this.updateQuery({ difficulty: value === 'ALL' ? null : value, page: null });
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

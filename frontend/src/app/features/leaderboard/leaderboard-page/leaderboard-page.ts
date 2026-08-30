import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { EMPTY, catchError, distinctUntilChanged, map, switchMap, tap } from 'rxjs';
import { LeaderboardService } from '../../../core/services/leaderboard.service';
import { ApiError } from '../../../shared/models/api-error.model';
import { GameDifficulty, GameMode } from '../../../shared/models/game.model';
import { LeaderboardDto } from '../../../shared/models/leaderboard.model';
import { DurationPipe } from '../../../shared/pipes/duration.pipe';
import { parseDifficulty, parseMode } from '../../../shared/util/enum-params';
import { ErrorBanner } from '../../../shared/components/error-banner/error-banner';
import { LoadingSpinner } from '../../../shared/components/loading-spinner/loading-spinner';

const DEFAULT_MODE: GameMode = 'CLICK';
const DEFAULT_DIFFICULTY: GameDifficulty = 'EASY';

interface Selection {
  mode: GameMode;
  difficulty: GameDifficulty;
}

/**
 * Public leaderboards (docs/api.md §7.2). Two boards (CLICK / TIME), each filtered
 * by a required difficulty. Mode and difficulty are held in the URL query string
 * so a board is shareable and survives back/forward. The API requires a
 * difficulty, so both parameters are canonicalised to valid defaults.
 *
 * Ranking and tie-breaking are the backend's responsibility: entries are rendered
 * in the exact order the API returns them (docs/game-rules.md §18, §20).
 */
@Component({
  selector: 'app-leaderboard-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, DurationPipe, ErrorBanner, LoadingSpinner],
  templateUrl: './leaderboard-page.html',
  styleUrl: './leaderboard-page.css',
})
export class LeaderboardPage {
  private readonly leaderboard = inject(LeaderboardService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly modes: readonly GameMode[] = ['CLICK', 'TIME'];
  readonly difficulties: readonly GameDifficulty[] = ['EASY', 'MEDIUM', 'HARD'];

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly board = signal<LeaderboardDto | null>(null);
  readonly selection = signal<Selection>({ mode: DEFAULT_MODE, difficulty: DEFAULT_DIFFICULTY });

  readonly primaryMetric = computed<'clicks' | 'time'>(() =>
    this.selection().mode === 'TIME' ? 'time' : 'clicks',
  );

  constructor() {
    this.route.queryParamMap
      .pipe(
        map((params) => ({
          mode: parseMode(params.get('mode')) ?? DEFAULT_MODE,
          difficulty: parseDifficulty(params.get('difficulty')) ?? DEFAULT_DIFFICULTY,
          rawMode: params.get('mode'),
          rawDifficulty: params.get('difficulty'),
        })),
        tap(({ mode, difficulty, rawMode, rawDifficulty }) => {
          // Canonicalise a missing/invalid query string to the resolved values.
          if (rawMode !== mode || rawDifficulty !== difficulty) {
            void this.router.navigate([], {
              relativeTo: this.route,
              queryParams: { mode, difficulty },
              queryParamsHandling: 'merge',
              replaceUrl: true,
            });
          }
        }),
        map(({ mode, difficulty }): Selection => ({ mode, difficulty })),
        distinctUntilChanged((a, b) => a.mode === b.mode && a.difficulty === b.difficulty),
        tap((selection) => {
          this.selection.set(selection);
          this.loading.set(true);
          this.error.set(null);
        }),
        switchMap((selection) =>
          this.leaderboard.get(selection.mode, selection.difficulty).pipe(
            catchError((err: ApiError) => {
              // Drop the previous board: the tabs/column highlight already
              // reflect the new selection, so keeping stale rows would misrepresent
              // them under the error banner.
              this.board.set(null);
              this.error.set(err.message);
              this.loading.set(false);
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((board) => {
        this.board.set(board);
        this.loading.set(false);
      });
  }

  selectMode(mode: GameMode): void {
    this.updateQuery({ mode });
  }

  selectDifficulty(difficulty: GameDifficulty): void {
    this.updateQuery({ difficulty });
  }

  private updateQuery(patch: Partial<Selection>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: patch,
      queryParamsHandling: 'merge',
    });
  }
}

import { GameLabelPipe } from '../../shared/pipes/game-label.pipe';
import { PostAuthGuestService } from '../../core/auth/post-auth-guest.service';
import { DatePipe, DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { GamesService } from '../../core/services/games.service';
import { StatsService } from '../../core/services/stats.service';
import { ApiError } from '../../shared/models/api-error.model';
import { GameListItemDto } from '../../shared/models/game.model';
import { StatisticsDto } from '../../shared/models/stats.model';
import { DurationPipe } from '../../shared/pipes/duration.pipe';
import { ErrorBanner } from '../../shared/components/error-banner/error-banner';
import { LoadingSpinner } from '../../shared/components/loading-spinner/loading-spinner';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideClock3,
  lucideMousePointerClick,
  lucidePlay,
  lucidePlus,
  lucideTrash2,
  lucideArrowRight,
} from '@ng-icons/lucide';

const IN_PROGRESS_LIMIT = 10;
const RECENT_COMPLETED_LIMIT = 5;

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe,
    GameLabelPipe,
    RouterLink,
    DatePipe,
    DurationPipe,
    ErrorBanner,
    LoadingSpinner,
    NgIcon,
  ],
  providers: [
    provideIcons({
      lucideArrowRight,
      lucideClock3,
      lucideMousePointerClick,
      lucidePlay,
      lucidePlus,
      lucideTrash2,
    }),
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit {
  readonly guestContinuation = inject(PostAuthGuestService);
  private readonly auth = inject(AuthService);
  private readonly games = inject(GamesService);
  private readonly stats = inject(StatsService);
  private readonly router = inject(Router);

  readonly user = this.auth.user;
  readonly limit = IN_PROGRESS_LIMIT;

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly inProgress = signal<GameListItemDto[]>([]);
  readonly completed = signal<GameListItemDto[]>([]);
  readonly showAllCompleted = signal(false);
  readonly statistics = signal<StatisticsDto | null>(null);
  readonly visibleCompleted = computed(() =>
    this.showAllCompleted() ? this.completed() : this.completed().slice(0, RECENT_COMPLETED_LIMIT),
  );

  // Id of the game whose inline "delete?" confirmation is currently shown.
  readonly confirmingId = signal<string | null>(null);
  // Id of the game whose delete request is in flight.
  readonly deletingId = signal<string | null>(null);

  get limitReached(): boolean {
    return this.inProgress().length >= IN_PROGRESS_LIMIT;
  }

  ngOnInit(): void {
    void this.guestContinuation.finish().then(() => this.load());
  }

  async retryGuest(): Promise<void> {
    await this.guestContinuation.finish(true);
    this.load(false);
  }

  // (Re)loads the in-progress list and statistics. showSpinner is false for a
  // background refresh (e.g. after a conflicting delete) so the table isn't
  // replaced by a full-card spinner while an error banner is already shown.
  private load(showSpinner = true): void {
    if (showSpinner) {
      this.loading.set(true);
    }
    forkJoin({
      inProgress: this.games.list('IN_PROGRESS'),
      completed: this.games.list('COMPLETED'),
      stats: this.stats.get(),
    }).subscribe({
      next: ({ inProgress, completed, stats }) => {
        this.inProgress.set(inProgress);
        this.completed.set(
          [...completed].sort(
            (a, b) => Date.parse(b.completedAt ?? '') - Date.parse(a.completedAt ?? ''),
          ),
        );
        this.statistics.set(stats);
        this.loading.set(false);
      },
      error: (err: ApiError) => {
        this.error.set(err.message);
        this.loading.set(false);
      },
    });
  }

  toggleCompleted(): void {
    this.showAllCompleted.update((showAll) => !showAll);
  }

  openGame(event: Event, game: GameListItemDto): void {
    if (event.target instanceof Element && event.target.closest('a, button')) {
      return;
    }

    void this.router.navigate([game.status === 'COMPLETED' ? '/history' : '/game', game.id]);
  }

  openGameFromKeyboard(event: Event, game: GameListItemDto): void {
    if (event.target !== event.currentTarget) {
      return;
    }

    event.preventDefault();
    this.openGame(event, game);
  }

  askDelete(gameId: string): void {
    this.error.set(null);
    this.confirmingId.set(gameId);
  }

  cancelDelete(): void {
    this.confirmingId.set(null);
  }

  confirmDelete(game: GameListItemDto): void {
    if (this.deletingId()) {
      return;
    }
    this.deletingId.set(game.id);
    this.error.set(null);

    // The backend validates ownership and that the game is still IN_PROGRESS.
    this.games.remove(game.id).subscribe({
      next: () => {
        this.inProgress.update((list) => list.filter((g) => g.id !== game.id));
        this.statistics.update((s) =>
          s ? { ...s, inProgressGames: Math.max(0, s.inProgressGames - 1) } : s,
        );
        this.deletingId.set(null);
        this.confirmingId.set(null);
      },
      error: (err: ApiError) => {
        this.deletingId.set(null);
        this.confirmingId.set(null);
        this.error.set(err.message);
        // The game completed elsewhere or is already gone, so the local list
        // is stale: refresh it in the background.
        if (err.code === 'GAME_NOT_FOUND' || err.code === 'GAME_NOT_IN_PROGRESS') {
          this.load(false);
        }
      },
    });
  }
}

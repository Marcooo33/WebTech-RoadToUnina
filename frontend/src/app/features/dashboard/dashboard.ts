import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
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

const IN_PROGRESS_LIMIT = 10;

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DurationPipe, ErrorBanner, LoadingSpinner],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly games = inject(GamesService);
  private readonly stats = inject(StatsService);

  readonly user = this.auth.user;
  readonly limit = IN_PROGRESS_LIMIT;

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly inProgress = signal<GameListItemDto[]>([]);
  readonly statistics = signal<StatisticsDto | null>(null);

  get limitReached(): boolean {
    return this.inProgress().length >= IN_PROGRESS_LIMIT;
  }

  ngOnInit(): void {
    forkJoin({
      games: this.games.list('IN_PROGRESS'),
      stats: this.stats.get(),
    }).subscribe({
      next: ({ games, stats }) => {
        this.inProgress.set(games);
        this.statistics.set(stats);
        this.loading.set(false);
      },
      error: (err: ApiError) => {
        this.error.set(err.message);
        this.loading.set(false);
      },
    });
  }
}

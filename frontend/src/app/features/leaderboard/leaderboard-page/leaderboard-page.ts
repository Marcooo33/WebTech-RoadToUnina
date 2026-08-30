import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { LeaderboardService } from '../../../core/services/leaderboard.service';
import { ApiError } from '../../../shared/models/api-error.model';
import { LeaderboardDto } from '../../../shared/models/leaderboard.model';
import { DurationPipe } from '../../../shared/pipes/duration.pipe';
import { ErrorBanner } from '../../../shared/components/error-banner/error-banner';
import { LoadingSpinner } from '../../../shared/components/loading-spinner/loading-spinner';

/**
 * Public leaderboard. Milestone 12 shows one fixed board (CLICK / EASY); the
 * mode tabs and difficulty filter are Milestone 15.
 */
@Component({
  selector: 'app-leaderboard-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, DurationPipe, ErrorBanner, LoadingSpinner],
  templateUrl: './leaderboard-page.html',
})
export class LeaderboardPage implements OnInit {
  private readonly leaderboard = inject(LeaderboardService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly board = signal<LeaderboardDto | null>(null);

  ngOnInit(): void {
    this.leaderboard.get('CLICK', 'EASY').subscribe({
      next: (board) => {
        this.board.set(board);
        this.loading.set(false);
      },
      error: (err: ApiError) => {
        this.error.set(err.message);
        this.loading.set(false);
      },
    });
  }
}

import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HistoryService } from '../../../core/services/history.service';
import { ApiError } from '../../../shared/models/api-error.model';
import { CompletedGameDetailDto } from '../../../shared/models/history.model';
import { DurationPipe } from '../../../shared/pipes/duration.pipe';
import { ErrorBanner } from '../../../shared/components/error-banner/error-banner';
import { LoadingSpinner } from '../../../shared/components/loading-spinner/loading-spinner';

/**
 * Public completed-game detail. Milestone 12 renders the core facts and the
 * reconstructed path; richer move-history visualisation is Milestone 15.
 */
@Component({
  selector: 'app-history-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe, DurationPipe, ErrorBanner, LoadingSpinner],
  templateUrl: './history-detail.html',
})
export class HistoryDetail implements OnInit {
  private readonly history = inject(HistoryService);

  /** `history/:id` path parameter (bound via router input binding). */
  readonly id = input.required<string>();

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly game = signal<CompletedGameDetailDto | null>(null);

  ngOnInit(): void {
    this.history.get(this.id()).subscribe({
      next: (game) => {
        this.game.set(game);
        this.loading.set(false);
      },
      error: (err: ApiError) => {
        this.error.set(err.message);
        this.loading.set(false);
      },
    });
  }
}

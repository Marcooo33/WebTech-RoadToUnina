import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HistoryService } from '../../../core/services/history.service';
import { ApiError } from '../../../shared/models/api-error.model';
import { CompletedGameSummaryDto } from '../../../shared/models/history.model';
import { DurationPipe } from '../../../shared/pipes/duration.pipe';
import { ErrorBanner } from '../../../shared/components/error-banner/error-banner';
import { LoadingSpinner } from '../../../shared/components/loading-spinner/loading-spinner';

/**
 * Public completed-game list. Milestone 12 shows the first page with default
 * ordering only; mode/difficulty filtering and pagination controls are Milestone 15.
 */
@Component({
  selector: 'app-history-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe, DurationPipe, ErrorBanner, LoadingSpinner],
  templateUrl: './history-list.html',
})
export class HistoryList implements OnInit {
  private readonly history = inject(HistoryService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly items = signal<CompletedGameSummaryDto[]>([]);
  readonly total = signal(0);

  ngOnInit(): void {
    this.history.list().subscribe({
      next: (res) => {
        this.items.set(res.items);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: (err: ApiError) => {
        this.error.set(err.message);
        this.loading.set(false);
      },
    });
  }
}

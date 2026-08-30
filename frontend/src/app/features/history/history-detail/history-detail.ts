import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HistoryService } from '../../../core/services/history.service';
import { ApiError } from '../../../shared/models/api-error.model';
import { CompletedGameDetailDto } from '../../../shared/models/history.model';
import { DurationPipe } from '../../../shared/pipes/duration.pipe';
import { GamePath } from '../../game/game-path/game-path';
import { ErrorBanner } from '../../../shared/components/error-banner/error-banner';
import { LoadingSpinner } from '../../../shared/components/loading-spinner/loading-spinner';

/**
 * Public completed-game detail (docs/api.md §7.1.2): the completed facts, the
 * reconstructed path and the full chronological move history. Read-only and
 * anonymous — no game state is mutated here.
 */
@Component({
  selector: 'app-history-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe, DurationPipe, GamePath, ErrorBanner, LoadingSpinner],
  templateUrl: './history-detail.html',
  styleUrl: './history-detail.css',
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

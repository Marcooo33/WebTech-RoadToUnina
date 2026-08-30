import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GamesService } from '../../../core/services/games.service';
import { ApiError } from '../../../shared/models/api-error.model';
import { GameDto } from '../../../shared/models/game.model';
import { DurationPipe } from '../../../shared/pipes/duration.pipe';
import { ErrorBanner } from '../../../shared/components/error-banner/error-banner';
import { LoadingSpinner } from '../../../shared/components/loading-spinner/loading-spinner';

/**
 * Shell-level game view: loads the authoritative game state and shows it
 * read-only. The Wikipedia-like article rendering and the move/backtrack/session
 * interactions belong to Milestone 14.
 */
@Component({
  selector: 'app-game-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DurationPipe, ErrorBanner, LoadingSpinner],
  templateUrl: './game-page.html',
})
export class GamePage implements OnInit {
  private readonly games = inject(GamesService);

  /** `game/:id` path parameter (bound via router input binding). */
  readonly id = input.required<string>();

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly game = signal<GameDto | null>(null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.games.get(this.id()).subscribe({
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

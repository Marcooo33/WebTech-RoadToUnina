import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GameDto } from '../../../shared/models/game.model';
import { DurationPipe } from '../../../shared/pipes/duration.pipe';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowRight, lucideCheckCircle2, lucideHistory, lucideHouse } from '@ng-icons/lucide';

/**
 * Completion state for a game whose status is `COMPLETED`. Every value shown
 * here is the server's finalized state (docs/game-rules.md §17); the frontend
 * never marks a game complete itself.
 */
@Component({
  selector: 'app-game-result',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DurationPipe, NgIcon],
  providers: [provideIcons({ lucideArrowRight, lucideCheckCircle2, lucideHistory, lucideHouse })],
  templateUrl: './game-result.html',
  styleUrl: './game-result.css',
})
export class GameResult {
  readonly game = input.required<GameDto>();
}

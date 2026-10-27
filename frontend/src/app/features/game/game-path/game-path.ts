import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { PageRef } from '../../../shared/models/game.model';

// Reconstructed navigation path from the start page to the last one,
// rendered read-only. Used both for the active path during gameplay and for
// the finished path in public history. Purely presentational.
@Component({
  selector: 'app-game-path',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './game-path.html',
  styleUrl: './game-path.css',
})
export class GamePath {
  readonly path = input.required<PageRef[]>();

  // Badge on the final node: "current" while playing, "target" in history.
  readonly lastLabel = input('current');

  // Accessible name for the nav landmark, overridden in public history.
  readonly ariaLabel = input('Percorso attivo');
}

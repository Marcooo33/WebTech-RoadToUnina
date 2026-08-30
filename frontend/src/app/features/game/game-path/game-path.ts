import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { PageRef } from '../../../shared/models/game.model';

/**
 * A reconstructed navigation path (start page → last page), rendered read-only.
 * Used by the gameplay screen for the active path and by the public completed-game
 * history for the finished path. Purely presentational.
 */
@Component({
  selector: 'app-game-path',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './game-path.html',
  styleUrl: './game-path.css',
})
export class GamePath {
  readonly path = input.required<PageRef[]>();

  /** Badge shown on the final node. `current` while playing, `target` for a
   *  completed game in public history. */
  readonly lastLabel = input('current');

  /** Accessible name for the `<nav>` landmark: `Active path` during gameplay,
   *  overridden for the finished path shown in public history. */
  readonly ariaLabel = input('Active path');
}

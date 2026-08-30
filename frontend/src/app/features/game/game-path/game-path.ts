import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { PageRef } from '../../../shared/models/game.model';

/**
 * The active navigation path (start page → current page), reconstructed
 * server-side and passed in via {@link GameDto.path}. Purely presentational.
 */
@Component({
  selector: 'app-game-path',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './game-path.html',
  styleUrl: './game-path.css',
})
export class GamePath {
  readonly path = input.required<PageRef[]>();
}

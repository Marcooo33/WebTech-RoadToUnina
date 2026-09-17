import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { GameDto } from '../../../shared/models/game.model';
import { DurationPipe } from '../../../shared/pipes/duration.pipe';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideClock3,
  lucideFlag,
  lucideMousePointerClick,
  lucideRotateCcw,
} from '@ng-icons/lucide';

const MEDIUM_BACKTRACK_LIMIT = 3;

/**
 * Game HUD: mode, difficulty, the (display-only) effective timer, click count
 * and the backtracking status/control. The backend stays authoritative for
 * whether a backtrack is actually allowed; the button only reflects state the
 * client already knows so obviously-invalid requests are not sent.
 */
@Component({
  selector: 'app-game-hud',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DurationPipe, NgIcon],
  providers: [provideIcons({ lucideClock3, lucideFlag, lucideMousePointerClick, lucideRotateCcw })],
  templateUrl: './game-hud.html',
  styleUrl: './game-hud.css',
})
export class GameHud {
  readonly game = input.required<GameDto>();
  /** Milliseconds to display; owned and computed by {@link GamePage}. */
  readonly displayTimeMs = input.required<number>();
  /** A gameplay mutation (move/backtrack) is in flight. */
  readonly busy = input(false);

  readonly backtrack = output<void>();

  /** Remaining MEDIUM backtracks, never negative. */
  readonly backtracksLeft = computed(() =>
    Math.max(0, MEDIUM_BACKTRACK_LIMIT - this.game().backtrackCount),
  );

  readonly canBacktrack = computed(() => {
    const game = this.game();
    if (this.busy()) return false;
    if (game.difficulty === 'HARD') return false;
    if (game.path.length <= 1) return false;
    if (game.difficulty === 'MEDIUM' && game.backtrackCount >= MEDIUM_BACKTRACK_LIMIT) return false;
    return true;
  });
}

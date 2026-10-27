import { GameLabelPipe } from '../../../shared/pipes/game-label.pipe';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { GameDto } from '../../../shared/models/game.model';
import { DurationPipe } from '../../../shared/pipes/duration.pipe';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideFlag, lucideLogOut, lucideRotateCcw } from '@ng-icons/lucide';

const MEDIUM_BACKTRACK_LIMIT = 3;

// Mode, difficulty, timer, click count and backtrack button. The button only
// avoids obviously-invalid requests; the backend has the final say.
@Component({
  selector: 'app-game-hud',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GameLabelPipe, DurationPipe, NgIcon],
  providers: [provideIcons({ lucideFlag, lucideLogOut, lucideRotateCcw })],
  templateUrl: './game-hud.html',
  styleUrl: './game-hud.css',
})
export class GameHud {
  readonly game = input.required<GameDto>();
  // Milliseconds to display; owned and computed by GamePage.
  readonly displayTimeMs = input.required<number>();
  // A gameplay mutation (move/backtrack) is in flight.
  readonly busy = input(false);

  readonly exitRequested = output<void>();
  readonly backtrack = output<void>();
  readonly pathRequested = output<void>();
  readonly heightChanged = output<number>();
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly pathTrigger = viewChild<ElementRef<HTMLButtonElement>>('pathTrigger');

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      this.measureHeight();
      if (typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(() => this.measureHeight());
      observer.observe(this.host.nativeElement);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  measureHeight(): void {
    const compact = window.matchMedia?.('(max-width: 1119px)').matches ?? false;
    this.heightChanged.emit(compact ? this.host.nativeElement.getBoundingClientRect().height : 0);
  }

  focusPathTrigger(): boolean {
    const trigger = this.pathTrigger()?.nativeElement;
    if (!trigger?.getClientRects().length) return false;
    trigger.focus({ preventScroll: true });
    return trigger.ownerDocument.activeElement === trigger;
  }

  // Remaining MEDIUM backtracks, never negative.
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

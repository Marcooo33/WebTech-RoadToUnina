import { GameLabelPipe } from '../../../shared/pipes/game-label.pipe';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GameDto } from '../../../shared/models/game.model';
import { DurationPipe } from '../../../shared/pipes/duration.pipe';
import { GamePath } from '../game-path/game-path';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowRight,
  lucideCheckCircle2,
  lucideFlag,
  lucideHistory,
  lucideHouse,
} from '@ng-icons/lucide';

// Completion state for a COMPLETED game. Every value shown here is the
// server's finalized state; the frontend never marks a game complete itself.
@Component({
  selector: 'app-game-result',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GameLabelPipe, RouterLink, DurationPipe, NgIcon, GamePath],
  providers: [
    provideIcons({ lucideArrowRight, lucideCheckCircle2, lucideFlag, lucideHistory, lucideHouse }),
  ],
  templateUrl: './game-result.html',
  styleUrl: './game-result.css',
})
export class GameResult {
  readonly guest = input(false);
  readonly game = input.required<GameDto>();
}

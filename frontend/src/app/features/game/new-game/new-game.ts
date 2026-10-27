import { GAME_LABELS } from '../../../shared/pipes/game-label.pipe';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { GamesService } from '../../../core/services/games.service';
import { ApiError } from '../../../shared/models/api-error.model';
import { GameDifficulty, GameMode } from '../../../shared/models/game.model';
import { ErrorBanner } from '../../../shared/components/error-banner/error-banner';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucideClock3,
  lucideMousePointerClick,
  lucidePlay,
} from '@ng-icons/lucide';

interface ModeOption {
  value: GameMode;
  label: string;
  description: string;
}

interface DifficultyOption {
  value: GameDifficulty;
  label: string;
  backtracking: string;
}

// Game creation screen. Only mode and difficulty are chosen here; the
// backend picks the random starting page and owns every other value.
@Component({
  selector: 'app-new-game',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, ErrorBanner, NgIcon],
  providers: [provideIcons({ lucideArrowLeft, lucideClock3, lucideMousePointerClick, lucidePlay })],
  templateUrl: './new-game.html',
  styleUrl: './new-game.css',
})
export class NewGame {
  private readonly fb = inject(FormBuilder);
  private readonly games = inject(GamesService);
  private readonly router = inject(Router);

  readonly modes: readonly ModeOption[] = [
    {
      value: 'CLICK',
      label: GAME_LABELS.CLICK,
      description: 'Raggiungi la destinazione con il minor numero di click sui link.',
    },
    {
      value: 'TIME',
      label: GAME_LABELS.TIME,
      description: 'Raggiungi la destinazione nel minor tempo effettivo di gioco.',
    },
  ];

  readonly difficulties: readonly DifficultyOption[] = [
    { value: 'EASY', label: GAME_LABELS.EASY, backtracking: 'Puoi tornare indietro senza limiti.' },
    {
      value: 'MEDIUM',
      label: GAME_LABELS.MEDIUM,
      backtracking: 'Puoi tornare indietro al massimo 3 volte.',
    },
    { value: 'HARD', label: GAME_LABELS.HARD, backtracking: 'Non puoi tornare indietro.' },
  ];

  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly errorCode = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    mode: this.fb.nonNullable.control<GameMode>('CLICK', Validators.required),
    difficulty: this.fb.nonNullable.control<GameDifficulty>('EASY', Validators.required),
  });

  get limitReached(): boolean {
    return this.errorCode() === 'GAME_LIMIT_REACHED';
  }

  submit(): void {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    this.errorCode.set(null);

    const { mode, difficulty } = this.form.getRawValue();
    this.games.create(mode, difficulty).subscribe({
      next: (game) => {
        this.router.navigate(['/game', game.id]).catch(() => {
          // The game exists on the server, only the client-side navigation failed.
          this.submitting.set(false);
          this.error.set(
            'La partita è stata creata, ma non è stato possibile aprirla. Puoi aprirla dal riepilogo.',
          );
        });
      },
      error: (err: ApiError) => {
        this.submitting.set(false);
        this.error.set(err.message);
        this.errorCode.set(err.code);
      },
    });
  }
}

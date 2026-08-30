import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Placeholder route. The mode/difficulty selection flow and game creation belong
 * to Milestone 13 — this component only reserves the `/new-game` URL for the shell.
 */
@Component({
  selector: 'app-new-game',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <section class="card stack">
      <h1 class="page-title">New game</h1>
      <p class="muted">
        The game creation screen (mode and difficulty selection) is added in a later milestone.
      </p>
      <a routerLink="/dashboard">Back to dashboard</a>
    </section>
  `,
})
export class NewGame {}

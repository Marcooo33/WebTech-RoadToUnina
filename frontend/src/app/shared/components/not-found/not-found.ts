import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <section class="empty-state not-found">
      <p class="eyebrow">404</p>
      <h1>Pagina non trovata</h1>
      <p class="muted">La pagina che cerchi non esiste o potrebbe essere stata spostata.</p>
      <a class="btn" routerLink="/">Torna a ROADTOUNINA</a>
    </section>
  `,
  styles: `
    .not-found {
      max-width: 34rem;
      margin: var(--space-8) auto;
    }
  `,
})
export class NotFound {}

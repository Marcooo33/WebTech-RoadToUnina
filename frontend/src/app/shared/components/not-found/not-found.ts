import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <section class="empty-state not-found">
      <p class="eyebrow">404</p>
      <h1>Page not found</h1>
      <p class="muted">The page you are looking for does not exist or may have moved.</p>
      <a class="btn" routerLink="/">Back to ROADTOUNINA</a>
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

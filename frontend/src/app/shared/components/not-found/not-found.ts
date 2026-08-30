import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <section class="page">
      <h1>Page not found</h1>
      <p>The page you are looking for does not exist.</p>
      <a routerLink="/">Back to home</a>
    </section>
  `,
})
export class NotFound {}

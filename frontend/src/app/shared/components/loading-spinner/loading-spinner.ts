import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Minimal loading indicator reused by feature pages while a request is in flight. */
@Component({
  selector: 'app-loading-spinner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<p class="loading" role="status">{{ label() }}</p>`,
  styles: `
    .loading {
      color: var(--color-muted);
      padding: var(--space-4) 0;
    }
  `,
})
export class LoadingSpinner {
  readonly label = input('Loading…');
}

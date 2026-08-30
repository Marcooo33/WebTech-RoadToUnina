import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Inline error message reused by feature pages when a request fails. */
@Component({
  selector: 'app-error-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (message()) {
      <p class="error" role="alert">{{ message() }}</p>
    }
  `,
  styles: `
    .error {
      background: var(--color-danger-bg);
      border: 1px solid var(--color-danger-border);
      color: var(--color-danger-text);
      border-radius: var(--radius);
      padding: var(--space-3) var(--space-4);
      margin: var(--space-3) 0;
    }
  `,
})
export class ErrorBanner {
  readonly message = input<string | null>(null);
}

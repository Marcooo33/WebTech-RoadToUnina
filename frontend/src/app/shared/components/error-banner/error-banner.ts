import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Inline error message reused by feature pages when a request fails. */
@Component({
  selector: 'app-error-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (message()) {
      <p class="error" role="alert">
        <span class="error__icon" aria-hidden="true">!</span>
        <span class="error__message">{{ message() }}</span>
      </p>
    }
  `,
  styles: `
    .error {
      display: flex;
      align-items: flex-start;
      gap: var(--space-3);
      background: var(--color-danger-bg);
      border: 1px solid var(--color-danger-border);
      color: var(--color-danger-text);
      border-radius: var(--radius);
      padding: var(--space-3) var(--space-4);
      margin: var(--space-3) 0;
    }
    .error__message {
      min-width: 0;
      overflow-wrap: anywhere;
    }
    .error__icon {
      display: grid;
      flex: 0 0 1.35rem;
      height: 1.35rem;
      place-items: center;
      border-radius: 50%;
      background: var(--color-danger-text);
      color: white;
      font-size: 0.8rem;
      font-weight: 800;
    }
  `,
})
export class ErrorBanner {
  readonly message = input<string | null>(null);
}

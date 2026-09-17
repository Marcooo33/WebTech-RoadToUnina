import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Minimal loading indicator reused by feature pages while a request is in flight. */
@Component({
  selector: 'app-loading-spinner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<p class="loading" role="status">
    <span class="spinner" aria-hidden="true"></span>{{ label() }}
  </p>`,
  styles: `
    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-3);
      color: var(--color-muted);
      padding: var(--space-5) 0;
      margin: 0;
    }
    .spinner {
      width: 1.15rem;
      height: 1.15rem;
      border: 2px solid var(--color-border-strong);
      border-top-color: var(--color-accent);
      border-radius: 50%;
      animation: spin 0.75s linear infinite;
    }
    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .spinner {
        animation: none;
        border-top-color: var(--color-brand);
      }
    }
  `,
})
export class LoadingSpinner {
  readonly label = input('Loading…');
}

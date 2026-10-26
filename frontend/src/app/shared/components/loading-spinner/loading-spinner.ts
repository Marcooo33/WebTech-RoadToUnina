import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Minimal loading indicator reused by feature pages while a request is in flight. */
@Component({
  selector: 'app-loading-spinner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<p class="loading" role="status">
    <span class="spinner" aria-hidden="true"></span><span>{{ label() }}</span>
  </p>`,
  styles: `
    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-2);
      color: var(--color-muted);
      padding: var(--space-5) 0;
      margin: 0;
    }
    .spinner {
      flex: none;
      width: 14px;
      height: 14px;
      border: 2px solid #b6c9f7;
      border-top-color: var(--color-accent);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
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

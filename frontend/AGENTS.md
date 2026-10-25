# Frontend Guidelines

## Angular & TypeScript

This directory uses Angular 22, TypeScript 6, and CSS, not SCSS. Follow the existing standalone component pattern: `app-` selectors, explicit template imports, `ChangeDetectionStrategy.OnPush`, and `inject()` for dependencies. Use signals/computed values and `input()`/`output()` as neighboring components do; retain RxJS for HTTP and asynchronous flows.

Feature components belong in `src/app/features/`; shared presentation belongs in `shared/components/`; HTTP access stays in `core/` services. Keep page orchestration separate from presentational children, as in `game-page` and `game-hud`. Most components use adjacent `.ts`, `.html`, and `.css` files; small shared components also use inline templates/styles. Do not rename classes to impose a `Component` suffix.

Follow `.editorconfig`: two spaces, single quotes in TypeScript, final newlines. `.prettierrc` sets a 100-character print width and the Angular HTML parser. Preserve the compiler checks in the existing tsconfig files.

## UI & UX Maintenance

Preserve the established cream canvas, navy/blue palette, typography, spacing, and card/button patterns. Reuse tokens and shared classes in `src/styles.css` (`--color-*`, `--space-*`, radii, focus ring, `.container`, `.card`) before adding styles. Keep feature-specific CSS local; shared-style changes affect every screen.

Use `NgIcon` and `provideIcons` from `@ng-icons/core` with existing `@ng-icons/lucide` icons, following `shared/components/nav-bar/`. Reuse `ErrorBanner` and `LoadingSpinner`; keep loading, error, empty, disabled, and retry states consistent.

Check narrow screens down to the existing 320px minimum, desktop layouts, wrapping, and overflow. Preserve semantic controls, labels, keyboard navigation, visible focus, accessible icon-button names, status/alert announcements, and reduced-motion support.

Keep visual changes in templates/CSS and presentational components where practical. Pure UI work must not alter routes, authentication, API contracts, guest recovery, or gameplay/timer behavior. Prefer straightforward CSS and existing components over new UI frameworks or complex state machinery.

## Validation

From this directory, run `npm test -- --watch=false` for Angular/Vitest tests (`*.spec.ts` beside source) and `npm run build` for template/type checks and production size budgets. For visual edits, inspect affected screens at mobile and desktop sizes, including relevant states; update behavior tests only when behavior changes. Use root guidance for cross-stack browser tests.

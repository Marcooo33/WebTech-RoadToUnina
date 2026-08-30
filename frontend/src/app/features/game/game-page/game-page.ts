import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { interval } from 'rxjs';
import { GameSessionService } from '../../../core/services/game-session.service';
import { GamesService } from '../../../core/services/games.service';
import { ApiError } from '../../../shared/models/api-error.model';
import { SessionResponseDto } from '../../../shared/models/article.model';
import { GameDto } from '../../../shared/models/game.model';
import { ErrorBanner } from '../../../shared/components/error-banner/error-banner';
import { LoadingSpinner } from '../../../shared/components/loading-spinner/loading-spinner';
import { GameHud } from '../game-hud/game-hud';
import { GamePath } from '../game-path/game-path';
import { GameResult } from '../game-result/game-result';
import { WikipediaArticle } from '../wikipedia-article/wikipedia-article';

type Phase = 'loading' | 'playing' | 'completed' | 'error';

interface RenderedArticle {
  version: number;
  pageId: number;
  title: string;
  html: SafeHtml;
}

/** Backend heartbeat timeout is 90s (config/session.ts); a 30s cadence keeps
 *  three attempts of margin before a session is considered expired. */
const HEARTBEAT_INTERVAL_MS = 30_000;
const TIMER_TICK_MS = 1_000;

/**
 * Gameplay orchestrator. Owns the authoritative game/session/article state and
 * every API call; the child components are presentational.
 *
 * Authority rules (AGENTS.md §5, docs/game-rules.md §20): this component only
 * *requests* actions (navigate to a page id, backtrack, start/heartbeat a
 * session). Counters, timing, completion and concurrency are decided by the
 * backend; every authoritative value shown here comes from a server response.
 * The displayed timer is visual only and is never sent back.
 */
@Component({
  selector: 'app-game-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    ErrorBanner,
    LoadingSpinner,
    GameHud,
    GamePath,
    GameResult,
    WikipediaArticle,
  ],
  templateUrl: './game-page.html',
  styleUrl: './game-page.css',
})
export class GamePage implements OnInit, OnDestroy {
  private readonly games = inject(GamesService);
  private readonly sessions = inject(GameSessionService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly router = inject(Router);

  /** `game/:id` path parameter (router input binding). */
  readonly id = input.required<string>();

  readonly phase = signal<Phase>('loading');
  readonly game = signal<GameDto | null>(null);
  readonly article = signal<RenderedArticle | null>(null);
  /** Hard, non-recoverable error. */
  readonly error = signal<string | null>(null);
  /** Transient banner for a recoverable conflict (auto-cleared on next action). */
  readonly notice = signal<string | null>(null);
  /** A gameplay mutation or a recovery is in flight. */
  readonly busy = signal(false);
  /** Show a "retry" affordance for a failed article fetch. */
  readonly wikipediaRetry = signal(false);

  /** Effective-time baseline: accumulated ms confirmed by the server, re-seeded
   *  only when a *fresh* session is established (start/expiry recovery) — never
   *  from a plain heartbeat or a same-session resync (docs/api.md §6.2). */
  private baselineEffectiveMs = 0;
  /** `Date.now()` captured when `baselineEffectiveMs` was set (0 = not yet). */
  private sessionBaselineClientTs = 0;
  /** Id of the session the timer baseline belongs to; drives the "fresh session"
   *  decision in {@link applySessionSync}. */
  private activeSessionId: string | null = null;
  /** Guards against overlapping recovery flows. */
  private recovering = false;

  private readonly tick = signal(Date.now());

  /** Display-only effective time: baseline + wall-clock delta while playing,
   *  frozen at the server's finalized value otherwise. Never sent back. */
  readonly displayTimeMs = computed(() => {
    const game = this.game();
    if (!game) return 0;
    if (this.phase() === 'playing' && this.sessionBaselineClientTs !== 0) {
      return this.baselineEffectiveMs + Math.max(0, this.tick() - this.sessionBaselineClientTs);
    }
    return game.effectivePlayTimeMs;
  });

  constructor() {
    interval(TIMER_TICK_MS)
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        if (this.phase() === 'playing') {
          this.tick.set(Date.now());
        }
      });

    interval(HEARTBEAT_INTERVAL_MS)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.sendHeartbeat());
  }

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.endSessionBestEffort();
  }

  @HostListener('window:beforeunload')
  onBeforeUnload(): void {
    this.endSessionBestEffort();
  }

  // --- User actions -------------------------------------------------------

  onNavigate(toPageId: number): void {
    const game = this.game();
    if (!game || this.busy() || this.recovering || this.phase() !== 'playing') {
      return;
    }
    this.busy.set(true);
    this.notice.set(null);

    this.games.move(this.id(), toPageId, game.version).subscribe({
      next: (updated) => {
        this.applyGame(updated);
        if (this.phase() === 'completed') return;
        this.article.set(null);
        this.fetchArticle();
      },
      error: (err: ApiError) => this.onGameplayError(err),
    });
  }

  onBacktrack(): void {
    const game = this.game();
    if (!game || this.busy() || this.recovering || this.phase() !== 'playing') {
      return;
    }
    this.busy.set(true);
    this.notice.set(null);

    this.games.backtrack(this.id(), game.version).subscribe({
      next: (updated) => {
        this.applyGame(updated);
        if (this.phase() === 'completed') return;
        this.article.set(null);
        this.fetchArticle();
      },
      error: (err: ApiError) => this.onGameplayError(err),
    });
  }

  retry(): void {
    this.error.set(null);
    this.notice.set(null);
    this.wikipediaRetry.set(false);

    // An in-place article retry is only safe while already playing with a live
    // session baseline. Any other state (error, no session established yet) goes
    // through a full reload so game + session + article are all re-established
    // and the timer baseline is valid.
    if (this.phase() === 'playing' && this.activeSessionId !== null) {
      this.busy.set(true);
      this.fetchArticle();
      return;
    }
    this.load();
  }

  // --- Load / recovery ---------------------------------------------------

  private load(): void {
    this.phase.set('loading');
    this.error.set(null);
    this.notice.set(null);

    this.games.get(this.id()).subscribe({
      next: (game) => {
        this.game.set(game);
        if (game.status === 'COMPLETED') {
          this.enterCompleted();
          return;
        }
        this.startSession();
      },
      error: (err: ApiError) => this.onInitialError(err),
    });
  }

  private startSession(): void {
    this.sessions.start(this.id()).subscribe({
      next: (res) => {
        this.applySessionSync(res);
        this.fetchArticle();
      },
      error: (err: ApiError) => this.onInitialError(err),
    });
  }

  /**
   * The single authoritative-resync path, shared by `STALE_VERSION`,
   * `NO_ACTIVE_SESSION` and `GAME_NOT_IN_PROGRESS` recovery:
   * reload the game → if completed show the result → otherwise (re)establish the
   * session, re-sync timing/version, reload the article, return to `playing`.
   *
   * It never re-issues the rejected move/backtrack — the user repeats the action
   * once the UI has re-synchronized (docs/api.md §9.2–9.3).
   */
  private resync(notice: string | null): void {
    if (this.recovering) return;
    this.recovering = true;
    this.busy.set(true);
    this.notice.set(notice);

    this.games.get(this.id()).subscribe({
      next: (game) => {
        this.game.set(game);
        if (game.status === 'COMPLETED') {
          this.enterCompleted();
          return;
        }
        this.sessions.start(this.id()).subscribe({
          next: (res) => {
            this.applySessionSync(res);
            this.fetchArticle(true);
          },
          error: (err: ApiError) => {
            // Terminal on purpose: do NOT re-enter resync() from here. If the
            // game completed between the GET above and this start, or the
            // session cannot be re-established, land on a manual-retry state
            // rather than looping GET+POST with no backoff.
            this.recovering = false;
            this.busy.set(false);
            if (err.code === 'GAME_NOT_FOUND') {
              void this.router.navigate(['/dashboard']);
              return;
            }
            this.error.set('Could not re-establish your play session. Try again.');
            this.phase.set('error');
          },
        });
      },
      error: (err: ApiError) => {
        this.recovering = false;
        this.busy.set(false);
        if (err.code === 'GAME_NOT_FOUND') {
          void this.router.navigate(['/dashboard']);
          return;
        }
        this.error.set(err.message);
        this.phase.set('error');
      },
    });
  }

  /**
   * Loads the current article and validates it against the game version/page we
   * hold. A response for a different version is stale: it is discarded (never
   * rendered) and a resync is triggered instead. `afterResync` breaks the loop
   * if it is still inconsistent immediately after a fresh resync.
   */
  private fetchArticle(afterResync = false): void {
    this.wikipediaRetry.set(false);

    this.games.getArticle(this.id()).subscribe({
      next: (dto) => {
        const game = this.game();
        if (!game || dto.version !== game.version || dto.pageId !== game.currentPageId) {
          if (afterResync) {
            this.recovering = false;
            this.busy.set(false);
            this.error.set('The game kept changing while loading. Reload the page to continue.');
            this.phase.set('error');
            return;
          }
          this.resync('Game state changed — reloading the article.');
          return;
        }

        this.article.set({
          version: dto.version,
          pageId: dto.pageId,
          title: dto.title,
          html: this.trustArticleHtml(dto.contentHtml),
        });
        this.phase.set('playing');
        this.busy.set(false);
        this.recovering = false;
      },
      error: (err: ApiError) => this.onArticleError(err),
    });
  }

  // --- Error handling --------------------------------------------------

  private onInitialError(err: ApiError): void {
    if (err.code === 'GAME_NOT_FOUND') {
      void this.router.navigate(['/dashboard']);
      return;
    }
    if (err.code === 'GAME_NOT_IN_PROGRESS') {
      this.resync(null);
      return;
    }
    this.error.set(err.message);
    this.phase.set('error');
  }

  private onArticleError(err: ApiError): void {
    this.busy.set(false);
    this.recovering = false;

    switch (err.code) {
      case 'GAME_NOT_FOUND':
        void this.router.navigate(['/dashboard']);
        return;
      case 'GAME_NOT_IN_PROGRESS':
        this.resync(null);
        return;
      default: {
        // Transient: upstream Wikipedia (502), network, or a proxy 5xx with no
        // envelope. The game state is intact — always surface a retry rather
        // than stranding the user on a "Loading article…" spinner.
        const message =
          err.code === 'WIKIPEDIA_UNAVAILABLE'
            ? 'Wikipedia is temporarily unavailable.'
            : 'The article could not be loaded.';
        this.article.set(null);
        this.wikipediaRetry.set(true);
        if (this.phase() === 'loading') {
          this.phase.set('error');
          this.error.set(message);
        } else {
          this.notice.set(message);
        }
      }
    }
  }

  private onGameplayError(err: ApiError): void {
    this.busy.set(false);

    switch (err.code) {
      case 'NO_ACTIVE_SESSION':
        this.resync('Your play session expired and was resumed. Make the move again when ready.');
        return;
      case 'STALE_VERSION':
        this.resync('The game changed elsewhere and was reloaded. Try the action again.');
        return;
      case 'GAME_NOT_IN_PROGRESS':
        this.resync(null);
        return;
      case 'INVALID_MOVE':
        this.notice.set('That link is no longer available here. The article was refreshed.');
        this.busy.set(true);
        this.fetchArticle();
        return;
      case 'BACKTRACK_NOT_ALLOWED':
      case 'BACKTRACK_LIMIT_REACHED':
        this.notice.set(err.message);
        this.refreshGameOnly();
        return;
      case 'WIKIPEDIA_UNAVAILABLE':
        this.notice.set('Wikipedia is temporarily unavailable. Please try again.');
        return;
      case 'GAME_NOT_FOUND':
        void this.router.navigate(['/dashboard']);
        return;
      default:
        this.error.set(err.message);
    }
  }

  // --- State synchronization helpers ---------------------------------

  /** Applies a complete authoritative {@link GameDto}. */
  private applyGame(game: GameDto): void {
    this.game.set(game);
    if (game.status === 'COMPLETED') {
      this.enterCompleted();
    }
  }

  /**
   * Applies the timing/version fields a {@link SessionResponseDto} is
   * authoritative for.
   *
   * The visual-timer baseline is re-seeded ONLY for a *fresh* session (a new
   * session id): initial start, or recovery after the previous session expired
   * — cases where the server has finalized prior time into `effectivePlayTimeMs`
   * and handed back a clean clock. For a same-session response (a STALE_VERSION
   * or article-mismatch resync, where `POST /session` is idempotent and returns
   * the still-running session), `effectivePlayTimeMs` does NOT include the
   * running session's elapsed time (docs/api.md §6.2), so re-baselining would
   * rewind the visible timer by minutes. There we sync only the version.
   */
  private applySessionSync(res: SessionResponseDto): void {
    const game = this.game();
    if (game) {
      this.game.set({
        ...game,
        version: res.gameVersion,
        effectivePlayTimeMs: res.effectivePlayTimeMs,
        activeSession: res.session,
      });
    }

    const freshSession = res.session.id !== this.activeSessionId;
    this.activeSessionId = res.session.id;

    if (freshSession) {
      this.baselineEffectiveMs = res.effectivePlayTimeMs;
      this.sessionBaselineClientTs = Date.now();
      this.tick.set(this.sessionBaselineClientTs);
    }
  }

  private enterCompleted(): void {
    this.phase.set('completed');
    this.article.set(null);
    this.busy.set(false);
    this.recovering = false;
    this.notice.set(null);
  }

  private refreshGameOnly(): void {
    this.games.get(this.id()).subscribe({
      next: (game) => this.applyGame(game),
      error: () => {
        // Non-critical: the HUD stays as-is until the next authoritative response.
      },
    });
  }

  private sendHeartbeat(): void {
    if (this.phase() !== 'playing' || this.recovering) {
      return;
    }
    this.sessions.heartbeat(this.id()).subscribe({
      next: () => {
        // Deliberately does NOT touch the timer baseline or game state. A plain
        // heartbeat does not persist the running session's elapsed time into
        // Game.effectivePlayTimeMs (docs/api.md §6.2); re-baselining from its
        // response would make the visible timer jump backwards.
      },
      error: (err: ApiError) => {
        if (err.code === 'NO_ACTIVE_SESSION') {
          this.resync('Your play session expired and was resumed.');
        }
        // Any other error is transient — the next heartbeat retries.
      },
    });
  }

  private endSessionBestEffort(): void {
    // End on teardown whenever a session was established for this game — not just
    // while 'playing'. A session started during load but abandoned before the
    // article finished would otherwise linger for the full heartbeat timeout and
    // unfairly inflate effective play time (AGENTS.md §8). The backend already
    // ends the session on completion, so skip that case.
    if (this.activeSessionId !== null && this.phase() !== 'completed') {
      this.sessions.endOnTeardown(this.id());
    }
  }

  private trustArticleHtml(contentHtml: string): SafeHtml {
    // SECURITY TRUST BOUNDARY.
    // `contentHtml` comes from ArticleDto returned by the ROADTOUNINA backend,
    // which fetches the MediaWiki article and runs it through a strict
    // server-side sanitizer (tag allowlist, every href removed, no URL schemes)
    // before it is ever sent here (docs/architecture.md §8–9, AGENTS.md §11).
    // We bypass Angular's sanitizer only so it does not strip the backend's
    // `data-page-id` / `data-page-title` attributes, which drive in-sandbox
    // navigation.
    // NEVER pass raw MediaWiki HTML, or any other external / user-provided HTML,
    // through this bypass — only ArticleDto.contentHtml from our own API.
    return this.sanitizer.bypassSecurityTrustHtml(contentHtml);
  }
}

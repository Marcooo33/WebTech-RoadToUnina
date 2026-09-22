import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  OnInit,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { interval } from 'rxjs';
import { GamesService } from '../../../core/services/games.service';
import { ApiError } from '../../../shared/models/api-error.model';
import { GameDto } from '../../../shared/models/game.model';
import { ArticleDto } from '../../../shared/models/article.model';
import { ErrorBanner } from '../../../shared/components/error-banner/error-banner';
import { LoadingSpinner } from '../../../shared/components/loading-spinner/loading-spinner';
import { GameHud } from '../game-hud/game-hud';
import { GamePath } from '../game-path/game-path';
import { GameResult } from '../game-result/game-result';
import { WikipediaArticle } from '../wikipedia-article/wikipedia-article';

type Phase = 'loading' | 'playing' | 'completed' | 'error';

interface RenderedArticle {
  pageId: number;
  title: string;
  html: SafeHtml;
}

/** Keep-alive cadence. The heartbeat only advances a timestamp on the game, so
 *  ~12s (docs/api.md §6) bounds how much pre-crash time can be lost while adding
 *  negligible load. */
const HEARTBEAT_INTERVAL_MS = 12_000;
const TIMER_TICK_MS = 1_000;

/**
 * Gameplay orchestrator. Owns the authoritative game/article state and every API
 * call; the child components are presentational.
 *
 * Authority rules (AGENTS.md §5, docs/game-rules.md §20): this component only
 * *requests* actions (navigate to a page id, backtrack, heartbeat). Counters,
 * timing, completion and validation are decided by the backend; every
 * authoritative value shown here comes from a server response. The displayed
 * timer is animated locally for smoothness and is never sent back — the backend
 * remains authoritative for the persisted/final effective play time.
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
export class GamePage implements OnInit {
  private readonly games = inject(GamesService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly articleStart = viewChild<ElementRef<HTMLElement>>('articleStart');

  /** `game/:id` path parameter (router input binding). */
  readonly id = input.required<string>();

  readonly phase = signal<Phase>('loading');
  readonly game = signal<GameDto | null>(null);
  readonly article = signal<RenderedArticle | null>(null);
  /** Hard, non-recoverable error. */
  readonly error = signal<string | null>(null);
  /** Transient banner for a recoverable condition (auto-cleared on next action). */
  readonly notice = signal<string | null>(null);
  /** A gameplay mutation or an article fetch is in flight. */
  readonly busy = signal(false);
  /** Display value captured when a server-controlled article transition starts. */
  private readonly frozenTimeMs = signal<number | null>(null);
  /** Show a "retry" affordance for a failed article fetch. */
  readonly wikipediaRetry = signal(false);

  /** Effective-time baseline: `effectivePlayTimeMs` confirmed by the server when
   *  the game was (re)loaded. The backend has just (re)started the play interval,
   *  so this is current as of `baselineClientTs`. */
  private baselineEffectiveMs = 0;
  /** `Date.now()` captured when `baselineEffectiveMs` was set (0 = not yet). */
  private baselineClientTs = 0;
  /** Last article for which the viewport position was handled. Kept separately
   *  because a transient fetch error may clear `article` before retrying it. */
  private lastDisplayedArticlePageId: number | null = null;

  private readonly tick = signal(Date.now());

  /** Display-only effective time: server baseline + wall-clock delta while
   *  playing, frozen at the server's finalized value otherwise. Never sent back. */
  readonly displayTimeMs = computed(() => {
    const game = this.game();
    if (!game) return 0;
    const frozen = this.frozenTimeMs();
    if (frozen !== null) return frozen;
    if (this.phase() === 'playing' && this.baselineClientTs !== 0) {
      return this.baselineEffectiveMs + Math.max(0, this.tick() - this.baselineClientTs);
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

  // --- User actions -------------------------------------------------------

  onNavigate(toTitle: string): void {
    if (!this.game() || this.busy() || this.phase() !== 'playing') {
      return;
    }
    this.busy.set(true);
    this.freezeTimer();
    this.notice.set(null);

    this.games.move(this.id(), toTitle).subscribe({
      next: (state) => {
        this.applyGame(state.game);
        if (this.phase() === 'completed') return;
        if (!state.article || state.article.pageId !== state.game.currentPageId) {
          this.load();
          return;
        }
        this.applyPreparedArticle(state.article);
        this.seedTimerBaseline(state.game);
        this.finishNavigation();
      },
      error: (err: ApiError) => this.onGameplayError(err),
    });
  }

  onBacktrack(): void {
    if (!this.game() || this.busy() || this.phase() !== 'playing') {
      return;
    }
    this.busy.set(true);
    this.freezeTimer();
    this.notice.set(null);

    this.games.backtrack(this.id()).subscribe({
      next: (state) => {
        this.applyGame(state.game);
        if (this.phase() === 'completed') return;
        if (!state.article || state.article.pageId !== state.game.currentPageId) {
          this.load();
          return;
        }
        this.applyPreparedArticle(state.article);
        this.seedTimerBaseline(state.game);
        this.finishNavigation();
      },
      error: (err: ApiError) => this.onGameplayError(err),
    });
  }

  retry(): void {
    this.error.set(null);
    this.notice.set(null);
    this.wikipediaRetry.set(false);

    if (this.phase() === 'playing') {
      this.busy.set(true);
      this.fetchArticle();
      return;
    }
    this.load();
  }

  // --- Load / reconcile -------------------------------------------------

  /**
   * Loads the game and its already-prepared article in one response. The backend
   * starts the resumed interval only after that article is ready.
   */
  private load(): void {
    this.phase.set('loading');
    this.error.set(null);
    this.notice.set(null);

    this.games.get(this.id()).subscribe({
      next: (state) => {
        this.applyGame(state.game);
        if (this.phase() === 'completed') {
          return;
        }
        if (!state.article || state.article.pageId !== state.game.currentPageId) {
          this.onInitialError(
            new ApiError(500, 'INTERNAL_ERROR', 'The game and article state did not match.'),
          );
          return;
        }
        this.applyPreparedArticle(state.article);
        this.seedTimerBaseline(state.game);
        this.phase.set('playing');
        this.busy.set(false);
        this.frozenTimeMs.set(null);
      },
      error: (err: ApiError) => this.onInitialError(err),
    });
  }

  private fetchArticle(): void {
    this.wikipediaRetry.set(false);

    this.games.getArticle(this.id()).subscribe({
      next: (dto) => {
        const game = this.game();
        if (!game || dto.pageId !== game.currentPageId) {
          // The game moved on between the two requests — reload once so game and
          // article are consistent again.
          this.load();
          return;
        }

        this.article.set({
          pageId: dto.pageId,
          title: dto.title,
          html: this.trustArticleHtml(dto.contentHtml),
        });
        this.phase.set('playing');
        this.busy.set(false);
      },
      error: (err: ApiError) => this.onArticleError(err),
    });
  }

  // --- Error handling --------------------------------------------------

  private onInitialError(err: ApiError): void {
    this.busy.set(false);
    this.frozenTimeMs.set(null);
    if (err.code === 'GAME_NOT_FOUND') {
      void this.router.navigate(['/']);
      return;
    }
    this.error.set(err.message);
    this.phase.set('error');
  }

  private onArticleError(err: ApiError): void {
    this.busy.set(false);
    this.resumeVisualTimer();

    switch (err.code) {
      case 'GAME_NOT_FOUND':
        void this.router.navigate(['/']);
        return;
      case 'GAME_NOT_IN_PROGRESS':
        this.load();
        return;
      default: {
        // Transient: upstream Wikipedia (502), network, or a proxy 5xx. The game
        // state is intact — surface a retry rather than a dead spinner.
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
    this.resumeVisualTimer();

    switch (err.code) {
      case 'GAME_NOT_IN_PROGRESS':
        // The game completed or changed elsewhere — reconcile with the server.
        this.load();
        return;
      case 'GAME_STATE_CHANGED':
        // Another request committed while this action's article was prepared.
        // Reload the coherent authoritative game/article pair.
        this.load();
        return;
      case 'INVALID_MOVE':
        this.notice.set('That link is no longer available here. The article was refreshed.');
        this.busy.set(true);
        this.fetchArticle();
        return;
      case 'BACKTRACK_NOT_ALLOWED':
      case 'BACKTRACK_LIMIT_REACHED':
        this.notice.set(err.message);
        return;
      case 'WIKIPEDIA_UNAVAILABLE':
        this.notice.set('Wikipedia is temporarily unavailable. Please try again.');
        return;
      case 'GAME_NOT_FOUND':
        void this.router.navigate(['/']);
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

  private seedTimerBaseline(game: GameDto): void {
    this.baselineEffectiveMs = game.effectivePlayTimeMs;
    this.baselineClientTs = Date.now();
    this.tick.set(this.baselineClientTs);
  }

  private enterCompleted(): void {
    this.phase.set('completed');
    this.article.set(null);
    this.busy.set(false);
    this.frozenTimeMs.set(null);
    this.notice.set(null);
  }

  private sendHeartbeat(): void {
    if (this.phase() !== 'playing' || this.busy()) {
      return;
    }
    this.games.heartbeat(this.id()).subscribe({
      error: (err: ApiError) => {
        // Network / transient failures are non-fatal — the next heartbeat retries
        // and gameplay is unaffected. Only an explicit "not in progress" means
        // the client's view is stale and must be reconciled.
        if (err.code === 'GAME_NOT_IN_PROGRESS') {
          this.load();
        }
      },
    });
  }

  private trustArticleHtml(contentHtml: string): SafeHtml {
    // SECURITY TRUST BOUNDARY.
    // `contentHtml` comes from ArticleDto returned by the ROADTOUNINA backend,
    // which fetches the MediaWiki article and runs it through a strict
    // server-side sanitizer (tag allowlist, every href removed, validated HTTPS images)
    // before it is ever sent here (docs/architecture.md §8–9, AGENTS.md §11).
    // We bypass Angular's sanitizer only so it does not strip the backend's
    // `data-page-title` attributes, which drive in-sandbox
    // navigation.
    // NEVER pass raw MediaWiki HTML, or any other external / user-provided HTML,
    // through this bypass — only ArticleDto.contentHtml from our own API.
    return this.sanitizer.bypassSecurityTrustHtml(contentHtml);
  }

  private applyPreparedArticle(dto: ArticleDto): void {
    const isNewPage = dto.pageId !== this.lastDisplayedArticlePageId;

    this.article.set({
      pageId: dto.pageId,
      title: dto.title,
      html: this.trustArticleHtml(dto.contentHtml),
    });

    if (isNewPage) {
      this.lastDisplayedArticlePageId = dto.pageId;
      afterNextRender(
        () =>
          this.articleStart()?.nativeElement.scrollIntoView({
            behavior: 'instant',
            block: 'start',
          }),
        { injector: this.injector },
      );
    }
  }

  private freezeTimer(): void {
    this.frozenTimeMs.set(this.displayTimeMs());
  }

  private resumeVisualTimer(): void {
    this.tick.set(Date.now());
    this.frozenTimeMs.set(null);
  }

  private finishNavigation(): void {
    this.busy.set(false);
    this.frozenTimeMs.set(null);
  }
}

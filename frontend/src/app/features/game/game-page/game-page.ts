import { GuestGamesService } from '../../../core/services/guest-games.service';
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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, catchError, interval, map, of } from 'rxjs';
import { GamesService } from '../../../core/services/games.service';
import { ApiError } from '../../../shared/models/api-error.model';
import { GameDto, PreparedGameStateDto } from '../../../shared/models/game.model';
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

const TIMER_TICK_MS = 1_000;

// Gameplay orchestrator: owns game/article state and every API call; child
// components are presentational. The backend decides counters, timing and
// moves; the displayed timer is animated locally and never sent back.
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
  host: { '(window:pagehide)': 'onPageHide()' },
})
export class GamePage implements OnInit {
  readonly isGuest = !!inject(ActivatedRoute).snapshot.data['guest'];
  private readonly guests = inject(GuestGamesService);
  private readonly games: Pick<
    GamesService,
    'get' | 'getArticle' | 'move' | 'backtrack' | 'pause' | 'pauseOnExit'
  > = this.isGuest ? this.guests : inject(GamesService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly hostElement = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly articleView = viewChild(WikipediaArticle);
  private readonly hud = viewChild(GameHud);
  private readonly pathDialog = viewChild<ElementRef<HTMLDialogElement>>('pathDialog');
  private readonly desktopPathSummary = viewChild<ElementRef<HTMLElement>>('desktopPathSummary');
  private compactHudHeight = 0;

  // game/:id path parameter (router input binding).
  readonly id = input.required<string>();

  readonly phase = signal<Phase>('loading');
  readonly game = signal<GameDto | null>(null);
  readonly article = signal<RenderedArticle | null>(null);
  // Hard, non-recoverable error.
  readonly error = signal<string | null>(null);
  // Transient banner for a recoverable condition, cleared on the next action.
  readonly notice = signal<string | null>(null);
  // A gameplay mutation or an article fetch is in flight.
  readonly busy = signal(false);
  // Show a "retry" affordance for a failed article fetch.
  readonly wikipediaRetry = signal(false);
  readonly pathOpen = signal(false);

  // effectivePlayTimeMs confirmed by the server on the last (re)load. The
  // backend just (re)started the play interval, so this is current as of
  // baselineClientTs.
  private baselineEffectiveMs = 0;
  // Date.now() captured when baselineEffectiveMs was set (0 = not yet).
  private baselineClientTs = 0;
  // Last article whose viewport position was handled. Kept separate from
  // `article` because a transient fetch error can clear that before a retry.
  private lastDisplayedArticlePageId: number | null = null;

  private readonly tick = signal(Date.now());

  // Display-only effective time: server baseline plus wall-clock delta while
  // playing, the server's value otherwise. Never sent back. `tick` stops while
  // a move is in flight, so the clock also pauses while the server loads the
  // next article (which is not counted as play time).
  readonly displayTimeMs = computed(() => {
    const game = this.game();
    if (!game) return 0;
    if (this.phase() === 'playing' && this.baselineClientTs !== 0) {
      return this.baselineEffectiveMs + Math.max(0, this.tick() - this.baselineClientTs);
    }
    return game.effectivePlayTimeMs;
  });

  constructor() {
    interval(TIMER_TICK_MS)
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        if (this.phase() === 'playing' && !this.busy()) {
          this.tick.set(Date.now());
        }
      });
  }

  ngOnInit(): void {
    this.load();
  }

  // Called by the route's canDeactivate guard when leaving the game in-app.
  // The navigation waits for the pause, so the next page (e.g. the dashboard)
  // already reads the final time. A failed pause never blocks leaving.
  pauseBeforeLeave(): Observable<boolean> | boolean {
    if (this.phase() !== 'playing') {
      return true;
    }
    return this.games.pause(this.id()).pipe(
      map(() => true),
      catchError(() => of(true)),
    );
  }

  // Closing or reloading the tab doesn't destroy the component, so the pause
  // is sent with sendBeacon, which the browser delivers even while the page
  // is unloading. If it never arrives (crash, no connection) the backend
  // discards the open interval when the game is reopened.
  onPageHide(): void {
    if (this.phase() === 'playing') {
      this.games.pauseOnExit(this.id());
    }
  }

  onHudHeightChanged(height: number): void {
    const previousHeight = this.compactHudHeight;
    this.compactHudHeight = height;
    const host = this.hostElement.nativeElement;
    host.style.setProperty('--game-hud-height', `${height}px`);
    if (height <= previousHeight) return;

    const focused = host.ownerDocument.activeElement;
    if (
      !(focused instanceof HTMLElement) ||
      !host.querySelector('app-wikipedia-article')?.contains(focused)
    )
      return;
    const hud = host.querySelector('app-game-hud');
    if (!hud) return;
    const bar = hud.getBoundingClientRect();
    const target = focused.getBoundingClientRect();
    // Leave off-screen reading positions alone. Only compensate a growing HUD
    // for an article control that was visible below its previous obstruction.
    if (target.bottom <= bar.top + previousHeight || target.top >= window.innerHeight) return;
    const style = window.getComputedStyle(focused);
    const ring =
      (Number.parseFloat(style.outlineWidth) || 0) +
      Math.max(0, Number.parseFloat(style.outlineOffset) || 0);
    const clearance = Math.max(8, ring + 1);
    if (target.top >= bar.bottom + clearance) return;
    const scrollMargin = Number.parseFloat(style.scrollMarginTop) || 0;
    const visibleTop = Math.max(bar.bottom + clearance, scrollMargin);
    window.scrollBy({ top: target.top - visibleTop, left: 0, behavior: 'instant' });
  }

  openPath(): void {
    this.pathOpen.set(true);
    this.pathDialog()?.nativeElement.showModal();
  }

  closePath(): void {
    this.pathDialog()?.nativeElement.close();
  }

  onPathClosed(): void {
    this.pathOpen.set(false);
    if (!this.hud()?.focusPathTrigger()) {
      this.desktopPathSummary()?.nativeElement.focus({ preventScroll: true });
    }
  }

  // --- User actions -------------------------------------------------------

  onNavigate(toTitle: string): void {
    this.runMove(() => this.games.move(this.id(), toTitle));
  }

  onBacktrack(): void {
    this.runMove(() => this.games.backtrack(this.id()));
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

  // Shared flow of a navigation or backtrack: one action at a time, then apply
  // the new game state and the article the backend already prepared.
  private runMove(request: () => Observable<PreparedGameStateDto>): void {
    if (!this.game() || this.busy() || this.phase() !== 'playing') {
      return;
    }
    this.busy.set(true);
    this.notice.set(null);

    request().subscribe({
      next: (state) => {
        this.applyGame(state.game);
        if (this.phase() === 'completed') return;
        if (!state.article || state.article.pageId !== state.game.currentPageId) {
          this.load();
          return;
        }
        this.applyPreparedArticle(state.article);
        this.seedTimerBaseline(state.game);
        this.busy.set(false);
      },
      error: (err: ApiError) => this.onGameplayError(err),
    });
  }

  // --- Load / reconcile -------------------------------------------------

  // Loads the game and its already-prepared article in one response. The
  // backend starts the resumed interval only after that article is ready.
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
          // The game moved on between the two requests, reload once so game
          // and article are consistent again.
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
    if (err.code === 'GAME_NOT_FOUND') {
      this.leaveMissingGame();
      return;
    }
    this.error.set(err.message);
    this.phase.set('error');
  }

  private onArticleError(err: ApiError): void {
    this.busy.set(false);

    switch (err.code) {
      case 'GAME_NOT_FOUND':
        this.leaveMissingGame();
        return;
      case 'GUEST_GAME_CHANGED':
      case 'GAME_NOT_IN_PROGRESS':
        this.load();
        return;
      default: {
        // Transient: upstream Wikipedia (502), network, or a proxy 5xx. The
        // game state is intact, so surface a retry instead of a dead spinner.
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
      case 'GUEST_GAME_CHANGED':
      case 'GAME_NOT_IN_PROGRESS':
        // The game completed or changed elsewhere, reconcile with the server.
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
      case 'GUEST_GAME_BUSY':
        this.notice.set('Another tab is updating this game. Try again in a moment.');
        return;
      case 'GUEST_PLAY_REQUIRES_ANONYMOUS':
        void this.router.navigate(['/dashboard']);
        return;
      case 'WIKIPEDIA_UNAVAILABLE':
        this.notice.set('Wikipedia is temporarily unavailable. Please try again.');
        return;
      case 'GAME_NOT_FOUND':
        this.leaveMissingGame();
        return;
      default:
        this.error.set(err.message);
    }
  }

  // --- State synchronization helpers ---------------------------------

  private applyGame(game: GameDto): void {
    this.game.set(game);
    if (game.status === 'COMPLETED') {
      this.enterCompleted();
    }
  }

  private leaveMissingGame(): void {
    if (this.isGuest) this.guests.notice.set('Your guest game expired or is no longer available.');
    void this.router.navigate(['/']);
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
    this.notice.set(null);
  }

  // Trust boundary: contentHtml is only trusted because it comes from our
  // own backend, which already ran it through a strict server-side
  // sanitizer (tag allowlist, hrefs stripped, image URLs validated) before
  // it gets here. Angular's own sanitizer is bypassed only so it doesn't
  // strip the data-page-title attributes that drive in-app navigation.
  // Never call this with raw MediaWiki HTML or anything else that didn't
  // come through our API.
  private trustArticleHtml(contentHtml: string): SafeHtml {
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
        () => {
          this.hud()?.measureHeight();
          this.articleView()?.focusTitle();
        },
        { injector: this.injector },
      );
    }
  }
}

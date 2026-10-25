import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { GuestGamesService } from '../../core/services/guest-games.service';
import { GuestGameSummary } from '../../shared/models/game.model';
import { ApiError } from '../../shared/models/api-error.model';
import { ErrorBanner } from '../../shared/components/error-banner/error-banner';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowRight,
  lucideBookOpen,
  lucideFlag,
  lucideHistory,
  lucideMousePointerClick,
} from '@ng-icons/lucide';

@Component({
  selector: 'app-landing-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NgIcon, ErrorBanner],
  providers: [
    provideIcons({
      lucideArrowRight,
      lucideBookOpen,
      lucideFlag,
      lucideHistory,
      lucideMousePointerClick,
    }),
  ],
  templateUrl: './landing-page.html',
  styleUrl: './home.css',
})
export class LandingPage implements OnInit {
  readonly guests = inject(GuestGamesService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly current = signal<GuestGameSummary | null>(null);
  readonly confirming = signal(false);

  ngOnInit(): void {
    this.guests.summary().subscribe({
      next: (value) => {
        if (!this.busy()) this.current.set(value);
      },
      error: () => {},
    });
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      if (params.get('guest') === 'start') {
        void this.router
          .navigate([], {
            relativeTo: this.route,
            queryParams: { guest: null },
            queryParamsHandling: 'merge',
            replaceUrl: true,
          })
          .then(() => this.play());
      }
    });
  }
  async play(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    this.confirming.set(false);
    try {
      const summary = await firstValueFrom(this.guests.summary());
      this.current.set(summary);
      if (!summary.game) await this.create();
    } catch (error) {
      this.error.set((error as ApiError).message);
    } finally {
      this.busy.set(false);
    }
  }
  async replace(): Promise<void> {
    const summary = this.current();
    if (!summary?.game || summary.revision === null || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.create({ replaceGameId: summary.game.id, replaceRevision: summary.revision });
    } catch (error) {
      this.error.set((error as ApiError).message);
      this.confirming.set(false);
      try {
        this.current.set(await firstValueFrom(this.guests.summary()));
      } catch {
        /* retain last known game */
      }
    } finally {
      this.busy.set(false);
    }
  }
  private async create(replacement?: {
    replaceGameId: string;
    replaceRevision: number;
  }): Promise<void> {
    const state = await firstValueFrom(this.guests.create(replacement));
    this.confirming.set(false);
    // A failed browser navigation must still expose the newly created game.
    this.current.set({
      game: { ...state.game },
      revision: state.revision,
      expiresAt: state.expiresAt,
    });
    await this.router.navigate(['/guest/game', state.game.id]);
  }
}

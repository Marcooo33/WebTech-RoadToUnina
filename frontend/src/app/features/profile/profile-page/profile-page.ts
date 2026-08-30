import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { StatsService } from '../../../core/services/stats.service';
import { ApiError } from '../../../shared/models/api-error.model';
import { StatisticsDto } from '../../../shared/models/stats.model';
import { DurationPipe } from '../../../shared/pipes/duration.pipe';
import { ErrorBanner } from '../../../shared/components/error-banner/error-banner';
import { LoadingSpinner } from '../../../shared/components/loading-spinner/loading-spinner';

/** Authenticated profile: the current user's details plus personal statistics. */
@Component({
  selector: 'app-profile-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe, DecimalPipe, DurationPipe, ErrorBanner, LoadingSpinner],
  templateUrl: './profile-page.html',
})
export class ProfilePage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly stats = inject(StatsService);

  readonly user = this.auth.user;
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly statistics = signal<StatisticsDto | null>(null);

  ngOnInit(): void {
    this.stats.get().subscribe({
      next: (stats) => {
        this.statistics.set(stats);
        this.loading.set(false);
      },
      error: (err: ApiError) => {
        this.error.set(err.message);
        this.loading.set(false);
      },
    });
  }
}

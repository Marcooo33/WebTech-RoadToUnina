import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideHistory,
  lucideHouse,
  lucideLogIn,
  lucideLogOut,
  lucideMenu,
  lucideUserRound,
  lucideUserRoundPlus,
  lucideX,
} from '@ng-icons/lucide';
import { AuthService } from '../../../core/auth/auth.service';

/**
 * Top-level application navigation. Link set depends on authentication state
 * (`AuthService.isAuthenticated`). Collapses to a toggle menu below 720px.
 */
@Component({
  selector: 'app-nav-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, NgIcon],
  providers: [
    provideIcons({
      lucideHistory,
      lucideHouse,
      lucideLogIn,
      lucideLogOut,
      lucideMenu,
      lucideUserRound,
      lucideUserRoundPlus,
      lucideX,
    }),
  ],
  templateUrl: './nav-bar.html',
  styleUrl: './nav-bar.css',
})
export class NavBar {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly isAuthenticated = this.auth.isAuthenticated;
  readonly user = this.auth.user;
  readonly menuOpen = signal(false);

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  logout(): void {
    this.closeMenu();
    // AuthService.logout() clears local state on both success and failure.
    this.auth.logout().subscribe({
      next: () => void this.router.navigate(['/']),
      error: () => void this.router.navigate(['/']),
    });
  }
}

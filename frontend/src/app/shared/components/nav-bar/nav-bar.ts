import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideHistory,
  lucideHouse,
  lucideLogIn,
  lucideLogOut,
  lucideMenu,
  lucideRoute,
  lucideUserRound,
  lucideUserRoundPlus,
  lucideX,
} from '@ng-icons/lucide';
import { AuthService } from '../../../core/auth/auth.service';

// Top-level navigation. Link set depends on auth state, collapses to a
// toggle menu when the full link set no longer fits.
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
      lucideRoute,
      lucideUserRound,
      lucideUserRoundPlus,
      lucideX,
    }),
  ],
  templateUrl: './nav-bar.html',
  styleUrl: './nav-bar.css',
  host: { '(keydown.escape)': 'onEscape($event)' },
})
export class NavBar {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly menuToggle = viewChild<ElementRef<HTMLButtonElement>>('menuToggle');

  readonly isAuthenticated = this.auth.isAuthenticated;
  readonly user = this.auth.user;
  readonly menuOpen = signal(false);

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  onEscape(event: Event): void {
    if (!this.menuOpen()) return;
    event.preventDefault();
    this.closeMenu();
    this.menuToggle()?.nativeElement.focus();
  }

  onFocusOut(event: FocusEvent): void {
    const navigation = event.currentTarget;
    if (
      this.menuOpen() &&
      navigation instanceof Element &&
      event.relatedTarget instanceof Node &&
      !navigation.contains(event.relatedTarget)
    ) {
      this.closeMenu();
    }
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

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { Dashboard } from '../dashboard/dashboard';
import { LandingPage } from './landing-page';

@Component({
  selector: 'app-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Dashboard, LandingPage],
  templateUrl: './home.html',
})
export class Home {
  private readonly auth = inject(AuthService);
  readonly isAuthenticated = this.auth.isAuthenticated;
}

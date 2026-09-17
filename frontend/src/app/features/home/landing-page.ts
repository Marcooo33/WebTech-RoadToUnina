import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
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
  imports: [RouterLink, NgIcon],
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
export class LandingPage {}

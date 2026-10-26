import { PostAuthGuestService } from '../../../core/auth/post-auth-guest.service';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { ApiError } from '../../../shared/models/api-error.model';
import { ErrorBanner } from '../../../shared/components/error-banner/error-banner';

@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, ErrorBanner],
  templateUrl: './login.html',
  styleUrl: '../auth.css',
})
export class Login implements OnInit {
  readonly continuation = inject(PostAuthGuestService);
  readonly authenticated = signal(false);
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly authForm = viewChild<ElementRef<HTMLFormElement>>('authForm');

  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    identifier: ['', Validators.required],
    password: ['', Validators.required],
  });

  ngOnInit(): void {
    if (this.auth.isAuthenticated()) {
      void this.afterAuthentication();
    }
  }

  async afterAuthentication(force = false): Promise<void> {
    this.authenticated.set(true);
    await this.continuation.finish(force);
    this.submitting.set(false);
    if (!this.auth.isAuthenticated()) {
      this.authenticated.set(false);
      this.error.set(this.continuation.message());

      return;
    }
    if (!this.continuation.message()) await this.router.navigateByUrl('/dashboard');
  }

  submit(): void {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      if (this.form.invalid) {
        const invalid = Object.entries(this.form.controls).find(([, control]) => control.invalid);
        if (invalid) {
          this.authForm()
            ?.nativeElement.querySelector<HTMLInputElement>(`[formcontrolname="${invalid[0]}"]`)
            ?.focus();
        }
      }
      return;
    }
    this.submitting.set(true);
    this.error.set(null);

    const { identifier, password } = this.form.getRawValue();
    this.auth.login(identifier, password).subscribe({
      next: () => {
        void this.afterAuthentication();
      },
      error: (err: ApiError) => {
        this.submitting.set(false);
        this.error.set(err.message);
      },
    });
  }
}

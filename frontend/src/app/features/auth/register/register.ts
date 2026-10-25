import { PostAuthGuestService } from '../../../core/auth/post-auth-guest.service';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { ApiError } from '../../../shared/models/api-error.model';
import { ErrorBanner } from '../../../shared/components/error-banner/error-banner';

@Component({
  selector: 'app-register',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, ErrorBanner],
  templateUrl: './register.html',
})
export class Register implements OnInit {
  readonly continuation = inject(PostAuthGuestService);
  readonly authenticated = signal(false);
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);

  // Mirrors backend validation constraints; the backend still re-validates.
  readonly form = this.fb.nonNullable.group({
    username: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(30)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
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
      await this.router.navigateByUrl('/login');
      return;
    }
    if (!this.continuation.message()) await this.router.navigateByUrl('/dashboard');
  }

  submit(): void {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.error.set(null);

    const { username, email, password } = this.form.getRawValue();
    this.auth.register(username, email, password).subscribe({
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

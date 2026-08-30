import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
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
})
export class Login implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** `?redirect=` — where to go after a successful login (bound via router input binding). */
  readonly redirect = input<string>();

  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    identifier: ['', Validators.required],
    password: ['', Validators.required],
  });

  ngOnInit(): void {
    if (this.auth.isAuthenticated()) {
      void this.router.navigateByUrl(this.target());
    }
  }

  /** Only ever redirect to an in-app absolute path, never an external URL. */
  private target(): string {
    const raw = this.redirect();
    return raw && /^\/(?!\/)/.test(raw) ? raw : '/dashboard';
  }

  submit(): void {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.error.set(null);

    const { identifier, password } = this.form.getRawValue();
    this.auth.login(identifier, password).subscribe({
      next: () => {
        void this.router.navigateByUrl(this.target());
      },
      error: (err: ApiError) => {
        this.submitting.set(false);
        this.error.set(err.message);
      },
    });
  }
}

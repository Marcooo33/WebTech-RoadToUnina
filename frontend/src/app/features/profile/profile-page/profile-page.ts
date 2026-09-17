import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { ApiError } from '../../../shared/models/api-error.model';
import { ErrorBanner } from '../../../shared/components/error-banner/error-banner';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideLogOut, lucideShield, lucideTrash2, lucideUserRound } from '@ng-icons/lucide';

function passwordsMatch(control: AbstractControl): ValidationErrors | null {
  return control.get('newPassword')?.value === control.get('confirmPassword')?.value
    ? null
    : { passwordMismatch: true };
}

@Component({
  selector: 'app-profile-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, DatePipe, ErrorBanner, NgIcon],
  providers: [provideIcons({ lucideLogOut, lucideShield, lucideTrash2, lucideUserRound })],
  templateUrl: './profile-page.html',
  styleUrl: './profile-page.css',
})
export class ProfilePage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly deleteDialog = viewChild<ElementRef<HTMLDialogElement>>('deleteDialog');

  readonly user = this.auth.user;
  readonly usernameForm = this.fb.nonNullable.group({
    username: [
      this.user()?.username ?? '',
      [Validators.required, Validators.minLength(3), Validators.maxLength(30)],
    ],
  });
  readonly emailForm = this.fb.nonNullable.group({
    email: [
      this.user()?.email ?? '',
      [Validators.required, Validators.email, Validators.maxLength(255)],
    ],
  });
  readonly passwordForm = this.fb.nonNullable.group(
    {
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(128)]],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordsMatch },
  );

  readonly usernameSubmitting = signal(false);
  readonly usernameError = signal<string | null>(null);
  readonly usernameSuccess = signal<string | null>(null);
  readonly emailSubmitting = signal(false);
  readonly emailError = signal<string | null>(null);
  readonly emailSuccess = signal<string | null>(null);
  readonly passwordSubmitting = signal(false);
  readonly passwordError = signal<string | null>(null);
  readonly passwordSuccess = signal<string | null>(null);
  readonly loggingOut = signal(false);
  readonly deleting = signal(false);
  readonly deleteError = signal<string | null>(null);

  changeUsername(): void {
    if (this.usernameForm.invalid || this.usernameSubmitting()) {
      this.usernameForm.markAllAsTouched();
      return;
    }
    const username = this.usernameForm.controls.username.value.trim();
    if (username === this.user()?.username) return;

    this.usernameSubmitting.set(true);
    this.usernameError.set(null);
    this.usernameSuccess.set(null);
    this.auth.updateProfile({ username }).subscribe({
      next: (user) => {
        this.usernameForm.controls.username.setValue(user.username);
        this.usernameSubmitting.set(false);
        this.usernameSuccess.set('Username updated.');
      },
      error: (err: ApiError) => {
        this.usernameSubmitting.set(false);
        this.usernameError.set(err.message);
      },
    });
  }

  changeEmail(): void {
    if (this.emailForm.invalid || this.emailSubmitting()) {
      this.emailForm.markAllAsTouched();
      return;
    }
    const email = this.emailForm.controls.email.value.trim();
    if (email.toLowerCase() === this.user()?.email.toLowerCase()) return;

    this.emailSubmitting.set(true);
    this.emailError.set(null);
    this.emailSuccess.set(null);
    this.auth.updateProfile({ email }).subscribe({
      next: (user) => {
        this.emailForm.controls.email.setValue(user.email);
        this.emailSubmitting.set(false);
        this.emailSuccess.set('Email updated.');
      },
      error: (err: ApiError) => {
        this.emailSubmitting.set(false);
        this.emailError.set(err.message);
      },
    });
  }

  changePassword(): void {
    if (this.passwordForm.invalid || this.passwordSubmitting()) {
      this.passwordForm.markAllAsTouched();
      return;
    }
    const { currentPassword, newPassword } = this.passwordForm.getRawValue();

    this.passwordSubmitting.set(true);
    this.passwordError.set(null);
    this.passwordSuccess.set(null);
    this.auth.changePassword(currentPassword, newPassword).subscribe({
      next: () => {
        this.passwordForm.reset();
        this.passwordSubmitting.set(false);
        this.passwordSuccess.set('Password updated.');
      },
      error: (err: ApiError) => {
        this.passwordSubmitting.set(false);
        this.passwordError.set(err.message);
      },
    });
  }

  logout(): void {
    if (this.loggingOut()) return;
    this.loggingOut.set(true);
    this.auth.logout().subscribe({
      next: () => void this.router.navigate(['/']),
      error: () => void this.router.navigate(['/']),
    });
  }

  openDeleteDialog(): void {
    this.deleteError.set(null);
    this.deleteDialog()?.nativeElement.showModal();
  }

  cancelDelete(): void {
    if (!this.deleting()) this.deleteDialog()?.nativeElement.close();
  }

  onDialogCancel(event: Event): void {
    if (this.deleting()) event.preventDefault();
  }

  confirmDelete(): void {
    if (this.deleting()) return;
    this.deleting.set(true);
    this.deleteError.set(null);
    this.auth.deleteAccount().subscribe({
      next: () => {
        this.deleting.set(false);
        this.deleteDialog()?.nativeElement.close();
        void this.router.navigate(['/']);
      },
      error: (err: ApiError) => {
        this.deleting.set(false);
        this.deleteError.set(err.message);
      },
    });
  }
}

import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { ProfilePage } from './profile-page';
import { AuthService } from '../../../core/auth/auth.service';
import { ApiError } from '../../../shared/models/api-error.model';

const user = {
  id: 'player',
  username: 'Navigator',
  email: 'navigator@example.test',
  createdAt: '2026-10-26T00:00:00Z',
};

describe('ProfilePage presentation', () => {
  let fixture: ComponentFixture<ProfilePage>;
  let component: ProfilePage;
  let request: Subject<void>;
  let changePassword = vi.fn();
  let updateProfile = vi.fn();
  let deleteAccount = vi.fn();
  beforeEach(async () => {
    request = new Subject();
    changePassword = vi.fn(() => request);
    updateProfile = vi.fn(() => of(user));
    deleteAccount = vi.fn(() => of(void 0));
    await TestBed.configureTestingModule({
      imports: [ProfilePage],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            user: signal(user),
            changePassword,
            updateProfile,
            deleteAccount,
            logout: () => of(void 0),
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ProfilePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('explains password requirements before submission and associates every required error', () => {
    expect(
      fixture.nativeElement.querySelector('#new-password').getAttribute('aria-describedby'),
    ).toBe('new-password-hint');
    fixture.nativeElement.querySelector('.password-form button[type="submit"]').click();
    fixture.detectChanges();
    for (const [field, error] of [
      ['current-password', 'current-password-error'],
      ['new-password', 'new-password-error'],
      ['confirm-password', 'confirm-password-error'],
    ]) {
      const input = fixture.nativeElement.querySelector(`#${field}`);
      expect(input.getAttribute('aria-invalid')).toBe('true');
      expect(input.getAttribute('aria-describedby')).toContain(error);
      expect(fixture.nativeElement.querySelector(`#${error}`).textContent.trim()).not.toBe('');
    }
    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('#current-password'));
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('focuses the first invalid control, including a group-level password mismatch', () => {
    component.passwordForm.controls.currentPassword.setValue('old-password');
    component.changePassword();
    fixture.detectChanges();
    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('#new-password'));
    component.passwordForm.controls.newPassword.setValue('new-password');
    component.changePassword();
    fixture.detectChanges();
    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('#confirm-password'));
    component.passwordForm.controls.confirmPassword.setValue('different-password');
    component.changePassword();
    fixture.detectChanges();
    const confirm = fixture.nativeElement.querySelector('#confirm-password');
    expect(confirm.getAttribute('aria-describedby')).toBe('password-mismatch-error');
    expect(document.activeElement).toBe(confirm);
    expect(fixture.nativeElement.querySelector('#password-mismatch-error').textContent).toContain(
      'Passwords do not match.',
    );
    expect(changePassword).not.toHaveBeenCalled();
  });

  it.each(['short', 'x'.repeat(129)])(
    'keeps the original length validation with associated feedback',
    (password) => {
      component.passwordForm.setValue({
        currentPassword: 'old-password',
        newPassword: password,
        confirmPassword: password,
      });
      component.changePassword();
      fixture.detectChanges();
      expect(component.passwordForm.controls.newPassword.invalid).toBe(true);
      expect(fixture.nativeElement.querySelector('#new-password-error').textContent).toContain(
        '8 and 128',
      );
      expect(document.activeElement).toBe(fixture.nativeElement.querySelector('#new-password'));
      expect(changePassword).not.toHaveBeenCalled();
    },
  );

  it('associates server password errors with the busy form and keeps credentials unchanged', () => {
    component.passwordForm.setValue({
      currentPassword: 'old-password',
      newPassword: 'new-password',
      confirmPassword: 'new-password',
    });
    component.changePassword();
    fixture.detectChanges();
    expect(changePassword).toHaveBeenCalledExactlyOnceWith('old-password', 'new-password');
    expect(fixture.nativeElement.querySelector('.password-form').getAttribute('aria-busy')).toBe(
      'true',
    );
    request.error(new ApiError(400, 'INVALID_PASSWORD', 'Current password is incorrect.'));
    fixture.detectChanges();
    const form = fixture.nativeElement.querySelector('.password-form');
    expect(form.getAttribute('aria-describedby')).toBe('password-request-error');
    expect(form.querySelector('#password-request-error [role="alert"]').textContent).toContain(
      'Current password is incorrect.',
    );
    expect(form.getAttribute('aria-busy')).toBe('false');
  });

  it('keeps the existing success confirmation and reset without showing fresh required errors', () => {
    component.passwordForm.setValue({
      currentPassword: 'old-password',
      newPassword: 'new-password',
      confirmPassword: 'new-password',
    });
    component.changePassword();
    request.next();
    request.complete();
    fixture.detectChanges();
    expect(component.passwordForm.getRawValue()).toEqual({
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
    expect(
      fixture.nativeElement.querySelector('.password-form [role="status"]').textContent,
    ).toContain('Password updated.');
    expect(fixture.nativeElement.querySelector('.password-form .field__error')).toBeNull();
  });

  it('focuses invalid account fields without changing update requests', () => {
    component.usernameForm.controls.username.setValue('x');
    component.changeUsername();
    fixture.detectChanges();
    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('#profile-username'));
    expect(
      fixture.nativeElement.querySelector('#profile-username').getAttribute('aria-describedby'),
    ).toBe('profile-username-hint profile-username-error');
    component.emailForm.controls.email.setValue('invalid');
    component.changeEmail();
    fixture.detectChanges();
    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('#profile-email'));
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it('preserves Cancel initial focus, explicit deletion and the busy Escape guard', () => {
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    dialog.showModal = vi.fn();
    dialog.close = vi.fn();
    component.openDeleteDialog();
    expect(dialog.showModal).toHaveBeenCalledOnce();
    expect(dialog.querySelector('button[autofocus]')?.textContent).toContain('Cancel');
    expect(deleteAccount).not.toHaveBeenCalled();
    component.cancelDelete();
    expect(dialog.close).toHaveBeenCalledOnce();
    component.deleting.set(true);
    const cancel = new Event('cancel', { cancelable: true });
    component.onDialogCancel(cancel);
    expect(cancel.defaultPrevented).toBe(true);
    component.cancelDelete();
    expect(dialog.close).toHaveBeenCalledOnce();
  });
});

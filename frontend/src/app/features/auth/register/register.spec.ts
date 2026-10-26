import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { PostAuthGuestService } from '../../../core/auth/post-auth-guest.service';
import { Register } from './register';

describe('Register presentation', () => {
  let fixture: ComponentFixture<Register>;
  let request: Subject<never>;
  let register: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    request = new Subject();
    register = vi.fn(() => request);
    await TestBed.configureTestingModule({
      imports: [Register],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { isAuthenticated: () => false, register } },
        {
          provide: PostAuthGuestService,
          useValue: { busy: signal(false), message: signal(null), retryable: signal(false) },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(Register);
    fixture.detectChanges();
  });

  it('explains username and password requirements before any invalid submission', () => {
    for (const [id, hint] of [
      ['username', 'username-hint'],
      ['password', 'password-hint'],
    ]) {
      const input = fixture.nativeElement.querySelector(`#${id}`);
      expect(input.getAttribute('aria-describedby')).toBe(hint);
      expect(fixture.nativeElement.querySelector(`#${hint}`).textContent.trim()).not.toBe('');
    }
    expect(fixture.nativeElement.querySelector('.field__error')).toBeNull();
  });

  it('focuses invalid fields in order and keeps both hints and errors associated', () => {
    fixture.nativeElement.querySelector('button[type="submit"]').click();
    fixture.detectChanges();
    const username = fixture.nativeElement.querySelector('#username');
    expect(document.activeElement).toBe(username);
    expect(username.getAttribute('aria-describedby')).toBe('username-hint username-error');
    expect(register).not.toHaveBeenCalled();

    fixture.componentInstance.form.controls.username.setValue('Navigator');
    fixture.componentInstance.submit();
    fixture.detectChanges();
    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('#email'));
    fixture.componentInstance.form.controls.email.setValue('navigator@example.test');
    fixture.componentInstance.submit();
    fixture.detectChanges();
    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('#password'));
  });

  it('submits unchanged credentials and exposes pending and server error states', () => {
    fixture.componentInstance.form.setValue({
      username: 'Navigator',
      email: 'navigator@example.test',
      password: 'password123',
    });
    fixture.componentInstance.submit();
    fixture.detectChanges();
    expect(register).toHaveBeenCalledWith('Navigator', 'navigator@example.test', 'password123');
    expect(fixture.nativeElement.querySelector('form').getAttribute('aria-busy')).toBe('true');
    request.error({ message: 'This username is already in use.' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(
      'This username is already in use.',
    );
    expect(fixture.nativeElement.querySelector('button[type="submit"]').disabled).toBe(false);
  });
});

import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { PostAuthGuestService } from '../../../core/auth/post-auth-guest.service';
import { Login } from './login';

describe('Login presentation', () => {
  let fixture: ComponentFixture<Login>;
  let request: Subject<never>;
  let login: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    request = new Subject();
    login = vi.fn(() => request);
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { isAuthenticated: () => false, login } },
        {
          provide: PostAuthGuestService,
          useValue: { busy: signal(false), message: signal(null), retryable: signal(false) },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(Login);
    fixture.detectChanges();
  });

  it('focuses the first invalid field and associates its error without requesting login', () => {
    fixture.nativeElement.querySelector('button[type="submit"]').click();
    fixture.detectChanges();
    const identifier = fixture.nativeElement.querySelector('#identifier');
    expect(document.activeElement).toBe(identifier);
    expect(identifier.getAttribute('aria-describedby')).toBe('identifier-error');
    expect(login).not.toHaveBeenCalled();

    fixture.componentInstance.form.controls.identifier.setValue('Navigator');
    fixture.componentInstance.submit();
    fixture.detectChanges();
    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('#password'));
  });

  it('exposes pending and error states while submitting the original credentials', () => {
    fixture.componentInstance.form.setValue({ identifier: 'Navigator', password: 'secret' });
    fixture.componentInstance.submit();
    fixture.detectChanges();
    expect(login).toHaveBeenCalledWith('Navigator', 'secret');
    expect(fixture.nativeElement.querySelector('form').getAttribute('aria-busy')).toBe('true');
    expect(fixture.nativeElement.querySelector('button[type="submit"]').disabled).toBe(true);
    request.error({ message: 'Credentials could not be verified.' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(
      'Credentials could not be verified.',
    );
    expect(fixture.nativeElement.querySelector('form').getAttribute('aria-busy')).toBe('false');
  });
});

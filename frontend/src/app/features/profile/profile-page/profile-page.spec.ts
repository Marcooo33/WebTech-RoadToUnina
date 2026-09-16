import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { errorInterceptor } from '../../../core/interceptors/error.interceptor';
import { UserProfileDto } from '../../../shared/models/user.model';
import { ProfilePage } from './profile-page';

const USER: UserProfileDto = {
  id: 'u1',
  username: 'marco',
  email: 'marco@example.com',
  avatarUrl: null,
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('ProfilePage', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<ProfilePage>;
  let component: ProfilePage;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProfilePage],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthService).login('marco', 'password123').subscribe();
    http.expectOne('/api/auth/login').flush(USER);

    fixture = TestBed.createComponent(ProfilePage);
    component = fixture.componentInstance;
    fixture.detectChanges();

    const dialog = (fixture.nativeElement as HTMLElement).querySelector('dialog')!;
    Object.defineProperty(dialog, 'showModal', {
      value: vi.fn(() => dialog.setAttribute('open', '')),
      configurable: true,
    });
    Object.defineProperty(dialog, 'close', {
      value: vi.fn(() => dialog.removeAttribute('open')),
      configurable: true,
    });
  });

  afterEach(() => http.verify());

  it('renders account management without loading duplicate statistics', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Account information');
    expect(el.textContent).toContain('Security');
    expect(el.textContent).toContain('Delete account');
    expect(el.textContent).not.toContain('Statistics');
    http.expectNone('/api/me/stats');
  });

  it('updates the username and authenticated user state', () => {
    component.usernameForm.controls.username.setValue('new-marco');
    component.changeUsername();

    const req = http.expectOne('/api/auth/me');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ username: 'new-marco' });
    req.flush({ ...USER, username: 'new-marco' });
    fixture.detectChanges();

    expect(TestBed.inject(AuthService).user()?.username).toBe('new-marco');
    expect(component.usernameSuccess()).toBe('Username updated.');
  });

  it('blocks a password change when confirmation does not match', () => {
    component.passwordForm.setValue({
      currentPassword: 'password123',
      newPassword: 'new-password-123',
      confirmPassword: 'different-password',
    });
    component.changePassword();

    http.expectNone('/api/auth/me/password');
    expect(component.passwordForm.hasError('passwordMismatch')).toBe(true);
  });

  it('cancels account deletion without sending a request', () => {
    component.openDeleteDialog();
    component.cancelDelete();

    http.expectNone('/api/auth/me');
    const dialog = (fixture.nativeElement as HTMLElement).querySelector('dialog')!;
    expect(dialog.hasAttribute('open')).toBe(false);
  });

  it('deletes the account, clears auth state, and navigates home', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    component.openDeleteDialog();
    component.confirmDelete();

    const req = http.expectOne('/api/auth/me');
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });

    expect(TestBed.inject(AuthService).isAuthenticated()).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/']);
  });
});

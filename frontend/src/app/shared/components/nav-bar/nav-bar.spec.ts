import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { NavBar } from './nav-bar';

@Component({ template: '' })
class TestPage {}

describe('NavBar', () => {
  let fixture: ComponentFixture<NavBar>;
  let authenticated: ReturnType<typeof signal<boolean>>;
  let logout: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    authenticated = signal(false);
    logout = vi.fn(() => of(void 0));
    await TestBed.configureTestingModule({
      imports: [NavBar],
      providers: [
        provideRouter([
          { path: '', component: TestPage },
          { path: 'history', component: TestPage },
          { path: 'profile', component: TestPage },
          { path: 'login', component: TestPage },
          { path: 'register', component: TestPage },
        ]),
        {
          provide: AuthService,
          useValue: {
            isAuthenticated: authenticated,
            user: signal({ username: 'Navigator' }),
            logout,
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(NavBar);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('keeps the anonymous navigation destinations and guest entry', () => {
    const links = Array.from(fixture.nativeElement.querySelectorAll('a')) as HTMLAnchorElement[];
    expect(links.some((link) => link.getAttribute('href') === '/history')).toBe(true);
    expect(links.some((link) => link.getAttribute('href') === '/login')).toBe(true);
    expect(links.some((link) => link.getAttribute('href') === '/register')).toBe(true);
    expect(links.some((link) => link.getAttribute('href') === '/?guest=start')).toBe(true);
  });

  it('closes the expanded menu with Escape and restores focus to the toggle', () => {
    const toggle = fixture.nativeElement.querySelector('.nav__toggle') as HTMLButtonElement;
    toggle.click();
    fixture.detectChanges();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    const link = fixture.nativeElement.querySelector('a[href="/history"]') as HTMLAnchorElement;
    link.focus();
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    link.dispatchEvent(escape);
    fixture.detectChanges();

    expect(escape.defaultPrevented).toBe(true);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(toggle);
  });

  it('allows focus to leave the navigation and closes its expanded panel', () => {
    const toggle = fixture.nativeElement.querySelector('.nav__toggle') as HTMLButtonElement;
    toggle.click();
    fixture.detectChanges();
    const link = fixture.nativeElement.querySelector('a[href="/history"]') as HTMLAnchorElement;
    toggle.focus();
    link.focus();
    expect(fixture.componentInstance.menuOpen()).toBe(true);

    const outside = document.createElement('button');
    document.body.append(outside);
    try {
      outside.focus();
      fixture.detectChanges();
      expect(document.activeElement).toBe(outside);
      expect(toggle.getAttribute('aria-expanded')).toBe('false');
    } finally {
      outside.remove();
    }
  });

  it('marks the current destination programmatically', async () => {
    await TestBed.inject(Router).navigateByUrl('/history');
    fixture.detectChanges();
    await fixture.whenStable();
    const current = fixture.nativeElement.querySelectorAll('a[aria-current="page"]');
    expect(current.length).toBe(1);
    expect(current[0].getAttribute('href')).toBe('/history');
  });

  it('preserves authenticated destinations and logout', async () => {
    authenticated.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('a[href="/profile"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('a[href="/login"]')).toBeNull();
    const dashboard = fixture.nativeElement.querySelector('.nav__primary a[href="/"]');
    expect(dashboard.textContent).toContain('Dashboard');
    fixture.componentInstance.toggleMenu();
    fixture.nativeElement.querySelector('.nav__logout').click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(logout).toHaveBeenCalledOnce();
    expect(fixture.componentInstance.menuOpen()).toBe(false);
    expect(TestBed.inject(Router).url).toBe('/');
  });
});

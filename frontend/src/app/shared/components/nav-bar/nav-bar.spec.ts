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

  afterEach(() => vi.restoreAllMocks());

  it('keeps the anonymous navigation destinations and guest entry', () => {
    const links = Array.from(fixture.nativeElement.querySelectorAll('a')) as HTMLAnchorElement[];
    expect(links.some((link) => link.getAttribute('href') === '/history')).toBe(true);
    expect(links.some((link) => link.getAttribute('href') === '/login')).toBe(true);
    expect(links.some((link) => link.getAttribute('href') === '/register')).toBe(true);
    expect(links.some((link) => link.getAttribute('href') === '/?guest=start')).toBe(true);
  });

  it('closes the expanded menu with Escape and restores focus to the toggle', () => {
    const toggle = fixture.nativeElement.querySelector('.nav__toggle') as HTMLButtonElement;
    vi.spyOn(toggle, 'getClientRects').mockReturnValue({ length: 1 } as DOMRectList);
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

  it('closes a menu after its trigger becomes hidden on desktop and restores visible brand focus', () => {
    const toggle = fixture.nativeElement.querySelector('.nav__toggle') as HTMLButtonElement;
    toggle.click();
    toggle.focus();
    toggle.blur();
    vi.spyOn(toggle, 'getClientRects').mockReturnValue({ length: 0 } as DOMRectList);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
    fixture.detectChanges();
    expect(fixture.componentInstance.menuOpen()).toBe(false);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('.nav__brand'));
  });

  it('keeps an already visible navigation link focused when Escape closes the desktop menu state', () => {
    fixture.componentInstance.toggleMenu();
    const toggle = fixture.nativeElement.querySelector('.nav__toggle') as HTMLButtonElement;
    vi.spyOn(toggle, 'getClientRects').mockReturnValue({ length: 0 } as DOMRectList);
    const link = fixture.nativeElement.querySelector('a[href="/history"]') as HTMLAnchorElement;
    vi.spyOn(link, 'getClientRects').mockReturnValue({ length: 1 } as DOMRectList);
    link.focus();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
    expect(fixture.componentInstance.menuOpen()).toBe(false);
    expect(document.activeElement).toBe(link);
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

  it('lets a native modal own Escape when a resized navigation menu still has open state', () => {
    fixture.componentInstance.menuOpen.set(true);
    const dialog = document.createElement('dialog');
    dialog.open = true;
    const cancel = document.createElement('button');
    cancel.textContent = 'Annulla';
    dialog.append(cancel);
    document.body.append(dialog);
    try {
      cancel.focus();
      const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      });
      cancel.dispatchEvent(event);
      expect(fixture.componentInstance.menuOpen()).toBe(false);
      expect(event.defaultPrevented).toBe(false);
      expect(document.activeElement).toBe(cancel);
    } finally {
      dialog.remove();
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
    expect(dashboard.textContent).toContain('Riepilogo');
    fixture.componentInstance.toggleMenu();
    fixture.nativeElement.querySelector('.nav__logout').click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(logout).toHaveBeenCalledOnce();
    expect(fixture.componentInstance.menuOpen()).toBe(false);
    expect(TestBed.inject(Router).url).toBe('/');
  });
});

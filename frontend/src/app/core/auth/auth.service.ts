import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, map, of, tap } from 'rxjs';
import { API_BASE } from '../api/api.config';
import { UserProfileDto } from '../../shared/models/user.model';

type AuthStatus = 'unknown' | 'authenticated' | 'anonymous';

/**
 * Owns client-side authentication state. The backend is authoritative: this
 * service only reflects the `access_token` cookie by calling the API and caches
 * the resulting profile in signals for guards and the nav bar.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly _user = signal<UserProfileDto | null>(null);
  private readonly _status = signal<AuthStatus>('unknown');

  readonly user = this._user.asReadonly();
  readonly status = this._status.asReadonly();
  readonly isAuthenticated = computed(() => this._status() === 'authenticated');

  /**
   * Resolves the current session once at startup (via `provideAppInitializer`)
   * and lazily from the guard. Always completes, never rejects, so navigation is
   * not blocked by a transient error.
   */
  bootstrap(): Observable<AuthStatus> {
    if (this._status() !== 'unknown') {
      return of(this._status());
    }

    return this.http.get<UserProfileDto>(`${API_BASE}/auth/me`).pipe(
      tap((user) => this.setUser(user)),
      map((): AuthStatus => 'authenticated'),
      catchError(() => {
        this.clearUser();
        return of<AuthStatus>('anonymous');
      }),
    );
  }

  login(identifier: string, password: string): Observable<UserProfileDto> {
    return this.http
      .post<UserProfileDto>(`${API_BASE}/auth/login`, { identifier, password })
      .pipe(tap((user) => this.setUser(user)));
  }

  register(username: string, email: string, password: string): Observable<UserProfileDto> {
    return this.http
      .post<UserProfileDto>(`${API_BASE}/auth/register`, { username, email, password })
      .pipe(tap((user) => this.setUser(user)));
  }

  updateProfile(input: { username?: string; email?: string }): Observable<UserProfileDto> {
    return this.http
      .patch<UserProfileDto>(`${API_BASE}/auth/me`, input)
      .pipe(tap((user) => this.setUser(user)));
  }

  changePassword(currentPassword: string, newPassword: string): Observable<void> {
    return this.http.patch<void>(`${API_BASE}/auth/me/password`, {
      currentPassword,
      newPassword,
    });
  }

  deleteAccount(): Observable<void> {
    return this.http.delete<void>(`${API_BASE}/auth/me`).pipe(tap(() => this.clearUser()));
  }

  /**
   * Calls the logout endpoint and always drops local auth state afterwards, even
   * if the request fails. Navigation after logout is the caller's responsibility
   * (keeps this service free of a Router dependency during app initialization).
   */
  logout(): Observable<void> {
    return this.http
      .post<void>(`${API_BASE}/auth/logout`, {})
      .pipe(finalize(() => this.clearUser()));
  }

  /** Marks state anonymous. Called on logout and by the error interceptor on 401. */
  clearUser(): void {
    this._user.set(null);
    this._status.set('anonymous');
  }

  private setUser(user: UserProfileDto): void {
    this._user.set(user);
    this._status.set('authenticated');
  }
}

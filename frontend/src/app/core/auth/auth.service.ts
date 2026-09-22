import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, map, of, tap } from 'rxjs';
import { API_BASE } from '../api/api.config';
import { UserProfileDto } from '../../shared/models/user.model';

type AuthStatus = 'unknown' | 'authenticated' | 'anonymous';

// Holds client-side auth state. The backend is authoritative for the actual
// session (access_token cookie); this just mirrors it by calling the API and
// caching the profile in signals for guards and the nav bar.
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly _user = signal<UserProfileDto | null>(null);
  private readonly _status = signal<AuthStatus>('unknown');

  readonly user = this._user.asReadonly();
  readonly status = this._status.asReadonly();
  readonly isAuthenticated = computed(() => this._status() === 'authenticated');

  // Resolves the session once at startup and lazily from the guard. Always
  // completes, never rejects, so a transient error doesn't block navigation.
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

  // Always drops local auth state, even if the request fails. Navigation
  // after logout is left to the caller, so this service has no Router
  // dependency during app initialization.
  logout(): Observable<void> {
    return this.http
      .post<void>(`${API_BASE}/auth/logout`, {})
      .pipe(finalize(() => this.clearUser()));
  }

  // Also called by the error interceptor on a 401.
  clearUser(): void {
    this._user.set(null);
    this._status.set('anonymous');
  }

  private setUser(user: UserProfileDto): void {
    this._user.set(user);
    this._status.set('authenticated');
  }
}

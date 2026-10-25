import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, finalize, shareReplay, tap } from 'rxjs';
import { API_BASE } from '../api/api.config';
import { ArticleDto } from '../../shared/models/article.model';
import { GuestGameState, GuestGameSummary } from '../../shared/models/game.model';

export interface PendingGuestAction {
  gameId: string;
  action: 'claim' | 'discard';
}
const PENDING_KEY = 'roadtounina.pendingGuestAction';

@Injectable({ providedIn: 'root' })
export class GuestGamesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE}/guest-games`;
  private memoryPending: PendingGuestAction | null = null;
  private summaryRequest: Observable<GuestGameSummary> | null = null;
  private revisions = new Map<string, number>();
  readonly notice = signal<string | null>(null);

  pending(): PendingGuestAction | null {
    try {
      const stored = localStorage.getItem(PENDING_KEY);
      const value = stored ? JSON.parse(stored) : this.memoryPending;
      return value &&
        typeof value.gameId === 'string' &&
        /^[a-f0-9-]{36}$/i.test(value.gameId) &&
        ['claim', 'discard'].includes(value.action)
        ? value
        : null;
    } catch {
      return this.memoryPending;
    }
  }
  remember(gameId: string, action: 'claim' | 'discard'): void {
    this.memoryPending = { gameId, action };
    try {
      localStorage.setItem(PENDING_KEY, JSON.stringify({ gameId, action }));
    } catch {
      /* Storage may be disabled; cookie restoration still works. */
    }
  }
  clearPending(): void {
    this.memoryPending = null;
    try {
      localStorage.removeItem(PENDING_KEY);
    } catch {
      /* optional recovery hint */
    }
  }
  summary(): Observable<GuestGameSummary> {
    // Share concurrent startup reads so their initial identity cookies cannot race.
    if (this.summaryRequest) return this.summaryRequest;
    this.summaryRequest = this.http.get<GuestGameSummary>(this.base).pipe(
      tap((value) => {
        if (value.game && value.revision !== null)
          this.revisions.set(value.game.id, value.revision);
      }),
      finalize(() => {
        this.summaryRequest = null;
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
    return this.summaryRequest;
  }
  private apply = (state: GuestGameState) => {
    this.revisions.set(state.game.id, state.revision);
    if (state.game.status === 'COMPLETED') this.remember(state.game.id, 'claim');
  };
  create(replacement?: { replaceGameId: string; replaceRevision: number }) {
    return this.http.post<GuestGameState>(this.base, replacement ?? {}).pipe(
      tap((state) => {
        this.clearPending();
        this.apply(state);
      }),
    );
  }
  get(id: string) {
    return this.http.get<GuestGameState>(`${this.base}/${id}`).pipe(tap(this.apply));
  }
  getArticle(id: string) {
    return this.http.get<ArticleDto>(`${this.base}/${id}/article`);
  }
  move(id: string, toTitle: string) {
    return this.http
      .post<GuestGameState>(`${this.base}/${id}/moves`, {
        toTitle,
        revision: this.revisions.get(id),
      })
      .pipe(tap(this.apply));
  }
  backtrack(id: string) {
    return this.http
      .post<GuestGameState>(`${this.base}/${id}/backtrack`, { revision: this.revisions.get(id) })
      .pipe(tap(this.apply));
  }
  pause(id: string) {
    return this.http.post<void>(`${this.base}/${id}/pause`, { revision: this.revisions.get(id) });
  }
  pauseOnExit(id: string): void {
    void fetch(`${this.base}/${id}/pause`, {
      method: 'POST',
      credentials: 'same-origin',
      keepalive: true,
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'ROADTOUNINA' },
      body: JSON.stringify({ revision: this.revisions.get(id) }),
    }).catch(() => {});
  }
  discard(id: string, revision: number) {
    return this.http.delete<void>(`${this.base}/${id}`, { body: { revision } });
  }
  claim(id: string) {
    return this.http.post<{ gameId: string; status: 'COMPLETED' }>(`${this.base}/${id}/claim`, {});
  }
}

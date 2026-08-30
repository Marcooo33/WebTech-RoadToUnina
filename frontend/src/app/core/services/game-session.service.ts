import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE } from '../api/api.config';
import { SessionResponseDto } from '../../shared/models/article.model';

/**
 * Thin typed wrapper over the nested `/api/games/:id/session*` endpoints
 * (docs/api.md §6). The session is scoped to the game: the backend always
 * operates on the game's single `ACTIVE` session, never a client-supplied id.
 */
@Injectable({ providedIn: 'root' })
export class GameSessionService {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE}/games`;

  /** Start or resume the game's active session (idempotent, docs/api.md §6.1). */
  start(gameId: string): Observable<SessionResponseDto> {
    return this.http.post<SessionResponseDto>(`${this.base}/${gameId}/session`, {});
  }

  /** Refresh `lastHeartbeatAt`; `409 NO_ACTIVE_SESSION` if it already expired (§6.2). */
  heartbeat(gameId: string): Observable<SessionResponseDto> {
    return this.http.post<SessionResponseDto>(`${this.base}/${gameId}/session/heartbeat`, {});
  }

  /**
   * Best-effort session end during page teardown (navigation away, tab close).
   *
   * This is the teardown form of `POST /session/end` (docs/api.md §6.3): it uses
   * the same authenticated POST semantics (cookie credentials, same API base) as
   * every other call, with `keepalive` so the request can outlive the document.
   * Delivery is not guaranteed and is never relied upon for correctness — if it
   * is lost, the backend's heartbeat-timeout expiry finalizes the session using
   * the last confirmed heartbeat (docs/architecture.md §13, docs/api.md §9.3).
   */
  endOnTeardown(gameId: string): void {
    const url = `${this.base}/${encodeURIComponent(gameId)}/session/end`;
    try {
      void fetch(url, { method: 'POST', credentials: 'include', keepalive: true }).catch(() => {
        // Swallowed on purpose: teardown delivery is best-effort (see above).
      });
    } catch {
      // `fetch` may be unavailable or throw synchronously in some environments.
    }
  }
}

import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_BASE } from '../api/api.config';
import { ArticleDto } from '../../shared/models/article.model';
import {
  GameDifficulty,
  GameDto,
  GameListItemDto,
  GameMode,
  PreparedGameStateDto,
  GameStatus,
} from '../../shared/models/game.model';

interface GameListResponse {
  items: GameListItemDto[];
}

// Thin typed wrapper over the authenticated /api/games endpoints.
@Injectable({ providedIn: 'root' })
export class GamesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE}/games`;

  list(status?: GameStatus): Observable<GameListItemDto[]> {
    let params = new HttpParams();
    if (status) {
      params = params.set('status', status);
    }
    return this.http.get<GameListResponse>(this.base, { params }).pipe(map((res) => res.items));
  }

  // Loads an owned game plus its article. For an in-progress game the backend
  // starts the play timer once that article is ready.
  get(gameId: string): Observable<PreparedGameStateDto> {
    return this.http.get<PreparedGameStateDto>(`${this.base}/${gameId}`);
  }

  create(mode: GameMode, difficulty: GameDifficulty): Observable<GameDto> {
    return this.http.post<GameDto>(this.base, { mode, difficulty });
  }

  remove(gameId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${gameId}`);
  }

  getArticle(gameId: string): Observable<ArticleDto> {
    return this.http.get<ArticleDto>(`${this.base}/${gameId}/article`);
  }

  // Requests a NAVIGATION move. The backend validates ownership, that the
  // game is still in progress, and that toTitle is actually a link on the
  // current page.
  move(gameId: string, toTitle: string): Observable<PreparedGameStateDto> {
    return this.http.post<PreparedGameStateDto>(`${this.base}/${gameId}/moves`, { toTitle });
  }

  backtrack(gameId: string): Observable<PreparedGameStateDto> {
    return this.http.post<PreparedGameStateDto>(`${this.base}/${gameId}/backtrack`, {});
  }

  // Stops the play timer when the player leaves the game page; returns 204.
  pause(gameId: string): Observable<void> {
    return this.http.post<void>(`${this.base}/${gameId}/pause`, {});
  }

  // Same as pause(), for when the tab is being closed: HttpClient requests
  // are cancelled on unload, a beacon is not. The auth cookie is sent because
  // the API is on the same origin.
  pauseOnExit(gameId: string): void {
    navigator.sendBeacon(`${this.base}/${gameId}/pause`);
  }
}

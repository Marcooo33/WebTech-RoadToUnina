import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_BASE } from '../api/api.config';
import {
  GameDifficulty,
  GameDto,
  GameListItemDto,
  GameMode,
  GameStatus,
} from '../../shared/models/game.model';

interface GameListResponse {
  items: GameListItemDto[];
}

/** Thin typed wrapper over the authenticated `/api/games` endpoints (docs/api.md §5). */
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

  get(gameId: string): Observable<GameDto> {
    return this.http.get<GameDto>(`${this.base}/${gameId}`);
  }

  create(mode: GameMode, difficulty: GameDifficulty): Observable<GameDto> {
    return this.http.post<GameDto>(this.base, { mode, difficulty });
  }

  remove(gameId: string, version: number): Observable<void> {
    const params = new HttpParams().set('version', version);
    return this.http.delete<void>(`${this.base}/${gameId}`, { params });
  }
}

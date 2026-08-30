import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE } from '../api/api.config';
import { GameDifficulty, GameMode } from '../../shared/models/game.model';
import { LeaderboardDto } from '../../shared/models/leaderboard.model';

/** Thin typed wrapper over the public `/api/leaderboards` endpoints (docs/api.md §7.2). */
@Injectable({ providedIn: 'root' })
export class LeaderboardService {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE}/leaderboards`;

  get(mode: GameMode, difficulty: GameDifficulty, limit?: number): Observable<LeaderboardDto> {
    let params = new HttpParams().set('difficulty', difficulty);
    if (limit != null) {
      params = params.set('limit', limit);
    }
    const path = mode === 'CLICK' ? 'click' : 'time';
    return this.http.get<LeaderboardDto>(`${this.base}/${path}`, { params });
  }
}

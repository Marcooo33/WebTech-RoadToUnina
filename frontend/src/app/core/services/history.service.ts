import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE } from '../api/api.config';
import {
  CompletedGameDetailDto,
  HistoryListDto,
  HistoryListQuery,
} from '../../shared/models/history.model';
import { GameMode } from '../../shared/models/game.model';

// Thin typed wrapper over the public /api/history endpoints.
@Injectable({ providedIn: 'root' })
export class HistoryService {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE}/history`;

  list(mode: GameMode, query: HistoryListQuery): Observable<HistoryListDto> {
    let params = new HttpParams().set('difficulty', query.difficulty);
    if (query.page != null) params = params.set('page', query.page);
    if (query.limit != null) params = params.set('limit', query.limit);
    const view = mode === 'CLICK' ? 'click' : 'time';
    return this.http.get<HistoryListDto>(`${this.base}/${view}`, { params });
  }

  get(gameId: string): Observable<CompletedGameDetailDto> {
    return this.http.get<CompletedGameDetailDto>(`${this.base}/${gameId}`);
  }
}

import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE } from '../api/api.config';
import {
  CompletedGameDetailDto,
  HistoryListDto,
  HistoryListQuery,
} from '../../shared/models/history.model';

/** Thin typed wrapper over the public `/api/history` endpoints (docs/api.md §7.1). */
@Injectable({ providedIn: 'root' })
export class HistoryService {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE}/history`;

  list(query: HistoryListQuery = {}): Observable<HistoryListDto> {
    let params = new HttpParams();
    if (query.mode) params = params.set('mode', query.mode);
    if (query.difficulty) params = params.set('difficulty', query.difficulty);
    if (query.page != null) params = params.set('page', query.page);
    if (query.limit != null) params = params.set('limit', query.limit);
    return this.http.get<HistoryListDto>(this.base, { params });
  }

  get(gameId: string): Observable<CompletedGameDetailDto> {
    return this.http.get<CompletedGameDetailDto>(`${this.base}/${gameId}`);
  }
}

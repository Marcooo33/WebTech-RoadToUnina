import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE } from '../api/api.config';
import { StatisticsDto } from '../../shared/models/stats.model';

/** Thin typed wrapper over `GET /api/me/stats` (docs/api.md §8.2). */
@Injectable({ providedIn: 'root' })
export class StatsService {
  private readonly http = inject(HttpClient);

  get(): Observable<StatisticsDto> {
    return this.http.get<StatisticsDto>(`${API_BASE}/me/stats`);
  }
}

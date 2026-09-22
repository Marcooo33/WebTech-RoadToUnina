import { Pipe, PipeTransform } from '@angular/core';

// Formats a backend-authoritative duration (ms) as H:MM:SS or M:SS.
// Display only, never sent back to the server.
@Pipe({ name: 'duration' })
export class DurationPipe implements PipeTransform {
  transform(ms: number | null | undefined): string {
    if (ms == null || !Number.isFinite(ms) || ms < 0) {
      return '—';
    }
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const mm = minutes.toString().padStart(hours > 0 ? 2 : 1, '0');
    const ss = seconds.toString().padStart(2, '0');
    return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
  }
}

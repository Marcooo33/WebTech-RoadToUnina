import { Injectable, inject, signal, effect } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { GuestGamesService } from '../services/guest-games.service';
import { ApiError } from '../../shared/models/api-error.model';
import { AuthService } from './auth.service';

// Shared by login, registration and Dashboard reload recovery. Authentication
// succeeds independently of this operation; an unsaved result is never hidden.
@Injectable({ providedIn: 'root' })
export class PostAuthGuestService {
  private readonly guests = inject(GuestGamesService);
  private readonly auth = inject(AuthService);
  readonly busy = signal(false);
  readonly message = signal<string | null>(null);
  readonly retryable = signal(false);
  private settledUser: string | null = null;
  private inFlight: Promise<void> | null = null;

  constructor() {
    effect(() => {
      if (!this.auth.isAuthenticated()) this.settledUser = null;
    });
  }

  finish(force = false): Promise<void> {
    if (this.inFlight) return this.inFlight;
    const userId = this.auth.user()?.id;
    if (!userId || (!force && this.settledUser === userId)) return Promise.resolve();
    this.busy.set(true);
    this.message.set(null);
    this.retryable.set(false);
    this.inFlight = this.run()
      .then((settled) => {
        if (settled) this.settledUser = userId;
      })
      .finally(() => {
        this.busy.set(false);
        this.inFlight = null;
      });
    return this.inFlight;
  }
  private async run(): Promise<boolean> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const summary = await firstValueFrom(this.guests.summary());
        let pending = this.guests.pending();
        if (summary.game) {
          pending = {
            gameId: summary.game.id,
            action: summary.game.status === 'COMPLETED' ? 'claim' : 'discard',
          };
          this.guests.remember(pending.gameId, pending.action);
        }
        if (!pending) return true;
        if (pending.action === 'claim') {
          await firstValueFrom(this.guests.claim(pending.gameId));
        } else if (summary.game?.id === pending.gameId && summary.revision !== null) {
          await firstValueFrom(this.guests.discard(pending.gameId, summary.revision));
        }
        this.guests.clearPending();
        return true;
      } catch (error) {
        const err = error as ApiError;
        const transient =
          err.status === 0 ||
          err.status >= 500 ||
          ['GUEST_GAME_BUSY', 'GUEST_GAME_CHANGED'].includes(err.code);
        if (transient && attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, attempt === 0 ? 1000 : 3000));
          continue;
        }
        this.retryable.set(transient);
        const discarding = this.guests.pending()?.action === 'discard';
        this.message.set(
          err.code === 'GUEST_GAME_BUSY'
            ? 'Hai effettuato l’accesso, ma è ancora in corso un’operazione sulla partita ospite. Riprova.'
            : transient
              ? discarding
                ? 'Hai effettuato l’accesso, ma non è stato possibile eliminare la partita ospite incompleta. Riprova.'
                : 'Hai effettuato l’accesso, ma il risultato ospite non è stato salvato. Riprova a salvarlo.'
              : err.status === 401
                ? 'La sessione è scaduta. Accedi di nuovo per salvare il risultato ospite.'
                : err.code === 'GAME_NOT_FOUND'
                  ? 'Il risultato ospite è scaduto o non è più disponibile. Non è stato possibile salvarlo.'
                  : err.message,
        );
        if (!transient && err.status !== 401) this.guests.clearPending();
        return false;
      }
    }
    return false;
  }
}

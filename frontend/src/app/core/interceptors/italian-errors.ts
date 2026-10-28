// Translate presentation only: callers continue to branch on the original code and status.
const ERROR_MESSAGES: Record<string, string> = {
  AUTHENTICATION_REQUIRED: 'La sessione è scaduta o devi effettuare l’accesso. Accedi di nuovo.',
  INVALID_CREDENTIALS: 'Nome utente, email o password non corretti.',
  USERNAME_TAKEN: 'Questo nome utente è già in uso.',
  EMAIL_TAKEN: 'Questa email è già registrata.',
  GAME_NOT_FOUND: 'La partita non è stata trovata o non è più disponibile.',
  GAME_LIMIT_REACHED: 'Hai raggiunto il limite di partite in corso.',
  GAME_NOT_IN_PROGRESS: 'Questa partita non è più in corso.',
  INVALID_MOVE: 'Questo collegamento non è disponibile nella voce attuale.',
  BACKTRACK_NOT_ALLOWED: 'Non puoi tornare indietro in questa partita.',
  BACKTRACK_LIMIT_REACHED: 'Hai esaurito i ritorni indietro disponibili.',
  WIKIPEDIA_UNAVAILABLE: 'Wikipedia è temporaneamente non disponibile. Riprova.',
  NO_STARTING_PAGE: 'Non è stato possibile trovare una voce iniziale adatta. Riprova.',
  GUEST_MOVE_LIMIT_REACHED: 'Hai raggiunto il limite di azioni per questa partita ospite.',
  REQUEST_HEADER_REQUIRED: 'La richiesta non è valida. Ricarica la pagina e riprova.',
  REQUEST_ORIGIN_REJECTED: 'La richiesta non è valida. Ricarica la pagina e riprova.',
  RATE_LIMITED: 'Hai effettuato troppe richieste. Attendi qualche minuto e riprova.',
  GUEST_PLAY_REQUIRES_ANONYMOUS: 'Hai già effettuato l’accesso. Inizia una partita dal riepilogo.',
  GUEST_GAME_EXISTS: 'Hai già una partita ospite. Riprendila o inizia una nuova partita.',
  GUEST_GAME_CHANGED: 'La partita ospite è stata aggiornata in un’altra scheda. Riprova.',
  GUEST_GAME_BUSY: 'È in corso un’operazione sulla partita ospite. Riprova tra poco.',
  GUEST_GAME_NOT_COMPLETED: 'Completa la partita ospite prima di salvarne il risultato.',
  GUEST_GAME_ALREADY_CLAIMED: 'Il risultato di questa partita ospite è già stato salvato.',
  GUEST_RATE_LIMITED: 'Hai effettuato troppe richieste. Attendi un momento e riprova.',
  GUEST_CAPACITY_REACHED:
    'Al momento non è possibile avviare altre partite ospite. Riprova più tardi.',
  GUEST_CLAIM_FAILED: 'Non è stato possibile salvare il risultato ospite. Riprova.',
  VALIDATION_ERROR: 'Controlla i dati inseriti e riprova.',
  INVALID_JSON: 'La richiesta non è valida. Ricarica la pagina e riprova.',
  NOT_FOUND: 'La risorsa richiesta non è stata trovata.',
  INTERNAL_ERROR: 'Si è verificato un errore del server. Riprova.',
};

const VALIDATION_MESSAGES: Record<string, string> = {
  'username is required': 'Inserisci il nome utente.',
  'identifier is required': 'Inserisci il nome utente o la tua email.',
  'email is required': 'Inserisci la tua email.',
  'password is required': 'Inserisci la password.',
  'currentPassword is required': 'Inserisci la password attuale.',
  'newPassword is required': 'Inserisci una nuova password.',
  'username or email is required': 'Inserisci il nome utente o la tua email.',
  'username must be between 3 and 30 characters':
    'Il nome utente deve contenere da 3 a 30 caratteri.',
  'email must be a valid email address': 'Inserisci un indirizzo email valido.',
  'password must be between 8 and 128 characters':
    'La password deve contenere da 8 a 128 caratteri.',
  'newPassword must be between 8 and 128 characters':
    'La nuova password deve contenere da 8 a 128 caratteri.',
};

export function italianErrorMessage(code: string, status: number, message?: string): string {
  if (code === 'VALIDATION_ERROR' && message && Object.hasOwn(VALIDATION_MESSAGES, message)) {
    return VALIDATION_MESSAGES[message];
  }
  if (Object.hasOwn(ERROR_MESSAGES, code)) return ERROR_MESSAGES[code];
  return status >= 500
    ? 'Il server è temporaneamente non disponibile. Riprova.'
    : 'Operazione non riuscita. Riprova.';
}

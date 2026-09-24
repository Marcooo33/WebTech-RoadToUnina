# ROADTOUNINA

## Avvio del progetto

Il progetto è diviso in due parti: **backend** (Express + TypeScript + Prisma/PostgreSQL) e **frontend** (Angular). Vanno avviati separatamente, ciascuno dalla propria cartella.

### Prerequisiti

- Node.js 20+ e npm
- Un database PostgreSQL raggiungibile (ad esempio un progetto Supabase)

### Backend

1. Entra nella cartella del backend:
   ```bash
   cd backend
   ```
2. Installa le dipendenze:
   ```bash
   npm install
   ```
3. Crea il file `.env` a partire dall'esempio fornito:
   ```bash
   cp .env.example .env
   ```
   Poi compila le variabili nel file `.env`:
   - `DATABASE_URL`: stringa di connessione al database PostgreSQL (usata da Prisma).
   - `PORT`: porta su cui gira il server Express (default `3000`).
   - `NODE_ENV`: `development` in locale, `production` in produzione (abilita il flag `Secure` sui cookie).
   - `JWT_SECRET`: segreto per firmare i token JWT, lungo almeno 32 caratteri.
   - `JWT_EXPIRES_IN`: durata del token di accesso (default `8h`).
   - `E2E_FAKE_WIKIPEDIA`: lasciare a `0` in sviluppo (serve solo ai test end-to-end).
4. Genera il client Prisma e applica le migrazioni al database:
   ```bash
   npx prisma generate
   npx prisma migrate deploy
   ```
5. Avvia il server in modalità sviluppo (con riavvio automatico):
   ```bash
   npm run dev
   ```
   Il backend sarà disponibile su `http://localhost:3000`.

   In alternativa, per una build di produzione:
   ```bash
   npm run build
   npm start
   ```

### Frontend

1. In un altro terminale, entra nella cartella del frontend:
   ```bash
   cd frontend
   ```
2. Installa le dipendenze:
   ```bash
   npm install
   ```
3. Avvia il server di sviluppo Angular:
   ```bash
   npm start
   ```
   Il comando esegue `ng serve` usando la configurazione di proxy già presente in `proxy.conf.json`, che inoltra le richieste verso `/api` e `/health` al backend su `http://localhost:3000`. Assicurati quindi che il backend sia già in esecuzione.
4. Apri il browser su `http://localhost:4200`.

---

**Riesci a raggiungere la Federico II partendo da un punto qualsiasi di Wikipedia?** ROADTOUNINA trasforma questa domanda in una sfida di orientamento: si parte da un articolo scelto a caso su Wikipedia in italiano e si deve raggiungere l'**Università degli Studi di Napoli Federico II** seguendo i collegamenti tra gli articoli.

ROADTOUNINA è stato realizzato come progetto universitario per il corso di Web Technologies dell'Università degli Studi di Napoli Federico II. Riunisce in un'unica applicazione web un gioco interattivo completo, account utente, monitoraggio dei progressi personali e classifiche pubbliche.

## La sfida

Ogni partita parte da un nuovo articolo iniziale. Leggi la pagina, scegli uno dei suoi link interni e continua a navigare finché non raggiungi l'articolo Wikipedia dell'università. Il percorso è tutto da scoprire: non esiste una sequenza di pagine prestabilita da seguire.

Il gioco registra il tuo percorso mentre giochi. Un clic di navigazione ti sposta su un articolo collegato e conta ai fini del punteggio. Se prendi una strada sbagliata, puoi tornare indietro all'articolo precedente quando la difficoltà selezionata lo consente. Il ritorno indietro viene registrato separatamente e non aggiunge un clic di navigazione.

## Scegli come giocare

Ogni partita combina una modalità di punteggio con un livello di difficoltà.

### Modalità di punteggio

- **Click** — l'obiettivo è raggiungere la meta con il minor numero di clic di navigazione. A parità di clic, vince chi ha il tempo effettivo più basso.
- **Tempo** — l'obiettivo è ottenere il tempo di gioco effettivo più basso. A parità di tempo, vince il percorso con meno clic di navigazione.

Il tempo di gioco effettivo misura il tempo di gioco attivo. Il tempo di attesa per il caricamento di un articolo viene escluso, così il caricamento delle pagine non influisce sul risultato.

### Livelli di difficoltà

- **Facile** — ritorna indietro senza limiti.
- **Medio** — ritorna indietro fino a tre volte in una partita.
- **Difficile** — il ritorno indietro non è disponibile.

## Il tuo spazio giocatore

Crea un account per iniziare le partite e tenere traccia del tuo gioco. Dalla tua dashboard puoi:

- Iniziare una nuova sfida o riprendere una partita in corso.
- Rivedere le partite completate, quelle attive, i migliori risultati e le prestazioni medie.
- Eliminare una partita che non vuoi più continuare.

Il tuo profilo ti permette di aggiornare nome utente ed email, cambiare la password o eliminare il tuo account. L'eliminazione dell'account rimuove anche le partite in corso; le partite completate restano nella cronologia pubblica come **Utente eliminato**.

## Cronologia pubblica e classifiche

Le partite completate sono disponibili nella cronologia pubblica, dove puoi consultare le classifiche per modalità di punteggio e difficoltà. Ogni risultato mostra il giocatore, la posizione in classifica, il numero di clic, il tempo effettivo e la data di completamento. Apri un risultato per esaminare il percorso e le mosse che hanno portato alla Federico II.

Le classifiche usano come criterio principale la metrica della modalità di punteggio e come criterio secondario l'altra metrica per spareggiare. I risultati con punteggi uguali vengono ordinati in modo coerente, con i completamenti più vecchi elencati per primi.

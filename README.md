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

5. Avvia il server:

   ```bash
   npm run build
   npm start
   ```

   Il backend sarà disponibile su `http://localhost:3000`.

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

## Gioca come ospite

**Play as Guest** avvia subito una partita **CLICK / EASY**, senza account e senza
schermata di selezione. Le modalità e difficoltà della creazione autenticata
rimangono tutte disponibili.

Ogni identità ospite ha una sola partita: dalla home si può riprendere quella in
corso oppure visualizzare il risultato non salvato. **Start New** richiede una
conferma; annullare o fallire la creazione conserva la partita precedente.

Le partite ospite e le mosse rimangono esclusivamente nella memoria del processo
Express. Un cookie `guest_token`, casuale e HttpOnly, permette di riprenderle dopo
un refresh o la riapertura del browser. Il cookie è host-only, `SameSite=Lax`, con
percorso `/api/guest-games` e flag `Secure` in produzione: il deployment previsto
è frontend/API sulla stessa origine, con HTTPS in produzione. Non abilitare CORS
con credenziali verso origini arbitrarie.

La scadenza è di **24 ore di inattività**. Creazione/sostituzione, apertura della
partita o del risultato, mosse valide, una pausa che chiude un intervallo e un
tentativo valido di salvataggio rinnovano la scadenza. Un'apertura valida può
rinnovarla anche se Wikipedia è temporaneamente irraggiungibile. Riepiloghi,
letture del solo articolo, richieste non valide/conflittuali e risposte ripetute
a un risultato già salvato non la rinnovano. Non sono presenti polling o
heartbeat. La pulizia avviene anche ogni minuto.

**Un riavvio del backend perde le partite ospite non salvate.** La cancellazione
del cookie ne perde l'accesso. La soluzione prevede un solo processo Express;
non usa Redis, sessioni persistenti o nuove tabelle. Il limite predefinito è di
500 identità conservate, incluse le ricevute di salvataggio. Ogni partita conserva
al massimo **1000 mosse** (navigazione e ritorno indietro insieme); raggiunto il
limite, ulteriori mosse vengono rifiutate senza modificare la partita. Si può
ancora visualizzarla o sostituirla con conferma; una vittoria alla millesima mossa
resta salvabile. Ogni identità può effettuare **120 richieste di gioco al minuto**
(apertura, articolo, navigazione, ritorno e pausa, inclusi tentativi non validi o
conflittuali), con finestra fissa di 60 secondi. L'eccesso restituisce `429` senza
rinnovare il TTL o modificare lo stato. Riepilogo, scarto e salvataggio non consumano
questa quota, così il recupero post-login e il salvataggio restano disponibili.
La creazione è limitata a dieci tentativi per IP ogni dieci minuti; non vengono eliminate
silenziosamente partite non scadute per fare spazio.

Dopo la vittoria, registrazione e login salvano automaticamente partita e intera
cronologia delle mosse con un'operazione autenticata separata. Il risultato entra
normalmente in Dashboard, History, classifica CLICK/EASY e statistiche personali.
La transazione conserva gli istanti originali della partita. Se il salvataggio
fallisce temporaneamente, l'utente rimane autenticato, il risultato resta in
memoria e sono disponibili due tentativi automatici e un pulsante Retry. Un
risultato perso/scaduto viene segnalato esplicitamente. Autenticarsi prima della
vittoria elimina invece la partita incompleta tramite una richiesta esplicita;
il semplice rifiuto di una richiesta di gioco autenticata non elimina nulla.
Lo stato corrente del backend prevale sempre sui suggerimenti locali: un risultato
completato viene salvato e non può essere eliminato dallo scarto post-login.
Un'operazione ospite ancora in corso restituisce `409 GUEST_GAME_BUSY` anche nel
riepilogo; il coordinatore riprova dopo 1 e 3 secondi, poi espone Retry senza
considerare conclusa la pulizia. Una sostituzione fallita conserva la partita
precedente, che viene quindi riletta e salvata o scartata secondo il suo stato.

Il motore condiviso mantiene il tempo ufficiale sul server. Un'apertura carica
prima l'articolo e poi avvia l'intervallo; una mossa misura fino al suo arrivo al
servizio ed esclude il caricamento successivo riuscito. Gli errori di navigazione
lasciano aperto l'intervallo. Se la pausa di uscita non arriva, la riapertura
scarta l'intervallo non consolidato, come per le partite autenticate. Le schede
condividono una partita: richieste con una revisione precedente vengono rifiutate
e richiedono di rileggere lo stato, senza ripetere automaticamente la mossa.

### API ospite

Tutte le richieste `/api/guest-games`, e login/registrazione, richiedono
`X-Requested-With: ROADTOUNINA`. La SPA lo aggiunge automaticamente; i client API
devono inviarlo esplicitamente. Questo protegge anche il GET di apertura che
riavvia il tempo. L'uscita ospite usa `fetch` con `keepalive` e lo stesso header.

- `GET /api/guest-games`: riepilogo senza ripresa del tempo o rinnovo TTL.
  Senza cookie ne imposta uno prima della creazione, così le altre schede possono
  osservare un avvio ancora in corso. La SPA condivide letture iniziali concorrenti.
  I client API che coordinano più richieste devono leggere prima il riepilogo.
- `POST /api/guest-games`: `{}`; nessun campo `mode` o `difficulty` è accettato.
- Sostituzione: `{ "replaceGameId": "<uuid>", "replaceRevision": 3 }`.
- `GET /:gameId`: stato/articolo e ripresa; `GET /:gameId/article`: solo articolo.
- `POST /:gameId/moves`: `{ "toTitle": "Napoli", "revision": 3 }`.
- `POST /:gameId/backtrack` e `/pause`: `{ "revision": 3 }`.
- `DELETE /:gameId`: `{ "revision": 3 }`, anche per lo scarto post-login.
- `POST /:gameId/claim`: `{}`, con cookie ospite e autenticazione. Restituisce
  `201` alla prima conferma e `200` alla ripetizione dello stesso proprietario.

I percorsi abbreviati sopra sono relativi a `/api/guest-games`. Stato e tempi non
vengono mai accettati dal client. Una revisione obsoleta o un'operazione in corso
restituiscono `409`; identità mancante, scadenza e perdita dello stato `404`.

### Verifica

- Backend: `cd backend && npm test` e `npm run build`.
- Angular: `cd frontend && npm test -- --watch=false` e `npm run build`.
- Browser/database: `cd e2e && npm test`, dopo la configurazione di `e2e/.env`.
  Il runner usa solo PostgreSQL locale isolato sulla porta `55432`, applica le
  migrazioni già esistenti e rimuove il database temporaneo al termine. Non usare
  `DATABASE_URL` di produzione per i test.

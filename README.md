# ROADTOUNINA

**Riesci a raggiungere la Federico II partendo da un articolo casuale di Wikipedia?**

ROADTOUNINA è un gioco di navigazione ispirato alle Wikipedia Speedrun: segui i
collegamenti tra gli articoli di Wikipedia in italiano fino a raggiungere
l'Università degli Studi di Napoli Federico II. È un progetto universitario
realizzato per il corso di Web Technologies.

**Demo pubblica:** non ancora pubblicata. Il collegamento verrà aggiunto dopo il
deploy e la verifica dell'applicazione.

![Homepage di ROADTOUNINA](assets/screenshots/landing.png)

## Funzionalità

- Partita di prova senza registrazione, in modalità **Click / Facile**.
- Registrazione o login dopo la vittoria per salvare il risultato e il percorso.
- Modalità **Click** e **Tempo**, con tre difficoltà che regolano il ritorno indietro.
- Cronologia delle partite, statistiche personali e classifiche pubbliche.
- Gestione del profilo e autenticazione con cookie HttpOnly.

Per provare il gioco, apri la home e avvia una partita come ospite. Il risultato
non viene salvato nel database finché non ti autentichi. Le partite ospite
rimangono nella memoria del backend: scadono dopo 24 ore di inattività e vengono
perse in caso di riavvio o deploy prima del salvataggio.

## Tecnologie e architettura

- **Frontend:** Angular 22, TypeScript 6, RxJS e CSS.
- **Backend:** Express 5, TypeScript, Prisma 7, PostgreSQL, JWT e bcrypt.
- **Test:** Vitest, test runner Node.js e Playwright.

In produzione un unico Web Service Render Free serve la build Angular e le API
`/api`, sulla stessa origine HTTPS. Il backend accede al database Supabase Free
e alle API di Wikipedia. I cookie rimangono HttpOnly e `SameSite=Lax`, con
`Secure` in produzione; il frontend non contiene credenziali del database.

In locale Angular usa il proprio server di sviluppo e inoltra `/api` e `/health`
a Express attraverso il proxy già configurato.

## Esecuzione locale

Occorrono Node.js **24.20.0** (versione fissata in `.node-version`), npm e un
database PostgreSQL dedicato allo sviluppo. I pacchetti Angular richiedono
almeno Node `^22.22.3`, `^24.15.0` oppure `>=26.0.0`.

Non esiste un package npm alla radice. Prepara il backend:

```bash
cd backend
npm ci
cp .env.example .env
```

Compila `.env` con la connessione PostgreSQL e un `JWT_SECRET` casuale di almeno
32 caratteri. Mantieni `NODE_ENV=development` ed `E2E_FAKE_WIKIPEDIA=0`.

```bash
npm run prisma:generate
```

Su un database di sviluppo nuovo, applica le migrazioni con
`npx prisma migrate deploy`. Su un database già popolato verifica prima lo stato
con `npx prisma migrate status` e leggi le migrazioni pendenti: alcune migrazioni
storiche rimuovono colonne o tabelle. Non usare reset o `db push` sui dati
esistenti. Avvia poi il backend:

```bash
npm run dev
```

In un secondo terminale:

```bash
cd frontend
npm ci
npm start
```

Apri `http://localhost:4200`. Express ascolta di default sulla porta `3000`.

## Build e pubblicazione

Dalla radice del repository:

```bash
node scripts/build.mjs
```

Lo script installa dai lockfile, compila Angular, genera il client Prisma e
compila Express. Non applica migrazioni e non effettua query al database.

Configurazione prevista per Render:

| Impostazione | Valore |
| --- | --- |
| Tipo e piano | Web Service, **Free** |
| Branch | `main` |
| Root Directory | Radice del repository, campo vuoto |
| Build Command | `node scripts/build.mjs` |
| Start Command | `npm --prefix backend start` |
| Health Check Path | `/health` |
| Auto-Deploy | **After CI Checks Pass** |

Le variabili sono descritte in `backend/.env.example`:

| Variabile | Uso |
| --- | --- |
| `DATABASE_URL` | Connessione PostgreSQL, soltanto sul backend |
| `JWT_SECRET` | Segreto casuale di almeno 32 caratteri |
| `JWT_EXPIRES_IN` | Durata JWT, predefinita `8h` |
| `NODE_ENV` | `development` in locale, `production` su Render |
| `PORT` | Assegnata da Render; predefinita `3000` in locale |
| `PUBLIC_ORIGIN` | Origine HTTPS pubblica; su Render può derivare da `RENDER_EXTERNAL_URL` |
| `TRUST_PROXY_HOPS` | `0` in locale; numero di proxy fidati (`0`–`5`) da determinare e verificare su Render |
| `SERVE_FRONTEND` | Distribuzione della build statica, abilitata in produzione |
| `DB_HEALTH_SECRET` | Facoltativo; abilita il controllo DB protetto, almeno 32 caratteri |
| `E2E_FAKE_WIKIPEDIA` | Solo test; deve rimanere `0` in produzione |

Non inserire `.env` o credenziali nel repository e non configurare migrazioni
automatiche senza aver verificato quelle già applicate al database esistente.
Prima della pubblicazione verificare quote Supabase e accessibilità delle tabelle
tramite Data API, grant e RLS: l'accesso diretto del backend non rende sicura
un'eventuale API pubblica del database.

GitHub Actions esegue test e build prima del deploy; il controllo finale
**Required checks** deve riuscire. L'attivazione di Render e il collegamento a
GitHub richiedono la configurazione degli account: il repository non crea
servizi esterni. Non è configurato alcuno scheduler di ping. `/health` verifica
il processo HTTP senza dipendere dal database; il controllo DB protetto resta
separato ed è disabilitato senza segreto.

Un'interruzione temporanea del database non impedisce l'avvio HTTP o la
distribuzione della landing. La verifica iniziale della sessione nel browser
attende al massimo cinque secondi; le funzioni che richiedono PostgreSQL restano
dipendenti dalla sua disponibilità.

L'endpoint `GET /api/health/db` richiede `X-Health-Secret` ed esegue una sola
lettura minima senza restituire dati. Le chiamate autorizzate sono limitate a
12 all'ora; il segreto va mantenuto soltanto nella configurazione server e
dell'eventuale chiamante autorizzato. Prima di impostare `TRUST_PROXY_HOPS`,
verificare la catena effettiva dell'ingresso Render e che un client non possa
falsificare l'IP usato dai limiti sulle richieste.

Con Render Free anche il frontend può attendere il risveglio del servizio dopo
un periodo di inattività. Il piano gratuito ha quote di utilizzo e non offre
disponibilità continua garantita. Per un budget di 0 € mantenere il piano Free,
non attivare risorse a pagamento e verificare le quote nel dashboard.

## Verifiche

```bash
npm --prefix backend test
npm --prefix backend run build
npm --prefix frontend test -- --watch=false
npm --prefix frontend run build
```

Per la suite browser esistente occorrono Docker e Chromium:

```bash
cd e2e
npm ci
cp .env.example .env
npx playwright install chromium
npm test
```

Il runner avvia PostgreSQL locale temporaneo, applica le migrazioni e rimuove il
database al termine. Il controllo di sicurezza accetta soltanto
`localhost`/`127.0.0.1:55432/roadtounina_e2e`: non usare Supabase per i test e non
aggirare questa protezione. I test browser usano una fixture Wikipedia
deterministica anziché il servizio esterno.

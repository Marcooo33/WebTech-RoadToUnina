# Keep-alive gratuito: Render e Supabase

Questa configurazione usa esclusivamente il Web Service Render Free e il progetto
Supabase Free esistenti, più un account gratuito cron-job.org. Non richiede
dipendenze, nuove tabelle, migrazioni, scritture periodiche o GitHub Actions.
La creazione dei job e la configurazione remota sono operazioni manuali successive.

## Funzionamento

- `GET /health` ogni 10 minuti: risposta `200 {"status":"ok"}` senza accesso al DB
  o a Wikipedia. Riduce il rischio di sleep del servizio Render per inattività.
- `GET /api/health/db` ogni 6 ore: lettura minima tramite il client Prisma condiviso
  e la connessione PostgreSQL già configurata con `DATABASE_URL`. Non usa un SDK
  Supabase, non espone dati e non modifica record applicativi.

Il secondo endpoint mantiene la query esistente:

```sql
SELECT EXISTS (SELECT 1 FROM users LIMIT 1)
```

Una tabella vuota è un risultato valido. Il controllo verifica la lettura, non
l'intero schema, tutte le policy RLS o tutte le funzionalità dell'applicazione.
Non serve modificare policy, grant o ruoli per configurare i job.

La lettura avviene in una breve transazione Prisma con `maxWait: 5000` e
`timeout: 5000` millisecondi. Prima della lettura viene applicato
`SET LOCAL statement_timeout = '3s'`: PostgreSQL interrompe lo statement lento,
anche quando attende un lock. Commit e rollback ripristinano il valore precedente
prima del riuso della connessione. Il timeout di connessione già presente è 5 s.
Non si usa un `Promise.race` che abbandoni una query ancora attiva e non si cambiano
i timeout delle altre funzionalità. I limiti non costituiscono una scadenza HTTP
assoluta in presenza di guasti di rete, né includono il cold start di Render.

## Configurazione sicura di Render

Verificare nel dashboard del servizio, senza copiare segreti nel repository:

| Variabile | Verifica |
| --- | --- |
| `DB_HEALTH_SECRET` | Valore casuale dedicato di almeno 32 caratteri. Assente o vuoto disabilita il check DB. |
| `DATABASE_URL` | Connessione PostgreSQL del progetto corretto, soltanto sul backend; non cambiarla per il keep-alive. |
| `JWT_SECRET` | Segreto applicativo esistente, distinto da quello del check. |
| `NODE_ENV` | `production`. |
| `PUBLIC_ORIGIN` / `RENDER_EXTERNAL_URL` | Origine HTTPS pubblica corretta, senza percorso o slash finale. |
| `SERVE_FRONTEND` | Abilitato per il servizio unico; il default in produzione è `1`. |
| `E2E_FAKE_WIKIPEDIA` | `0` o assente; mai `1` in produzione. |
| `PORT` | Usare la porta assegnata da Render. |
| `TRUST_PROXY_HOPS` | Conservare il valore verificato per l'ingresso Render; non allargare la fiducia per i job. |

Per generare il nuovo segreto, eseguire **localmente**:

```bash
node -e 'console.log(require("node:crypto").randomBytes(32).toString("hex"))'
```

Conservarlo in un gestore di password e copiarlo nelle variabili Render e
nell'header del solo job DB. Non riutilizzare `JWT_SECRET`, password PostgreSQL,
chiavi Supabase o token degli utenti. Non inserirlo nell'URL, in Angular, nei log,
negli screenshot, nei comandi salvati nella cronologia o in file versionati.
Una rotazione richiede l'aggiornamento di entrambi i valori; nel frattempo il job
con il vecchio segreto riceverà `404`.

## I due job su cron-job.org

Dopo un deploy autorizzato che includa queste modifiche, usare l'origine HTTPS
effettiva al posto di `https://APP.onrender.com`. Il dominio indicato qui è solo
un segnaposto. Configurare entrambi i job nello stesso account gratuito.

| Impostazione | Render Keep-Alive | Supabase Activity Check |
| --- | --- | --- |
| URL | `https://APP.onrender.com/health` | `https://APP.onrender.com/api/health/db` |
| Metodo | `GET` | `GET` |
| Frequenza | Ogni 10 minuti | Ogni 6 ore, al minuto 05 |
| Cron equivalente | `*/10 * * * *` | `5 */6 * * *` |
| Fuso orario | UTC | UTC |
| Header | `Accept: application/json` | `Accept: application/json` e `X-Health-Secret: SEGRETO_DEDICATO` |
| Body, cookie, autenticazione HTTP Basic | Nessuno | Nessuno |
| Risposta attesa | `200`, JSON `{"status":"ok"}` | `200`, stesso JSON |

Nell'interfaccia, impostare tutti i giorni e mesi; per il primo job i minuti
00, 10, 20, 30, 40 e 50, per il secondo le ore 00, 06, 12 e 18 al minuto 05.
Usare gli URL finali senza redirect. Non aggiungere `Origin`, `Sec-Fetch-Site`
o header browser: il middleware di protezione accetta i client HTTP senza questi
metadati. Non è necessario `X-Requested-With`.

Non usare `/health/db`: non è la route DB e il fallback Angular potrebbe
rispondere con HTML. Verificare sempre anche JSON e `Content-Type` nella prova
iniziale. Non configurare retry ravvicinati o altri job sullo stesso endpoint.
Abilitare notifiche per fallimento, ripristino e disattivazione automatica.

## Risposte e log

| Risposta del check DB | Significato |
| --- | --- |
| `200` | Lettura terminata; nessun risultato SQL restituito. |
| `404` | Endpoint disabilitato, header mancante o segreto errato; nessuna query. |
| `403` | Metadati di origine rifiutati dal middleware. |
| `429` + `Retry-After` | Lettura già in corso o limite di 12 tentativi autorizzati/ora raggiunto. |
| `503` | Lettura fallita, compreso il timeout; errore generico `DATABASE_UNAVAILABLE`. |

Quota e blocco di concorrenza sono per processo e vengono azzerati al riavvio.
Un fallimento DB non viene mascherato con `200`; `/health` può invece rimanere
correttamente disponibile perché verifica soltanto il processo HTTP.

Ogni controllo DB ammesso produce un solo log JSON con `event: "db_health"`,
`status` HTTP e `durationMs`. Non vengono registrati segreti, risultati SQL,
identificativi utente, URL di connessione o errori grezzi del driver. Le richieste
rifiutate e i ping `/health` non aggiungono log applicativi dedicati.

## Verifiche locali e dopo il deploy

Dalla radice, con le dipendenze già installate:

```bash
npm --prefix backend test
npm --prefix backend run build
```

Per la regressione con PostgreSQL reale, usare esclusivamente il runner E2E e
il suo database Docker disposable, configurando prima `e2e/.env` dall'esempio:

```bash
cd e2e
npm test -- db-health.spec.ts
```

Il runner applica le migrazioni solo al DB di test e rimuove container e volume
alla fine. Le guardie richiedono `localhost`/`127.0.0.1:55432/roadtounina_e2e`.
Il test blocca temporaneamente `users`, verifica il `503` dopo il timeout, l'assenza
di letture ancora attive, il ripristino del timeout sulla stessa connessione e
il successivo `200`. Non eseguire prove di lock o guasti su Supabase applicativo.

Per una verifica HTTP manuale su un backend locale collegato a un DB di sviluppo,
impostare `APP_ORIGIN=http://localhost:3000`. Dopo il deploy autorizzato ripetere
la verifica di successo con l'origine HTTPS effettiva, senza introdurre guasti:

```bash
APP_ORIGIN=http://localhost:3000
curl --silent --show-error --include --header 'Accept: application/json' "$APP_ORIGIN/health"
curl --silent --show-error --include --header 'Accept: application/json' "$APP_ORIGIN/api/health/db"
```

Attendere rispettivamente `200` e `404`. Per verificare il segreto in Bash senza
inserirlo nella cronologia o negli argomenti di curl, disabilitare l'eventuale
tracciamento shell (`set +x`), poi:

```bash
read -r -s -p 'DB_HEALTH_SECRET: ' DB_HEALTH_SECRET
printf '\n'
printf 'X-Health-Secret: %s\n' "$DB_HEALTH_SECRET" |
  curl --silent --show-error --include --header @- \
    --header 'Accept: application/json' "$APP_ORIGIN/api/health/db"
unset DB_HEALTH_SECRET
```

Attendere `200` e JSON, oppure un errore HTTP esplicito; non usare `curl -v`,
che mostrerebbe l'header. Controllare `Cache-Control: no-store` sul check DB e
il log sintetico. Dopo aver configurato i job, provarli dalla console cron-job.org
e osservare cronologia, latenze, notifiche e quote per almeno una settimana.

## Costo, quote e rischi residui

Stime senza prove manuali o ulteriori tentativi:

| Consumo | 30 giorni | 31 giorni |
| --- | ---: | ---: |
| Ping Render | 4.320 | 4.464 |
| Check DB / letture applicative | 120 | 124 |
| Richieste HTTP totali | 4.440 | 4.588 |
| Ore di servizio, se sempre attivo | 720 | 744 |

Ogni check aggiunge i comandi della breve transazione. Non ci sono scritture
applicative periodiche; il traffico resta ridotto, con overhead di connessioni,
TLS e log. L'occupazione del servizio Render è il consumo più rilevante.

Render Free documenta sleep dopo 15 minuti, 750 ore/mese **condivise per workspace**,
possibili riavvii e quote separate per banda e build. Il risveglio può durare circa
un minuto. Con un metodo di pagamento, gli extra di banda/build possono essere
fatturati: verificare quote e impostazioni di spesa, mantenere le risorse Free
e non attivare extra per rispettare il budget di 0 €. Un secondo servizio Free
può esaurire le ore condivise. [Limiti ufficiali Render](https://render.com/docs/free)

Supabase può sospendere progetti Free con bassa attività su sette giorni. Non
documenta una soglia che garantisca sufficienti quattro letture automatiche al
giorno: questa strategia è **best effort e non garantisce la prevenzione della
pausa**. Un progetto già sospeso può richiedere il ripristino manuale dal dashboard.
[Disponibilità Supabase](https://supabase.com/docs/guides/deployment/going-into-prod#availability)

cron-job.org offre job e header personalizzati gratuitamente, soggetti a fair use,
con timeout di 30 s e senza garanzia di puntualità. Dopo oltre 25 fallimenti
consecutivi può disattivare il job. Un cold start può superare il suo timeout.
La FAQ dichiara inoltre che non verifica i certificati TLS: usare comunque HTTPS
e un token dedicato con il solo accesso limitato al check, considerando questa
limitazione del servizio. [FAQ ufficiale cron-job.org](https://cron-job.org/en/faq/)

Un guasto o una sospensione Render impedisce anche il check Supabase. Riavvii,
quote e disservizi rimangono possibili; nessun componente garantisce uptime 24/7.
I timeout SQL non risolvono ogni guasto del trasporto di rete. Le partite ospite
in memoria possono ancora perdersi ai riavvii. Le condizioni dei piani possono
cambiare: ricontrollare le fonti e i dashboard prima dell'attivazione.

Riferimenti tecnici: [SET e SET LOCAL](https://www.postgresql.org/docs/17/sql-set.html),
[statement_timeout PostgreSQL](https://www.postgresql.org/docs/17/runtime-config-client.html),
[transazioni Prisma 7](https://docs.prisma.io/docs/orm/v7/prisma-client/queries/transactions).

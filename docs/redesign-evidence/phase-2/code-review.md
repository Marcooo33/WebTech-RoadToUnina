# Fase 2 — code review indipendente

Data: 26 ottobre 2026. Branch ricontrollato: `feat/frontend-redesign`.
Diff rispetto a `e92fe41`, compresi i quattro file nuovi non tracciati
(`auth.css` e tre spec). Nessuna modifica applicativa o commit del reviewer.

## Esito: PASS

PASS della review statica; nessun problema bloccante individuato. Esiti del
tester indipendente e review visiva di Home A/V e form P sono gate separati.

## Evidenze

| Area | File e righe | Riscontro |
| --- | --- | --- |
| Scope | Stato Git e diff da `e92fe41` | Frame Landing in app.css, Home/Landing, presentazione login/register, registro autorizzato e aggiornamento dei due matcher Home nel test E2E auth; nessun cambio backend, servizi, route/guardie, dipendenze, configurazione o altre pagine |
| Frame circoscritto | `frontend/src/app/app.css:8` | `:has(app-landing-page)` applica 1264 px e padding 32/24/20 soltanto in presenza della Landing; Dashboard e altre pagine conservano il frame esistente. Verificato anche il selettore emesso nel bundle Angular: il discendente non riceve un vincolo di encapsulation errato |
| Home A/V | `frontend/src/app/features/home/landing-page.html:2`, `home.css:12` | Titolo sans, CTA guest dominante, percorso Roma/Napoli/Federico II dichiarato esempio concluso; destinazione distinta con nome e bandiera; percorso informativo senza comandi fittizi e verticale ≤600 px, CTA larga ≤350 px |
| Guest F | `frontend/src/app/features/home/landing-page.ts:38`, `landing-page.html:16` | TS modifica solo import/provider delle icone; summary, query guest=start, creazione, revisioni, recupero errori e navigazione invariati. Ripresa/View Result, Start New, conferma e Cancel conservano azioni e binding busy |
| Navigazione e tastiera | `frontend/src/app/features/home/landing-page.html:69`, `:119`, `:139` | Link nativi per esempio, History, login/register; pulsanti per azioni; heading e sezioni nominati; icone decorative nascoste all'accessibilità; nessuna nuova rotta o navigazione sui nodi del percorso |
| Form e primo invalido | `frontend/src/app/features/auth/login/login.ts:59`, `register/register.ts:61` | Ricerca del primo controllo Angular invalido in ordine di dichiarazione e focus sul corrispondente input reale; ritorno prima della richiesta; nessun cambio ai validatori o alla guardia submitting |
| Istruzioni e stati | `frontend/src/app/features/auth/register/register.html:38`, `:77`; entrambi i form a riga 30 | Hint username/password persistenti, descrizioni hint+errore quando invalidi, label/autocomplete conservati, aria-busy sul form; stato errore e pulsante pending esistenti preservati |
| Auth F | `frontend/src/app/features/auth/login/login.ts:35`, `:46`, `:75`; `register/register.ts:35`, `:48`, `:77` | Stessi validatori, credenziali passate, AuthService, continuation.finish(force), Retry e destinazioni successive; il CSS condiviso è limitato ai due componenti |
| Copertura pertinente | `landing-page.spec.ts`, `login/login.spec.ts`, `register/register.spec.ts` | Nove casi nuovi: esempio senza azioni, separatori del testo, guest esistente/conferma/cancel/busy, focus invalidi in ordine, associazioni hint/errori, credenziali immutate e stati pending/errore; prove significative, senza asserzioni su soli valori CSS |

`git diff --check e92fe41` passa. Il CSS applicativo generale e il codice di
Dashboard/configurazione/gioco restano fuori dal diff: nessuna anticipazione
della Fase 3.

## Problemi bloccanti

Nessuno rilevato.

## Osservazioni non bloccanti e limiti

- Home CSS circa 6,4 kB supera il budget warning di 4 kB, restando sotto l'errore
  di 8 kB. Budget invariati: annotare il warning nel rapporto tecnico; da solo
  non impedisce l'accettazione della fase.
- Il focus viene impostato durante submit, mentre Angular aggiorna subito dopo
  hint/errori e aria-invalid. Gli spec verificano focus e associazioni dopo il
  rendering; la lettura effettiva degli errori con screen reader resta da
  verificare, senza attribuirla a questi test.
- Non rieseguiti build/unit/E2E né prove di layout/tastiera browser da questo
  reviewer; il tester indipendente è attivo. I test letti non dimostrano a capo,
  overflow, focus visibile o equivalenza visiva al riferimento B: occorrono i
  rispettivi gate. Nessuna approvazione visiva anticipata delle estensioni P.

## Addendum finale — PASS dopo correzioni

Branch e scope ricontrollati; `git diff --check e92fe41` ancora PASS.
In `e2e/tests/auth.spec.ts:43` e `:52` cambia soltanto il matcher del titolo
Home per il copy B: restano tutte le asserzioni su logout, stato anonimo,
redirect `/dashboard` e successivo login.

I sette `&ngsp;` dopo i `<br>` in `landing-page.html` preservano uno spazio
testuale Angular quando il responsive nasconde l'interruzione; non aggiungono
logica o navigazione. Il nuovo caso `landing-page.spec.ts:66` controlla i sei
testi interessati dalle interruzioni nascoste, senza affidarsi al solo screenshot.
Nessun nuovo problema bloccante o modifica al perimetro applicativo rilevati.

L'esito finale della code review resta **PASS**. Il tester sta ripetendo build,
43 unit, selezione E2E e catture: questi esiti e il gate visivo finale non sono
anticipati dal presente addendum. Nessuna modifica app o commit del reviewer.

# Fase 0 — Baseline e perimetro del redesign

Preparazione del 26 ottobre 2026. Base Git osservata: `6e09ba9`
(`docs: define frontend redesign design system`), branch autorizzato
`feat/frontend-redesign`; working tree inizialmente pulito. Nessuna modifica
funzionale è consentita in questa fase.

## Documenti e riferimenti

Sono stati consultati `AGENTS.md`, `frontend/AGENTS.md`, `DESIGN.md`, il codice
Angular e i modelli condivisi, l'audit in `/tmp/roadtounina-ui-audit/REPORT.md`,
l'esplorazione in `/tmp/roadtounina-ui-exploration/VISUAL-DIRECTIONS.md`,
`index.html`, `game.html`, `styles.css` e le due review del prototipo B.
La directory `docs/` non esisteva al punto di partenza: non erano presenti altre
guide tecniche sotto quel percorso. Le istruzioni e i comandi E2E del repository
restano il riferimento per database e guardie.

I riferimenti essenziali sono conservati in
[design-reference/](design-reference/README.md), con provenienza e checksum.
Home e tipografia articolo `after` sono disponibili a 1440, 768, 390 e 320 px;
i casi 320 di focus, indice, infobox, titolo lungo, busy e percorso completano il
confronto. Le immagini busy/path precedono la rifinitura tipografica e valgono
esclusivamente per HUD e composizione.

## Decisioni e vincoli

| Stato | Contenuto | Criterio di applicazione |
| --- | --- | --- |
| A/V | Palette fredda, cobalto azioni/link, giallo destinazione, Home B, HUD persistente, percorso consultabile, articolo con titoli serif/corpo sans | Confronto diretto con il prototipo e ultima serie `after`; non reinterpretare la direzione |
| P | Token semantici completi, auth, Dashboard, configurazione, risultato, classifica, dettaglio, profilo, varianti TIME/MEDIUM/HARD e infobox complete | Implementazione circoscritta e review esplicita dei rendering; non chiamare queste pagine già approvate |
| F | Routing/guardie, auth/guest, API, backend, database, timer/calcoli, conteggio clic, limiti/backtrack, sanitizzazione | Nessuna variazione; controlli indipendenti del diff e regressioni |

Nessuna dipendenza o font remoto nuovo. Conservare standalone, OnPush,
signals/RxJS, CSS e Lucide. La vecchia palette crema/navy della guida frontend è
superata dall'approvazione B. Le etichette restano nella lingua corrente.
Retry History, mostra password e nuova azione New game dal risultato richiedono
approvazione UX separata e non entrano automaticamente nel trasferimento.

## Inventario Angular e dipendenze

| Area | Componenti e file principali | Dati, stati e comportamenti da preservare |
| --- | --- | --- |
| Fondamenta | `src/styles.css`, `app.html`, `app.css`, `app.ts` | Token e primitive condivise; `.container` esterno e contenitore autonomo gioco; niente secondo sistema CSS |
| Navigazione | `shared/components/nav-bar/` | Home/Dashboard, History, Profile, login/register/guest, logout; menu mobile; stato account da AuthService |
| Feedback | `shared/components/error-banner/`, `loading-spinner/`, `not-found/` | Errori annunciati, testo loading, pagina inesistente, aria e reduced motion |
| Home | `features/home/home.*`, `landing-page.*` | Home sceglie LandingPage o Dashboard; summary guest, busy/error/notice, Resume o View Result, Start New con conferma e revisione guest |
| Login/register | `features/auth/login/`, `register/` | Reactive Forms, validatori correnti, invio/errore, PostAuthGuestService e prosecuzione guest; nessun cambio sessione/API |
| Dashboard | `features/dashboard/` | Liste IN_PROGRESS/COMPLETED, massimo 10 aperte, massimo 5 concluse inizialmente visibili, espansione attuale; statistiche; conferma/cancellazione/busy/error; continuazione guest |
| Configurazione | `features/game/new-game/` | Radio CLICK/TIME, EASY/MEDIUM/HARD, default CLICK/EASY, submitting/error/GAME_LIMIT_REACHED, creazione e navigazione correnti |
| Orchestrazione gioco | `features/game/game-page/` | loading/playing/completed/error, article/notice/busy/retry; API get/move/backtrack/pause; timer da baseline backend; guardia e pagehide; guest tramite servizio selezionato |
| HUD | `features/game/game-hud/` | Input unico GameDto/displayTimeMs/busy; output backtrack; HARD vietato, MEDIUM massimo 3, nessun ritorno prima della seconda tappa; autorità backend |
| Percorso | `features/game/game-path/` | Elenco read-only da PageRef[], badge finale current/target, ordine/ripetizioni reali; riuso nella history |
| Wikipedia | `features/game/wikipedia-article/` e discendenti globali circoscritti | SafeHtml dal backend già sanitizzato, `data-page-title`, evento navigate unico, TOC da h2–h6, rendering completo, busy |
| Risultato | `features/game/game-result/` | Stato completed, GameDto definitivo, metriche modalità, azioni già presenti, messaggio risultato guest non salvato |
| Classifica | `features/history/history-list/` | Pubblica, CLICK/TIME e difficoltà in query URL, paginazione 20, ordinamento backend, loading/error/empty, utente corrente |
| Dettaglio | `features/history/history-detail/` | CompletedGameDetailDto pubblico, percorso e mosse completi read-only, player eventualmente nullo, loading/error |
| Profilo | `features/profile/profile-page/` | Tre form indipendenti username/email/password, requisiti esistenti, errori/successi/busy, logout, cancellazione con dialogo e Cancel iniziale |

I percorsi della tabella sono relativi a `frontend/` dopo `src/app/`, salvo i file
fondamentali esplicitamente indicati. Servizi `core/auth/`, `core/services/`,
interceptor e contratti `shared/models/` sono confini funzionali da leggere,
non bersagli di refactoring. `DurationPipe` conserva il formato esistente.

Toolchain dichiarata: Angular 22.1, TypeScript 6, RxJS 7.8, NgIcons 36,
Vitest 4 e Playwright E2E già presenti; CSS senza SCSS. I requisiti Node degli
strumenti installati vanno verificati nell'ambiente, senza aggiornare dipendenze.
Budget produzione: initial 500 kB warning/1 MB error; CSS componente
4 kB warning/8 kB error. Non alzare i budget per nascondere regressioni.

## Route e condizioni

| Route | Accesso e destinazione |
| --- | --- |
| `/` | Home: LandingPage anonimo, Dashboard autenticato |
| `/dashboard` | Redirect a `/`, invariato |
| `/login`, `/register` | Form reali e flussi di continuazione guest correnti |
| `/new-game` | Auth guard, configurazione |
| `/game/:id` | Auth guard, GamePage, canDeactivate → pauseBeforeLeave() |
| `/guest/game/:id` | Guest guard e data guest, stessa GamePage e guardia uscita |
| `/history`, `/history/:gameId` | Classifica e dettaglio pubblici |
| `/profile` | Auth guard, gestione account |
| `**` | NotFound |

Il risultato è uno stato della GamePage: nessuna nuova route `/result`.

## Baseline e matrice di confronto

La baseline deve provenire dall'Angular attuale, con gli stessi dati mantenuti
nelle successive catture. Intercettazioni/fixture di test verificano la
presentazione: non attestano persistenza o cronometraggio integrati. Non copiare
fixture o simulazioni in `frontend/src/` o `frontend/public/`.

| Gruppo | Baseline da conservare | Confronto dopo |
| --- | --- | --- |
| Sentinelle globali | Home, login/register, lista History e gioco alle quattro larghezze | Fase 1 e ogni modifica globale successiva |
| Home/auth | Home normale e guest esistente, form normale/invalido/error/submitting/continuazione | Home B archiviata; auth P esaminata separatamente |
| Dashboard/config | Liste piene/vuote/loading/error, titoli lunghi, conferma Delete, limite 10, radio e errore limite | Gerarchia delle azioni, copy statistiche, un solo avviso limite |
| Gioco | Start/reading/path/busy, 320×740, indice, infobox, link focalizzato, titolo/percorso lunghi | Prototipo B e tipografia after, misure HUD, semantica/tastiera e varianti modalità/difficoltà |
| Risultati/dati | Risultato guest/auth, history filtri/empty/error, dettaglio lungo, profilo invalid/success/error/dialogo | Proposte P, metriche ufficiali e azioni attuali |

Il tester ha prodotto 89 catture Angular in
`docs/redesign-evidence/phase-0/`, presenti al controllo dei file:
[Home desktop](redesign-evidence/phase-0/home-1440.png),
[Home 320](redesign-evidence/phase-0/home-320.png),
[gioco inizio desktop](redesign-evidence/phase-0/game-start-1440.png),
[lettura 320](redesign-evidence/phase-0/game-reading-320.png),
[busy 320](redesign-evidence/phase-0/game-busy-320.png),
[320×740](redesign-evidence/phase-0/game-320x740-320.png).
La directory include i dati misurati in `measurements.json`, le richieste in
`requests.json` e il probe visivo in `skill-probe.json`, oltre a form, Dashboard,
limite, risultato, classifica/dettaglio e profilo alle quattro larghezze.

Risultati documentati nel [rapporto tecnico](redesign-evidence/phase-0/TEST-REPORT.md):
build PASS, 29 test unitari in 17 file PASS ed
E2E 21 PASS usando il database disposable, successivamente rimosso. L'esame
indipendente degli screenshot e del diff deve ancora completare il quality gate;
questo inventario non dichiara una review visiva svolta dall'implementatore.
Log, report finali e commit effettivo sono associati nel
[registro persistente](redesign-progress.md).

## Perimetro e accettazione per fase

Regola comune: branch verificato prima della fase e del commit, build Angular e
test pertinenti reali, diff autorizzato, screenshot 1440/768/390/320 esaminati,
review visiva e codice indipendenti. Un controllo obbligatorio non eseguito è
FAIL. Massimo tre correzioni oltre all'implementazione iniziale. Nessun commit
per una fase fallita. Il registro associa evidenze e commit effettivo.

| Fase | File modificabili | Accettazione specifica e scenari obbligatori |
| --- | --- | --- |
| 0 | Solo documentazione, riferimenti e strumenti/evidenze di verifica separati dall'app | Baseline Angular riproducibile sui medesimi dati, archivio B/after integro, inventario e criteri; nessuna modifica funzionale; disponibilità tool/browser verificata |
| 1 | `styles.css`, `app.html/css` se necessario alla cornice, Navbar, ErrorBanner, LoadingSpinner e test presentazionali pertinenti | Token A/V, scala spazi invariata, focus 3 px distinguibile, bordi campi 3:1, testo 4.5:1, CTA 48 px e controlli 44 px; menu Escape/focus/aria-current; reduced motion; sentinelle Home/form/lista/gioco senza nuove regressioni |
| 2 | Home/LandingPage, login/register template/CSS e TS solo per semantica/focus, test pertinenti | Home confrontata con B a quattro larghezze e percorso verticale a 320; una CTA dominante; guest esistente e conferma preservati; auth P normale/invalid/error/busy/continuazione; validatori/API/sessioni invariati |
| 3 | Dashboard e NewGame template/CSS, copy e deduplicazione messaggi, test pertinenti | Ripresa prima delle statistiche, conteggi non duplicati, etichette medie CLICK/TIME corrette; dati pieni/vuoti/loading/error; titoli lunghi; Delete con conferma/busy; Mode/Difficulty native equivalenti; un solo avviso limite a testo continuo e test regressione |
| 4 | GamePage, HUD, Path, WikipediaArticle, stili globali solo articolo circoscritto, test pertinenti | Tre aree da 1120, barra sticky solo HUD nelle altre larghezze; start/scroll/path/busy a quattro larghezze e 320×740; nessun overflow; articolo 18 px desktop/17 mobile, titoli 36/32/30; TOC e infobox completi; Tab e attivazione singola, busy blocca duplicati, focus nuovo titolo visibile; dialogo Escape/Tab/Shift+Tab/ripristino focus; CLICK/TIME×EASY/MEDIUM/HARD, valori lunghi e guest/error/retry; timer/API/guardie intatti |
| 5 | GameResult, HistoryList/Detail, Profile, Path condiviso solo adattamenti necessari, test pertinenti | Risultato modalità e guest non salvato; nessuna azione UX nuova; classifica filtri/URL/paginazione/empty/error invariati, numeri allineati e righe mobile compatte; percorso completo e mosse leggibili senza scroll pagina; profilo istruzioni/errori associati e tutti gli esiti password, dialogo distruttivo invariato |
| 6 | Solo correzioni residue presentazionali/semantiche autorizzate, test e documentazione finale | Matrice completa quattro larghezze, flussi e focus tra schermate; zoom 200%, reduced motion e viewport intermedi; E2E integrati necessari solo DB disposable protetto; dichiarare limiti screen reader/browser/dispositivi; elenco audit chiuso con prove e proposte UX ancora aperte |

## Mappa audit e controlli di regressione

| Audit | Problema iniziale | Fase e prova richiesta |
| --- | --- | --- |
| 1, 5 | Anchor Wikipedia senza href saltati da Tab; azione indicata solo dal colore | 4: semantica nativa, Tab/attivazione unica, sottolineatura, focus, busy, stesso output navigate |
| 2, 9 | HUD e messaggio busy fuori vista dopo scroll mobile | 4: destinazione/metriche/Backtrack persistenti a top 0; catture reading e busy |
| 3, 7 | Overflow, badge comprime titoli, percorso nasconde arrivo | 4/5: min-width e layout corretti, titoli interi, dialogo live/lista storica completa |
| 4 | Focus/campi deboli e testo selezionato 4.36:1 | 1–3: rendering e contrasto focus/bordo/campi/radio nei loro stati |
| 6, 13 | Limite duplicato/frammentato e gruppi Mode/Difficulty troppo vicini | 3: errore controllato, un messaggio in flusso normale, selezioni e invio equivalenti |
| 8 | Infobox lunga prima dell'introduzione | 4: disclosure dopo introduzione conservando tutti i dati/link; più tabelle e articoli senza infobox |
| 10, 19 | CTA Home equivalenti, identità e ruoli tipografici disomogenei | 2–5: confronto B/after e gerarchia operativa P, nessuna traduzione o copy inventato |
| 11, 12 | Dashboard ritarda Resume, duplicazioni, first game e medie ambigue | 3: percorsi prima, stato vuoto corretto, label ambito senza cambiare calcoli |
| 14, 20 | Classifica mobile alta, numeri a sinistra, dettaglio senza contesto e flag ruotata | 5: righe compatte, valori tabulari/allineati, titolo partita e bandiera stabile |
| 15 | Tab History incompleti e Retry assente | 5/6: semantica filtri coerente e tastiera; eventuale nuova azione Retry resta proposta UX separata |
| 16 | Requisiti tardivi, focus dopo invalid, errori password incompleti | 2/5: istruzioni e associazioni, orientamento focus se implementato, esiti richiesti senza cambiare autenticazione |
| 17 | Escape menu, aria-current e lingua articolo assenti | 1/4: menu anonimo/auth e ritorno focus, pagina corrente, lang=it per articolo |
| 18 | Risultato poco dominante e nessun New game diretto | 5: metrica ufficiale dominante; New game resta proposta separata non implementata |

Il `body` iniziale usa `overflow-x: hidden`; il gioco è centrato con
`left: 50%`/`transform`. Queste tecniche non devono mascherare errori del nuovo
layout. Il contenuto Wikipedia iniziale usa Georgia anche per il corpo, link
senza href/ruolo tastiera, dimming durante busy e HUD non persistente mobile:
sono baseline da correggere nelle fasi previste, non nuovi comportamenti.

I test che scrivono dati possono usare soltanto il runner E2E con PostgreSQL
disposable `localhost/127.0.0.1:55432`, database `roadtounina_e2e`, guardie intatte.
Nessun test contro produzione o partita reale. Nessun push, merge, rebase o
riscrittura della cronologia fa parte dell'orchestrazione.

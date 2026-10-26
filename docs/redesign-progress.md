# ROADTOUNINA — registro redesign frontend

Avvio: 2026-10-26. Branch autorizzato: `feat/frontend-redesign`.
Punto di partenza: `6e09ba9` (`docs: define frontend redesign design system`).
Working tree iniziale pulito; nessun registro preesistente o directory `docs/`.

L'orchestrazione segue `DESIGN.md`: A/V preservate, P da validare sul rendering,
F invariati. Nessun push, merge, nuova dipendenza o modifica backend autorizzata.
Solo l'implementatore delegato modifica il codice applicativo. Tester e reviewer
producono evidenze e verifiche indipendenti. Le intercettazioni browser provano la
presentazione; soltanto la suite disposable prova i flussi integrati.

| Fase | Stato | Commit |
| --- | --- | --- |
| 0 — Baseline e perimetro | PASS | `ba799db` |
| 1 — Fondamenta e componenti condivisi | PASS | `e92fe41` |
| 2 — Home e autenticazione | PASS | hash dopo commit |
| 3 — Dashboard e configurazione | PENDING | — |
| 4 — Partita e articolo | PENDING | — |
| 5 — Risultato, History, dettagli, profilo | PENDING | — |
| 6 — Verifica trasversale | PENDING | — |

## Fase 0 — 2026-10-26

- Branch e stato Git verificati prima di avviare il lavoro.
- Riferimenti `/tmp/roadtounina-ui-prototype/`, audit ed esplorazione disponibili.
- Nessuna documentazione tecnica preesistente sotto `docs/`.
- Implementatore: inventario Angular, matrice accettazione, conservazione riferimenti essenziali.
- Tester: build, unit, suite E2E protetta e baseline Playwright alle quattro larghezze.
- Ambiente: Node 24.20.0, Docker e Chromium disponibili; dipendenze già installate.
- Build baseline PASS; unit baseline PASS (17 file, 29 test), segnalati dal tester.
- [Inventario e criteri](redesign-phase-0.md), [riferimenti](design-reference/README.md).
- [Rapporto tecnico](redesign-evidence/phase-0/TEST-REPORT.md): build PASS,
  29 unit in 17 file PASS, 21 E2E PASS; disposable rimosso; 89 screenshot prodotti.
- [Review visuale indipendente](redesign-evidence/phase-0/visual-review.md): PASS,
  30 catture Angular e 18 riferimenti esaminati; nessun blocco Fase 0.
- [Code review indipendente](redesign-evidence/phase-0/code-review.md): PASS,
  codice invariato, 19 checksum e provenienza verificati, nessun blocco Fase 0.
- Gate complessivo PASS: difetti preesistenti documentati e assegnati alle fasi future.
- Limiti: inspector autonomo skill fallito all'avvio Chrome; usato probe reale tramite
  Playwright. Catture con API intercettate e immagini remote bloccate; persistenza e
  flussi integrati verificati separatamente dagli E2E. Screen reader/browser fisici
  e varianti future non attribuiti alla baseline. Input temporanei mantenuti in `/tmp`.
- Correzioni: nessuna. Codice applicativo invariato.
- Commit: `ba799db` — `chore: complete redesign phase 0`.
- Normalizzati soltanto whitespace e newline finali dei log prima del commit; nessun contenuto degli esiti alterato.

## Fase 1 — 2026-10-26

- Branch verificato, working tree pulito al checkpoint `ba799db`.
- Perimetro: token/primitive globali e Navbar/ErrorBanner/LoadingSpinner, semantica e test pertinenti.
- Comportamenti auth/API/routing e gioco invariati; composizioni pagine rinviate alle fasi previste.
- Implementazione delegata; test e review successivi, nessun gate ancora attribuito.
- File applicativi/test modificati: `frontend/src/styles.css`, Navbar (`.ts/.html/.css/.spec.ts`),
  `shared/components/error-banner/error-banner.ts`, `loading-spinner/loading-spinner.ts`.
- Implementazione: palette B, font token, scala spazi costante, controlli/focus/disabled,
  semantici condivisi, Navbar con indicazione pagina, Escape e focus senza trap.
- Feedback implementatore: build e 34 unit PASS; gate indipendenti ancora in corso.
- [Tester indipendente](redesign-evidence/phase-1/TEST-REPORT.md): build PASS, 34 unit/18 file PASS,
  E2E mirati auth/navigation/public 4 PASS; disposable rimosso. 127 screenshot prodotti;
  focus/tastiera/menu/contrasti/reduced motion verificati; nessun nuovo overflow.
- [Visual review](redesign-evidence/phase-1/visual-review.md): PASS, 68 immagini esaminate,
  primitive e combinazioni semantiche renderizzate validate; nessun blocco nuovo.
- [Code review](redesign-evidence/phase-1/code-review.md): PASS; scope e vincoli F invariati.
- Gate complessivo PASS, zero cicli di correzione applicativa. Aggiornata soltanto attesa
  rendering nel harness del tester. Limiti inspector, immagini remote e screen reader invariati.
- Non bloccanti: perdita focus con relatedTarget nullo e resize menu mobile→desktop
  da verificare in Fase 6; difetti originali del gioco rinviati alla Fase 4.
- Commit Fase 1: `e92fe41` — `feat(ui): complete redesign phase 1`.

## Fase 2 — 2026-10-26

- Branch verificato e working tree pulito al checkpoint `e92fe41`.
- Scope: Home/LandingPage e form auth; TS solo presentazione/focus e test pertinenti.
- Prototipo Home A/V, auth P da review; validatori, sessioni, continuazione guest e API invariati.
- Implementazione delegata; gate ancora da eseguire.
- Implementazione pronta: Home B, app.css solo frame landing, auth hint/focus e otto test nuovi.
- Build indipendente PASS con warning Home CSS 6,42 kB (warning4/error8 invariati), unit42/21file PASS.
- Ciclo correzione 1: E2E auth/guest/pending iniziale12/13 PASS; unico FAIL matcher del
  precedente titolo Home in `e2e/tests/auth.spec.ts:43`. Scope esteso al solo matcher
  test del copy approvato; nessuna regressione di flusso osservata. Ripetizione richiesta.
- Delega visiva inizialmente indisponibile per limite thread, poi ripresa correttamente;
  review resta indipendente (nessun fallback autoattribuito).
- Interruzione dei subagent per limite utilizzo, nessun commit di fase; ripresa su esplicito
  «continua», riconciliati branch/Git/registro e modifiche tutte attribuite all'orchestrazione.
- Ciclo correzione 2: visual reviewer trova concatenazione helper Home a768 (br nascosto).
  Aggiunti spazi preservati Angular nei sette br e regressione sui sei testi responsive;
  nessun cambio al copy. Nuova verifica indipendente e catture in corso.
- File Fase 2: app.css, home.css, landing-page.html/.ts/.spec.ts, auth/auth.css,
  login e register .html/.ts/.spec.ts, e2e/tests/auth.spec.ts (matcher del titolo).
- [Verifica tecnica finale](redesign-evidence/phase-2/TEST-REPORT.md): build PASS,
  43unit/21file PASS, 13E2E PASS e disposable rimosso;84catture/check alle4larghezze,
  focus invalidi, associazioni, busy/error/guest continuation e nooverflow PASS.
- [Code review finale](redesign-evidence/phase-2/code-review.md): PASS inclusi addenda correzioni.
- [Visual review indipendente](redesign-evidence/phase-2/visual-review.md): PASS,
  tutte84catture finali e4riferimenti Home esaminati; authP validati sui rendering.
- Gate complessivo PASS dopo due cicli di correzione. Non bloccante rimasto:
  warning CSS Home6,42kB; limiti inspector/SR/altri browser espliciti nei rapporti.

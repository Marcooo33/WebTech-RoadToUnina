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
| 2 — Home e autenticazione | PASS | `ea8cdcd` |
| 3 — Dashboard e configurazione | PASS | `a41fe1a` |
| 4 — Partita e articolo | PASS | `7910114` |
| 5 — Risultato, History, dettagli, profilo | PASS | `2b3455a` (+ `bd12101` log) |
| 6 — Verifica trasversale | PASS | hash dopo commit |

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
- Commit Fase2: `ea8cdcd` — `feat(ui): complete redesign phase 2`.

## Fase 3 — 2026-10-26

- Branch verificato e working tree pulito al checkpoint `ea8cdcd`.
- Scope Dashboard e NewGame: gerarchia, copy, radio e deduplicazione limite, test pertinenti.
- Servizi/calcoli/azioni/limiti/default immutati; proposte P da review su tutti gli stati.
- Implementazione: sei file Dashboard/NewGame `.html/.css/.spec.ts`; nessun TypeScript
  applicativo modificato. Percorsi prima delle statistiche nel DOM, copy medie per
  modalità, controlli e conferme preservati; radio/default invariati e alert limite unico.
- Feedback implementatore: build PASS, 49 test/21 file PASS, nessun nuovo warning.
  Corretto soltanto un selettore del nuovo test prima della consegna; nessuna app change.
- Verifiche indipendenti e review avviate, nessun gate complessivo ancora attribuito.
- [Tester indipendente](redesign-evidence/phase-3/TEST-REPORT.md): build PASS,
  49 unit/21 file PASS, 3 E2E PASS e disposable rimosso; 76 screenshot/84 verifiche
  browser alle quattro larghezze, stati e sei combinazioni native PASS, no overflow.
- [Code review](redesign-evidence/phase-3/code-review.md): PASS, nessun blocco.
- Il campione temporaneo statistiche è stato corretto dopo osservazione visuale:
  due concluse CLICK/TIME e medie coerenti. Differenza dati rispetto baseline esplicita
  nel rapporto tecnico; screenshot rigenerati, nessuna correzione applicativa.
- Visual reviewer comunica esame finale delle 76 catture concluso senza blocchi;
  rapporto persistente da collegare prima del commit. Zero cicli di correzione app.
- [Visual review indipendente](redesign-evidence/phase-3/visual-review.md): PASS,
  tutte 76 immagini finali esaminate; proposte P validate, nessun blocco.
- Gate complessivo PASS. Rimane solo warning CSS Home precedente; limiti browser/SR
  dichiarati nei rapporti. Commit autorizzato dopo controllo finale del diff.
- Commit Fase 3: `a41fe1a` — `feat(ui): complete redesign phase 3`.

## Fase 4 — 2026-10-26

- Branch verificato e working tree pulito al checkpoint `a41fe1a`.
- Scope GamePage/HUD/Path/WikipediaArticle, shell e globali solo integrazione gioco/articolo,
  test pertinenti. Gruppi: cornice, HUD/percorso, tipografia/indice, link/focus, infobox.
- Timer, richieste/API, regole/backtrack, guardia uscita, auth/guest e trust boundary invariati.
- Gate obbligatori: tastiera/busy, confronto B e after, quattro larghezze e 320×740,
  varianti modalità/difficoltà, contenuto reale sanitizzato e regressioni E2E disposable.
- Gruppo 1 implementato, build locale PASS: frame unico1280 e misura articolo,
  rimozione transform/overflow-x hidden body, main annidato rimosso, Leave game preservato.
- Gruppi successivi in corso. Nessuna verifica indipendente Fase 4 ancora eseguita.
- Tester ha preparato soltanto `/tmp/roadtounina-phase4-checks.cjs` con matrice
  responsive/tastiera/stati/contenuti complessi; esecuzione attende consegna finale.
- Checkpoint gruppi 2–4: build e49test esistenti PASS comunicati dall'implementatore;
  HUD unico/ResizeObserver, dialogo nativo, tipografia/TOC/lang e anchor locali implementati.
  Busy senza opacità; infobox preservate come nodi sanitizzati originali in details.
- Regressioni specifiche ancora in aggiunta. Root legge diff GamePage: cambiamenti
  limitati a misura/dialogo/focus/scroll; nessun gate indipendente ancora attribuito.
- Consegna finale implementatore: build PASS, 68 test/21 file PASS, nuovo E2E
  Enter/focus aggiunto da eseguire. Gruppi completi, nessuna ulteriore modifica in corso.
- Probe locale implementatore isolato: lettura 700/704/350/288, HUD73/107, top0
  compatto e266anchor native; solo feedback, non gate indipendente.
- Nuova interruzione subagent per limite utilizzo prima dei gate; ripresa su «continua»,
  verificati branch/cronologia/diff interamente attribuibili alla Fase4. Nessun commit.
- Gate indipendenti riattivati: tester conferma build e68unit PASS; E2E e browser
  ancora in corso, review codice/visiva ancora necessarie.
- Verifica E2E completa iniziale: 20 PASS / 2 FAIL, disposable rimosso. Matcher
  obsoleti/ambiguo in game-lifecycle (New game exact) e profile (titolo Home B).
- Code reviewer riproduce blocco: indice verso heading in infobox chiusa non apre
  details antenato; titolo resta invisibile. Fix e regressione richiesti nel ciclo1.
- Raccolta problemi browser/review in corso; riattivazione implementer temporaneamente
  limitata dagli slot, nessuna modifica non autorizzata e nessun commit della fase.
- Ciclo correzione1 completato dall'implementatore: TOC apre tutti details antenati
  prima di misura/focus/scroll; regressione su infobox e disclosure annidate con nodi/link
  originali preservati. Due matcher E2E aggiornati. Feedback69unit PASS, diff PASS.
- Giro browser esplorativo118check/PNG non trova altri bugapp; non usato come set finale
  per possibile HMR. Ripartenza finale build/unit/E2E22 e matrice stabile, review mirata.
- Code review dopo ciclo1 PASS: riproduzione mirata3/3 Chromium a320/390/1440,
  disclosure aperti, focus/visibilità sottoHUD e identità nodi verificati.
- Browser finale dopo ciclo1: 126 PNG/130 record PASS tecnico comunicati; visual review
  rileva ulteriore S2: navigation-error notice presente DOM ma fuori viewport dopo scroll.
  Verifica tecnica mirata richiesta anche per error() durante playing; gate resta aperto.
- Verifiche ciclo1: build/69unit PASS, E2E completa22 PASS (disposable rimosso).
  Visual esamina132catture: unico blocco S2 feedback durante lettura fuori viewport.
- Tester conferma8/8 casi: notice WIKIPEDIA_UNAVAILABLE ed error INTERNAL_ERROR alle
  quattro larghezze; intersezione messaggio/viewport sottoHUD pari a0. Evidenze
  error-reading-initial.json e relative PNG. Rapporto tecnico FAIL nonostante altri PASS.
- Ciclo correzione2 assegnato: feedback playing una sola volta nell'area HUD misurata,
  stati nonplaying conservati, nessun cambio a lifecycle/API/timer. Verifiche in attesa.
- Ciclo correzione2 consegnato: delta solo game-page.html/spec.ts e game-hud.html/css.
  Feedback playing proiettato unico in HUD osservato; messaggi nonplaying invariati,
  nessun TypeScript applicativo o lifecycle errori/richieste/timer cambiato.
- Feedback locale build PASS e72unit/21file PASS, solo warning Home noto. Nuova verifica
  indipendente build/unit/browser8errori+matrice ed E2E pertinenti in corso; review delta attiva.
- Visual FAIL e132hash precedenti conservati per confronto, più8PNG diagnostiche.
- Ciclo2 build/72unit/E2E22 PASS, disposable rimosso; feedback normale10/10 visibile,
  annuncio unico e contrasti PASS. Nuovo S2 residuo confermato da tester/visual:
  al crescereHUD il link già focalizzato aHUDbase+18 resta coperto8/8compatte.
  Evidenze focus-before/ e error-edge-before.json, storico FAIL visuale aggiornato.
- Nessun altro problema verificato. Ciclo correzione3 (ULTIMO consentito) assegnato:
  mantenere visibile focus articolo con scroll minimo solo se coperto dall'aumentoHUD,
  preservare focus/stato/API e posizioni già visibili. Regressioni e nuova verifica richieste.
- Se il gate fallisce ancora dopo ciclo3: fermarsi senza commit e senza Fase5.
- Correzione3 finale consegnata: delta solo GamePage.ts/spec.ts; dopo aumentoHUD,
  scroll minimo istantaneo solo se focus articolo nel viewport viene coperto anche nel ring.
  Identità focus conservata; no scroll per giàvisibile/offscreen/HUD/dialogo/diminuzione.
- Sette regressioni nuove, feedback locale build/79unit PASS e10edge PASS; probe locale
  separato dalle evidenze tester. Ultimi gate indipendenti riavviati, ancora nessun PASS finale.
- Ultimo tester ciclo3 prima del limite: build/79unit/22E2E e10edge PASS comunicati;
  matrice e probe aggiuntivi in chiusura. Nuova ripresa su «continua»: /tmp pulito,
  ma riferimenti B e risultati persistenti integri. Nessuna estranea nel working tree.
- Riconciliazione necessaria: log unit.txt ancora69 e TEST-REPORT ancoraFAIL ciclo2;
  tester riattivato per verificare JSON finali e salvare nuovi log direttamente in docs
  (rieseguire build/unit/E2E se log finali persi), senza attribuire PASS non documentati.
- Visual reviewer riattivato per edge/busy/focus e differenzeSHA; gate ancora aperto.
- Riconciliazione finale root per indisponibilità capacità del tester: log nuovi build,
  79 unit/21 file e22E2E PASS verificati; disposable rimosso. JSON finali completi,
  script verify-evidence.py PASS (130 record,20 errori,10 focus,162 SHA).
- [Rapporto tecnico finale](redesign-evidence/phase-4/TEST-REPORT.md) integrato dal root
  con fallback dichiarato; nessuna prova attribuita a un agente che non l'ha svolta.
- [Code review finale](redesign-evidence/phase-4/code-review.md): PASS ciclo3.
- [Visual review finale](redesign-evidence/phase-4/visual-review.md): PASS ciclo3,
  162 immagini finali esaminate (128 immutate/4 riesaminate/30 aggiunte), nessun blocco.
- Gate Fase4 PASS dopo i tre cicli consentiti. Non bloccanti: warning Home, screen reader/
  altri browser/zoom non ancora provati; casi resize focus da valutare in Fase6.
- /tmp perso dopo ripresa: riferimenti essenziali e tutte evidenze finali integri nel repo;
  limiti di riproducibilità futura dichiarati. Codice finale invariato dopo consegna ciclo3.
- Commit Fase4: `7910114` — `feat(ui): complete redesign phase 4`.

## Fase 5 — 2026-10-26

- Branch verificato, working tree pulito al checkpoint7910114.
- Scope GameResult, HistoryList/Detail e Profile con test; P da validare sui rendering.
- Stesse azioni, dati, filtri/URL/ranking, form/validatori e conferme distruttive;
  nessuna nuova azione New game/Retry/mostra password.
- Gruppo1 risultato implementato/build locale PASS: meta gialla, metrica dominante,
  percorso esistente e tutte azioni preservate; nessun New game nuovo.
- Gruppo2 History implementato: tab con roving/frecce/HomeEnd/panel, ranking compatto,
  dettaglio partita e mosse con scroll locale nominato; profilo e regressioni in corso.
- Tester prepara soltanto harness durevole, nessuna verifica Fase5 ancora eseguita.
- Consegna finale Fase5: GameResult .html/.css/.ts/.spec, HistoryList .html/.css/.ts/.spec,
  HistoryDetail .html/.css/.spec, Profile .html/.css/.ts/.spec. Nessun globale/core/API/backend.
- TS aggiunto solo handler tastiera tab e focus primo invalido; validatori/azioni/dati invariati.
- Feedback implementatore build PASS,96unit/22file PASS, solo warning Home noto.
- Harness durevole tester e2e/support/redesign-phase-5.mjs e piano HARNESS.md autorizzati;
  campione cambiato dichiarato, nessuna dipendenza /tmp. Gate indipendenti avviati.
- Verifiche indipendenti: build PASS (solo warning Home),96unit/22file PASS,
  E2E completa22 PASS/53,2s e disposable rimosso. Code review indipendente PASS.
- Browser/harness: corretta soltanto attesa aria-selected dopo cambioURL e rango21
  pagina2, nessuna correzione applicativa. 128PNG già prodotti; gate tecnico finale
  e visual review ancora da chiudere, nessun PASS complessivo anticipato.
- [Rapporto tecnico](redesign-evidence/phase-5/TEST-REPORT.md): PASS,
  build/96unit/22E2E, disposable rimosso;128PNG/172record+supplemento tastiera PASS.
  Nessun overflow, target44+, contrasti6,38+, nessuna correzione applicativa.
- [Code review](redesign-evidence/phase-5/code-review.md): PASS, confini F invariati.
- Visual reviewer comunica128/128immagini esaminate ePASS, rapporto in scrittura.
  Non bloccante S3: indici mosse10–31 spezzano cifre a768/390/320; dati completi.
  Riportare come residuo Fase6, non nuova funzionalità o blocco del gate Fase5.
- [Visual review finale](redesign-evidence/phase-5/visual-review.md): PASS,
 128/128immagini viste; nessun blocco. Gate complessivo PASS, zero cicli app.
- Commit Fase5: `2b3455a`. Errore orchestratore: comando multilinea ha proseguito
  al commit dopo whitespace negli esclusivi log staged. Nessun problema app o esiti
  alterati; log normalizzati e diff-check PASS nel commit aggiuntivo `bd12101`.
  Cronologia preservata, nessun amend o riscrittura.

## Fase 6 — 2026-10-26

- Branch verificato e working tree pulito a bd12101 prima della fase.
- Scope residui: indici mosse senza spezzare cifre; gestione focus menu/percorso dopo
  resize, regressioni mirate. Nessuna nuova azione UX o cambio funzionale.
- Gate finali: build/unit/E2E, principali schermate4larghezze e320×740, viewport
  intermedi/zoom200/reduced motion/semantica/tastiera, limiti SR/altri browser espliciti,
  diff complessivo da6e09ba9 e commit corretti. Nessun push/merge.
- Baseline resize dell'implementatore riproduce3residui: menu aperto→desktop→Escape
  focusBODY/stato aperto, Path chiuso desktop focusBODY,66/66indici su2righe.
- Fix iniziali applicati con4regressioni; verifica priorità Escape/dialoghi ancora
  in corso prima consegna. Test supporto resize e produzione durevoli autorizzati.
- Interruzione subagent per limite utilizzo, ripresa su«continua»: branch/diff coerenti.
  Nessun gate finale Fase6 ancora attribuito; test finale attende consegna implementatore.
- Segnalato append del vecchio server al logPhase5: conservare append come evidenza
  Phase6 e ripristinare storico dopo arresto esclusivo del server dell'orchestrazione.
- Consegna iniziale Fase6 completa: indici nowrap, focus resizeNav/Path con fallback
  visibile; guardia Escape/dialogo aggiunta dopo riproduzione dell'interferenza iniziale.
  Build locale328,61kB/101unit PASS, probeafter incl.Profile ePath1040 PASS.
- Root ha fermato esclusivamente serverdev63470 dopo ultimo probe; gate production avviato.
- Code reviewer dedicato indisponibile per capacità: fallback diretto root dichiarato,
  [code-review.md](redesign-evidence/phase-6/code-review.md) PASS statico. Controllati
  diff Fase6 e complessivo da6e09ba9, percorsi backend/core/API/routing/deps invariati.
- Visual reviewer attende produzione indipendente; nessun PASS da sole prove implementatore.
- Tester comunica gate production: build/101unit/22E2E PASS e disposable rimosso,
  principali4width/320×740/soglie/AX/reducedmotion/passaggi eseguiti; zoomChrome200%
  reale con reflow, screenshot fullPage tagliati ricatturati come viewport senza appchange.
- [Visual review finale](redesign-evidence/phase-6/visual-review.md): PASS,
  102PNG production viste + riferimentiB/after; indici S3 chiusi, focus/zoom/modal corretti.
  Nessun blocco visuale. Gate tecnico finale e limiti assistivi ancora da consolidare.
- [Rapporto tecnico finale](redesign-evidence/phase-6/TEST-REPORT.md): PASS con limiti
  dichiarati; build101unit/22E2E, disposable rimosso,220record production,
  replay172record/124PNG, rerun30resize/indici, zoombrowser200 reale.
- Orca avviato su busAT-SPI privato/configtemporanea:6/6 evidenze native mirate,
  descrizione errore/dialogo/focus e output vocale generato. Audio disattivato:
  non prova uditiva/manuale completa, come esplicitato nel rapporto.
- Visual review PASS su102PNG production obbligatorie; altri PNG extra generati
  non attribuiti come tutti esaminati. Code review fallbackroot PASS dichiarato.
- Gate Fase6 PASS, zero cicli correttivi applicativi dopo consegna; solo rettifiche
  harness/cattura distinte. Ultimo cleanup esclusivo risorse assistive in chiusura.
- Tester conclude PASS tecnico finale e cleanup PASS: browser/Orca/bus privati e
  server4500/4501 terminati; rimossa soltanto directory temporanea propria residua,
  nessun mount/processo/preferenza utente alterato. Storico cleanup conservato.
- Tutti gate Fase6 conclusi. Log normalizzati a server fermi senza alterare esiti;
  commit di fase seguito da ultima build/unit richiesta e report conclusivo.

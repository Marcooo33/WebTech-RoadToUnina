# ROADTOUNINA — report finale redesign frontend

26 ottobre 2026. Branch `feat/frontend-redesign`, punto di partenza `6e09ba9`.
Roadmap Fasi 0–6 implementata e verificata; nessun push, merge o rebase.
Registro completo e storici: [redesign-progress.md](redesign-progress.md).
Verifica conclusiva dopo il commit di Fase 6: **PASS**.

## Fasi e commit

| Fase | Esito | Commit |
| --- | --- | --- |
| 0 — Baseline, perimetro e riferimenti | PASS | `ba799db` |
| 1 — Token e componenti condivisi | PASS | `e92fe41` |
| 2 — Home e autenticazione | PASS dopo 2 correzioni | `ea8cdcd` |
| 3 — Dashboard e configurazione | PASS | `a41fe1a` |
| 4 — Partita e articolo | PASS dopo 3 correzioni | `7910114` |
| 5 — Risultato, History, dettaglio e profilo | PASS | `2b3455a` |
| 6 — Residui e verifica trasversale | PASS | `2067dc8` |

Commit aggiuntivo `bd12101`: normalizzazione whitespace dei soli log Fase 5,
senza alterare gli esiti o riscrivere la cronologia. Il controllo staged iniziale
aveva segnalato questi spazi, ma il comando dell'orchestratore aveva proseguito:
l'errore e la correzione sono registrati nel checkpoint.

## Componenti e comportamento risultante

- Fondamenta e cornice: token/palette B, controlli/focus/disabled, Navbar,
  ErrorBanner e LoadingSpinner; contenitori specifici Home e gioco.
- Home/LandingPage e Login/Register: composizione B, percorso dimostrativo
  dichiarato e flussi guest reali; istruzioni, errori associati e focus invalidi.
- Dashboard/NewGame: percorsi prima delle statistiche, medie con ambito,
  configurazione compatta e singolo avviso di limite effettivo.
- GamePage/HUD/Path/WikipediaArticle: articolo dominante, HUD unico persistente,
  percorso nativo in dialogo, tipografia Wikipedia approvata, link nativi locali,
  tastiera e busy senza duplicazioni; infobox complete dopo introduzione.
- Result/History/Detail/Profile: metrica ufficiale dominante, risultato guest
  non salvato e azioni preservate, ranking compatto, tab accessibili, percorso
  completo, mosse leggibili e form con feedback coerente. Indici numerici integri.

Restano invariati backend/core, API/modelli, schema/dati, routing/guardie,
autenticazione/continuazione guest, timer/calcoli, regole e autorità del backend.
Nessuna dipendenza, font remoto, fixture o simulazione aggiunta al frontend.
Standalone/OnPush, signals/RxJS, CSS e Lucide conservati.

## Validazione ed evidenze

- Build production PASS; initial 328,61 kB. Solo warning Home CSS 6,42 kB oltre
  warning 4 kB e sotto error 8 kB; budget invariati.
- Test unitari finali: **101 PASS in 22 file**, dai 29 della baseline.
- Suite E2E finale: **22 PASS**; backend e PostgreSQL disposable con guardie
  localhost:55432/roadtounina_e2e, container/volume rimossi. Nessun database reale usato.
- Production browser: **220 record finali**, replay P: 172 record/124 PNG, rerun
  mirato: 30 record; quattro larghezze 1440/768/390/320 e partita 320×740, più 18 soglie.
- Zoom Chrome reale 200% con reflow, reduced motion, AX/nome/ruolo, tastiera,
  passaggi fra schermate, loading/error/empty/busy e conferme.
- Prova assistiva mirata Orca+AT-SPI effettiva in sessione privata: 6/6 evidenze,
  link/errore/dialogo/focus e output vocale generato. Audio disattivato.
- Visual reviewer finale: **102 PNG production effettivamente esaminate**, con
  confronto Home/gioco ai riferimenti B/after. Gli ulteriori screenshot di replay
  generati non vengono dichiarati tutti esaminati nel gate visuale finale.

[Rapporto tecnico Fase 6](redesign-evidence/phase-6/TEST-REPORT.md),
[review visuale](redesign-evidence/phase-6/visual-review.md),
[code review](redesign-evidence/phase-6/code-review.md),
[riferimenti approvati](design-reference/README.md).
Le pagine P sono state validate nei loro rendering e restano distinte dalle
approvazioni A/V del prototipo. Storici FAIL e correzioni sono conservati.

Le review delle fasi precedenti sono indipendenti dall'implementatore. In Fase 6
il subagent code reviewer era indisponibile per capacità: review svolta direttamente
dall'orchestratore e dichiarata. In Fase 4 il consolidamento documentale finale è
stato completato dall'orchestratore sui log/JSON del tester dopo la sua interruzione;
non si attribuiscono prove non eseguite ai subagent.

## Problemi risolti e decisioni rimaste aperte

Chiusi con prove: focus/contrasto condivisi, CTA Home, gerarchia Dashboard,
ambiti medie, limite duplicato, overflow del gioco, HUD/busy e feedback errore
persistenti, link Wikipedia da tastiera e attivazione unica, dialogo percorso,
TOC che apre infobox annidate, conservazione dati/link delle schede, focus libero
quando HUD cresce, tab History, errori password, percorso storico completo,
indici mosse e ritorno focus al resize/Escape con dialoghi nativi.

Non introdotte le proposte UX ancora aperte: Retry History, mostra password,
nuovo accesso New game dal risultato. Il tema non ne costituiva approvazione.
Nessun blocco funzionale, responsive o accessibilità noto rimasto nei gate eseguiti.

## Limiti e revisione manuale prima del merge

1. Confrontare Home e partita con l'archivio B/after, incluse 320×740 e lettura
   con tastiera, Path, infobox e feedback. Prove integrate soltanto su disposable.
2. Provare altri browser/dispositivi/font: disponibili qui solo Chromium;
   Firefox/WebKit non installati. Nessuna certificazione multipiattaforma.
3. Completare revisione assistiva manuale/uditiva: Orca automatizzato e AX sono
   prove mirate, non una certificazione completa di accessibilità.
4. Valutare il warning CSS Home noto prima del merge, senza aumentare budget
   per nasconderlo. Non sono rimasti altri rilievi non bloccanti di UI nei gate.

I materiali originali in/tmp sono stati persi fra riprese; riferimenti essenziali
B e immagini/JSON effettivi sono nel repository. Fase 4 conserva prove sul vero
articolo sanitizzato con 266 link; il campione finale production è nuovo, coerente
con DTO/grafo E2E e processato dal parser locale. Non si dichiara confronto pixel
sugli stessi dati. Harness durevoli e limiti di riproduzione sono documentati nei
rapporti; nessuna fixture è stata copiata negli asset dell'applicazione.


## Controllo conclusivo dopo i gate

Nuova build e 101 test unitari eseguiti dall'orchestratore dopo il commit
`2067dc8`: entrambi PASS. [Build finale](redesign-evidence/phase-6/final-build.txt),
[unit finali](redesign-evidence/phase-6/final-unit.txt). I 22 file del bundle
ricompilato coincidono tramite SHA-256 con il production verificato dal tester.
Home e partita riesaminate anche dal root a tutte le quattro larghezze, più lettura
320×740, senza ulteriori rilievi. E2E finali 22 PASS del gate sullo stesso codice.

Tutti i commit di fase sono presenti nel branch autorizzato. Diff complessivo
ricontrollato contro `6e09ba9`: nessun file backend/core/contratti/route/manifest/lock
modificato. Ultimo commit documentale: `docs: finalize frontend redesign report`.
Nessun push o merge. Il redesign è pronto per la revisione dell'utente prima del merge.

# Fase 6 — review visiva indipendente finale

26 ottobre 2026. Base `bd12101`, branch `feat/frontend-redesign`.
**PASS visuale sul campione finale production esaminato.** Nessun problema
visivo bloccante rilevato; S3 indici della Fase 5 chiuso. Nessuna modifica
applicativa o commit del visual reviewer. Il gate tecnico/assistivo rimane
separato e va letto nel rapporto del tester.

## Criteri e provenienza

Applicati AGENTS, guida frontend, taste skill e `DESIGN.md`. Home e gioco
confrontati con B approvato e typography-after archiviati; le altre schermate
verificate per coerenza con le proposte P validate nelle fasi precedenti.
Nessuna nuova azione UX richiesta o introdotta dalla review.

Riaperti realmente con `view_image` i 12 riferimenti `docs/design-reference/`:
`home-*`, `game-start-*`, `game-reading-*`, ciascuno a 1440/768/390/320.
Viste anche le sette `implementation-after` (indici a 768/390/320; menu, path,
modal, path-modal), utilizzate soltanto come contesto delle correzioni.

Il giudizio finale usa **102 PNG production realmente aperte con `view_image`**,
notificate stabili dal tester. Origine e bundle in [production-source.json](production-source.json),
metodo in [HARNESS.md](HARNESS.md): server statico localhost:4500, tutte API
intercettate e rete esterna bloccata. Il nuovo articolo complesso usa il parser
sanitizzante reale e dati dichiarati; non è il raw Golfo con 266 link della
Fase 4. Quelle prove reali restano conservate. Nessuna comparazione pixel su
input identici dichiarata.

## Immagini finali effettivamente esaminate

Gli asterischi della tabella indicano esattamente i suffissi elencati, senza
estendere la copertura ad altre PNG presenti nella directory.

| Gruppo | File aperti | PNG |
| --- | --- | ---: |
| Principali a 1440/768/390/320 | `home-*`, `login-*`, `register-*`, `dashboard-*`, `new-game-*`, `not-found-*`, `playing-*` nelle sole varianti base; in `phase5-production/`: `result-auth-time-*`, `history-*`, `detail-*`, `profile-*` nelle sole varianti base | 44 |
| Gioco a 1440/768/390/320 | `playing-reading-*`, `playing-infobox-toc-*`, `playing-busy-WIKIPEDIA_UNAVAILABLE-*`, `playing-error-WIKIPEDIA_UNAVAILABLE-*`, `playing-error-INTERNAL_ERROR-*` | 20 |
| Percorso compatto | `playing-path-{768,390,320}.png` | 3 |
| 320×740 | `playing-{start,reading,path,busy}-320x740.png` | 4 |
| Soglie Home | `breakpoint-home-{349,350,351,599,600,601,799,800,801}.png` | 9 |
| Soglie gioco/Navbar | `breakpoint-playing-{679,680,681,1119,1120,1121}.png`, `breakpoint-navigation-{999,1000,1001}.png` | 9 |
| Resize e indici | `menu-resize-{desktop,mobile}.png`, `path-after-resize-to-desktop.png`, `profile-modal-resize-first-Escape.png`, `path-modal-1040-first-Escape.png`, `move-indices-10-31-{768,390,320}.png` | 8 |
| Zoom browser 200% | `zoom200-{home,login,playing,history,profile}.png`, cinque catture finali del viewport | 5 |

## Riscontri e problemi chiusi

- **Home/B:** titolo, CTA Guest dominante, spiegazione del gioco e percorso
  Roma→Napoli→Federico II mantengono la gerarchia approvata. Percorso orizzontale
  desktop/verticale mobile, meta gialla e testi integri; nessuna regressione
  osservata alle quattro larghezze o sui nove punti attorno alle soglie.
- **Gioco/B after:** articolo bianco dominante, titoli serif e corpo sans,
  link blu sottolineati, misura di lettura e spazi coerenti. Navbar scorre via;
  HUD compatto resta in vista. Indice apre la scheda e ne mostra il titolo sotto
  l'HUD. Path e destinazione rimangono interi anche nel dialogo 320×740.
- **Busy/error/focus:** testo di caricamento e i due feedback di errore sono
  visibili nel pannello/HUD; l'ancora focalizzata resta leggibile sotto la sua
  crescita. Nessuna regressione dei due S2 chiusi in Fase 4 osservata nel nuovo
  campione. Nessun overflow della pagina osservato.
- **P:** auth, Dashboard, NewGame, Result, History, Detail, Profile e 404
  mantengono palette/tipo/azioni esistenti. Resume precede statistiche; radio e
  tab selezionati hanno segnali oltre al colore; risultati e arrivo sono
  riconoscibili, ranking mobile compatto e dati conservati.
- **S3 indici Fase 5 chiuso:** nelle tre `move-indices-10-31-*` viste, gli indici
  a due cifre sono interi. Tutte le 66 celle su una riga sono inoltre documentate
  in [checks-resize-final.json](checks-resize-final.json); scroll locale conservato.
- **Resize/focus chiuso:** Path desktop ha outline visibile sul summary;
  il marchio mobile riceve focus dopo Escape del menu ridimensionato. I due
  casi modal mostrano focus sul trigger Delete account/Path al primo Escape.
  `menu-resize-desktop.png` è il contesto prima di Escape; il ritorno a un link
  visibile è attestato dal record `menu-desktop-Escape`, non dedotto dalla PNG.
- **Zoom:** le cinque PNG finali 1440×900 sono complete e leggibili. Le prime
  quattro full-page erano tagliate a destra: problema di acquisizione segnalato
  dal reviewer, risolto ricatturando il viewport senza modificare l'app. Il tester
  documenta zoom reale 2 e viewport CSS 1440→720; non è simulazione tramite DPR.

**Problemi bloccanti: nessuno rilevato nel campione finale.** Nessun ulteriore
rilievo visivo concreto da richiedere come ciclo applicativo.

## Evidenze tecniche e limiti

Letti `checks.json` (212 record), `checks-resize-final.json` (30), i rispettivi
file failures/limits e il checkpoint [TEST-REPORT.md](TEST-REPORT.md).
Il primo giro conserva un'interruzione harness per lettura ARIA anticipata;
`failures-resize-final.json` è vuoto dopo l'attesa del render, senza app change.
I record con animazioni riportano liste vuote sotto reduced motion: verifica
strumentale del tester, non deducibile da immagini statiche.

Build, 101 unit e 22 E2E disposable sono prove separate del tester. Il replay
Fase 5 production ha 124 PNG/172 record: questa review ne ha riaperto il campione
base indicato, senza dichiarare di aver rivisto tutte le 124 immagini o ripetuto
personalmente i test. La copertura visiva completa dei relativi stati resta
nella review Fase 5, con i nuovi controlli tecnici production a supporto.

Zoom valutato nei cinque viewport catturati, senza attribuire copertura a tutta
la pagina ingrandita. Nessun test assistivo personale, browser Firefox/WebKit
non installati e nessun dispositivo fisico. L'AX tree Chromium non equivale a
una lettura screen reader; il tentativo Orca/AT-SPI del tester è separato e non
è dichiarato completato da questa review. Limiti residui da conservare nel
rapporto finale: nessuna dichiarazione di accessibilità universale o di audit
integralmente risolto.

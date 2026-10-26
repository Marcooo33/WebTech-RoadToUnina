# Fase 4 — verifica tecnica indipendente

Data: 26 ottobre 2026. Branch verificato: `feat/frontend-redesign`.
Base di confronto: `a41fe1a`. Nessuna modifica del tester al codice applicativo,
al backend, alle dipendenze o ai contratti API.

**PASS tecnico finale dopo correzione 3.** Build, 79 unit e 22 E2E sono stati
rieseguiti dal tester e i log finali sono ora persistenti. Matrice browser,
feedback e focus finali sono completi; la riconciliazione degli artefatti eseguita
dall'orchestratore passa. Code review e visual review indipendenti sono PASS.
Nessun blocco residuo; storico delle correzioni conservato sotto.

La stesura finale è stata completata dall'orchestratore perché il subagent tester
si è fermato per capacità del modello dopo l'esecuzione delle prove e prima del
consolidamento del rapporto. Non si attribuisce al subagent la scrittura di questa
integrazione; log e misure sono quelli effettivamente prodotti dal tester.

| Verifica finale eseguita | Risultato |
|---|---|
| `cd frontend && npm run build` | PASS; solo warning Home CSS 6.42 kB preesistente |
| `cd frontend && npm test -- --watch=false` | PASS, **79 test / 21 file** |
| `cd e2e && npm test` | PASS, **22 scenari**, 52.5 s |
| Sicurezza database | Runner ufficiale, solo disposable `localhost:55432/roadtounina_e2e`, guardie intatte; container e volume rimossi |
| `git diff --check` | PASS |
| Matrice browser principale | PASS, **130 record / 126 immagini** alle quattro larghezze |
| Prove aggiuntive mirate | PASS, **6 immagini**: infobox da tastiera alle quattro larghezze, start/path aggiuntivi a 320×740 |

**132 immagini finali** in questa cartella. Log: [build](build.txt), [unit](unit.txt),
[E2E completa](e2e.txt), [browser](checks.txt), [tastiera aggiuntiva](extra.txt),
[320×740](740.txt). Misure: [checks.json](checks.json), [keyboard-extra.json](keyboard-extra.json),
[viewport-320x740-extra.json](viewport-320x740-extra.json). Richieste intercettate:
[requests.json](requests.json).

## Responsive e leggibilità: misure indipendenti

| Viewport | Lettura utile | Titolo | Corpo | HUD in lettura | HUD busy |
|---|---|---|---|---|---|
| 1440×900 | 700 px | 36/45 px serif | 18/29.25 px sans | Sidebar a top 24 px | Sidebar con stato testuale |
| 768×900 | 704 px | 36/45 px serif | 18/29.25 px sans | 73 px, top 0 | 105 px, top 0 |
| 390×900 | 350 px | 32/40 px serif | 17/28.05 px sans | 107 px, top 0 | 139 px, top 0 |
| 320×900 | 288 px | 30/37.5 px serif | 17/28.05 px sans | 107 px, top 0 | 139 px, top 0 |

A **320×740** esaminabili quattro catture dedicate: `game-start-320x740-320`,
`game-reading-320x740-320`, `game-path-320x740-320`, `game-busy-320x740-320`.
Durante lettura restano 633 px verticali sotto HUD, 601 in busy. Il dialogo
rimane interamente dentro il viewport. Nessun overflow della pagina e nessuno
spostamento orizzontale in tutti i casi misurati, anche con titoli/numeri lunghi
e contenuto complesso. `body` ha overflow orizzontale **visible**, non hidden.
L'HUD è un singolo componente e la Navbar scorre fuori dalla lettura mobile.

## Scenari e comportamenti effettivamente verificati

- Start, lettura dopo scroll, percorso, busy, indice, infobox completa e focus
  collegamento a **1440/768/390/320**; screenshot viewport reali, non sola pagina lunga.
- Articolo completo sanitizzato **Golfo di Napoli** dell'audit: **266 link**
  conservati dopo gli adattamenti e tutti dotati di semantica nativa `href`.
  Apertura infobox conserva tutte le righe, media e ancore originali.
- Tab raggiunge un link giocabile; Enter produce una sola richiesta. Un secondo
  Enter durante busy non duplica la mossa. Alla risposta il nuovo titolo riceve
  focus; Backtrack effettivamente attivato ritorna al titolo precedente con focus.
- Prova aggiuntiva nella scheda aperta: Tab dal titolo interno raggiunge **Roma**,
  focus outline 3 px, collegamento sotto HUD; Enter genera esattamente una richiesta.
- Dialogo percorso: apertura, Escape e ritorno al comando Path; Tab/Shift+Tab
  non raggiungono elementi applicativi sottostanti. Prova esplicita di focus su
  un link Navbar durante la modale non riesce a focalizzare lo sfondo. Il dialogo
  nativo può passare momentaneamente focus a BODY/interfaccia browser, come
  previsto dal comportamento Chromium; nessun elemento dell'app dietro è attivo.
- CLICK/TIME × EASY/MEDIUM/HARD; MEDIUM con **3/2/0** backtrack residui e pulsante
  disabled a zero; HARD senza pulsante Backtrack; testi e valori lunghi conservati.
- Percorso lungo di trenta articoli, titolo completo Federico II, numeri lunghi;
  contenuto senza indice/infobox e contenuto complesso con due infobox, tabelle,
  preformattato, stringhe indivisibili e formula passata attraverso il parser.
- Initial loading, errore iniziale con Try again riuscito, errore di navigazione
  che conserva articolo e contesto, lettura guest alle quattro larghezze.
  **Rilievo successivo:** il messaggio è nel DOM ma sopra viewport durante lettura;
  la precedente attesa di visibilità CSS non verificava l’intersezione reale.
  Gate FAIL per questo stato, in attesa della correzione 2.
- E2E completa verifica separatamente creazione, navigazione, completamento,
  backtracking, pausa/ripresa, identità guest, salvataggio e recupero, autenticazione
  e operazioni profilo. Il nuovo scenario Enter verifica una sola mossa e focus
  del titolo usando il backend disposable, senza intercettazioni del gioco.

## Correzione 1 e verifiche ripetute

Il primo giro tecnico ha passato build e 68 unit. La suite completa ha rilevato
**20 PASS / 2 FAIL**, dovuti a matcher UI precedenti: New game corrispondeva anche
all'azione Start a new game; Profile cercava il precedente titolo Home. I matcher
sono stati aggiornati dall'implementatore e la suite finale passa tutti i 22 casi.
Log iniziali conservati con suffisso `-initial.txt`.

Il code reviewer ha riprodotto il difetto TOC verso un heading dentro infobox
chiusa. Dopo la correzione dell'implementatore, il tester ha verificato alle
**quattro larghezze** che la voce dell'indice apra la scheda, focalizzi il heading
visibile e lo posizioni sotto l'HUD. Immagini `toc-infobox-heading-*` e quattro
record dedicati in `checks.json`. Aggiunta prova Tab/Enter dentro la stessa scheda.
Build, unit, E2E completa e matrice browser finali ripetute dopo questa correzione.
Il set esplorativo che poteva attraversare aggiornamenti HMR non è usato come
prova finale: tutte le immagini correnti della matrice sono state rigenerate.

## Rilievo verificato per correzione 2 — feedback durante lettura

**S2, gate FAIL:** sia il notice `WIKIPEDIA_UNAVAILABLE` sia l'ErrorBanner
`INTERNAL_ERROR` sono inseriti prima del layout e rimangono fuori viewport quando
la mossa fallisce durante lettura. Riproduzione isolata: articolo reale, scroll
700 px, attivazione di un link già visibile nel viewport, risposta errore 503.
L'ancoraggio della pagina mantiene la lettura ma il feedback resta sopra.

| Larghezza | Notice top/bottom | Errore generico top/bottom | Intersezione sotto HUD |
|---|---|---|---|
| 1440 | −682 / −631 px | −682 / −631 px | 0 px |
| 768 | −683 / −632 px | −683 / −632 px | 0 px |
| 390 | −716 / −640 px | −691 / −640 px | 0 px |
| 320 | −715 / −639 px | −715 / −639 px | 0 px |

Otto casi su otto riprodotti; dati in [error-reading-initial.json](error-reading-initial.json),
log in [error-reading-initial.txt](error-reading-initial.txt), otto immagini iniziali
conservate sotto `error-before/`. Il visual reviewer ha confermato il difetto.
Nessun altro bug app rilevato nel giro; build, 69 unit ed E2E 22 restano esiti del codice
precedente alla correzione 2 e non autorizzano PASS dello stato in errore.
Nuova verifica dipendente dalla consegna dell'implementatore.

## Correzione 2 — feedback visibile, residuo S2 sul focus

Build indipendente PASS, **72 unit / 21 file PASS**, E2E completa **22 PASS**
(1.1 min), disposable rimosso. Matrice browser e prove precedenti rigenerate;
log distinti con suffisso `-cycle2.txt`. Dieci casi di errore ordinario alle quattro
larghezze e 320×740 passano: messaggio singolo dentro HUD, pienamente nel viewport,
contrasto notice 13.28:1/ErrorBanner 6.38:1, altezza misurata corretta e nessun overflow.

Il visual reviewer ha richiesto anche il caso limite con un link già focalizzato
a 18px sotto HUD base. Il tester ha riprodotto con Tab/focus e Enter, risposta 503:
l'HUD cresce mentre la posizione del link rimane dietro la barra. **8/8 casi
compatti FAIL**, i due casi desktop PASS. Nessun altro bug app rilevato.

| Viewport | Focus top dopo errore | HUD bottom | Stato |
|---|---|---|---|
| 768×900 | 90.8px | 147.8px | Coperto, entrambi i canali |
| 390×900 | 124.2/124.4px | 206.6/181.8px | Coperto, notice/error |
| 320×900 | 124.9px | 206.6px | Coperto, entrambi |
| 320×740 | 124.9px | 206.6px | Coperto, entrambi |

Dati in [error-edge-before.json](error-edge-before.json), dieci immagini prima
della correzione 3 in `focus-before/`, log [error-edge-before.txt](error-edge-before.txt).
Root e visual reviewer notificati. **Non assegnato PASS** in base alla sola
visibilità del messaggio; attesa della terza correzione e nuova verifica mirata.

## Provenienza dei campioni e limiti

- Rendering dall'app Angular **development** a `127.0.0.1:4400`; build production
  eseguita separatamente. Tutte le API di presentazione sono intercettate e le
  richieste esterne bloccate, senza contattare il backend reale.
- L'articolo audit è già sanitizzato. I due campioni complessi aggiuntivi sono
  stati elaborati dal vero helper `normalizeArticle` del repository, in sola
  lettura e senza database; nessuna fixture copiata nel frontend/repository.
- Il sanitizer non ammette MathML: la formula del campione è verificata nella
  forma testuale risultante dal parser. Un primo tentativo del solo harness con
  MathML grezzo era fuori contratto ed è stato scartato, non contato come bug app.
- Per verificare le proporzioni della prima immagine dell'infobox, la relativa
  richiesta Wikimedia è soddisfatta con il JPEG già locale
  `/tmp/roadtounina-ui-prototype/assets/golfo-di-napoli.jpg`; tutte le altre immagini
  esterne sono bloccate. Nessun asset aggiunto all'app. Le catture aggiuntive
  start/path 320×740 mostrano la scheda chiusa e non caricano immagini remote.
- I contatori di presentazione simulati non provano l'autorità temporale o la
  persistenza: questi aspetti sono verificati dalla suite E2E disposable separata.
- Nessuna verifica screen reader, dispositivo fisico o browser diverso in questo
  gate; zoom e matrice trasversale rimangono alla Fase 6.

Harness locali: `/tmp/roadtounina-phase4-checks.cjs`, `-extra.cjs`, `-740.cjs` e
fixture normalizzate soltanto in `/tmp`. Nessuna nuova dipendenza installata.


## Chiusura correzione 3 e riconciliazione dopo ripresa

- Tutti i dieci casi edge errore: focus articolo conservato e non coperto, feedback
  interamente visibile, annuncio unico, contrasto e nessun overflow PASS.
- `focus-growth-final.json`: dieci casi, identità durante crescita sempre preservata;
  sei casi coperti compensati, quattro esclusi senza scroll. Nessuno scroll aggiuntivo
  quando la barra diminuisce. Dopo navigazione riuscita il titolo nuovo prende il
  focus come previsto: non si richiede identità del vecchio nodo TOC sostituito.
- `checks.json`: 126 record layout senza overflow e quattro comportamenti TOC con
  infobox aperta. `error-reading-final.json` e `error-edge-final.json`: dieci casi ciascuno.
- SHA delle immagini riconciliati: 128 identiche al set precedente, quattro feedback
  navigation-error cambiati e 30 nuove immagini. Tutte le 162 impronte finali corrispondono.
- Esecuzione root di `python3 docs/redesign-evidence/phase-4/verify-evidence.py`: PASS.
  Questo script verifica gli artefatti conservati, non riesegue browser o test applicativi.
- Log finali build/unit/E2E rieseguiti dopo la ripresa e salvati direttamente qui;
  build PASS con solo warning Home noto, 79 unit PASS, 22 E2E PASS e disposable rimosso.
- Visual review indipendente finale: tutte le 30 aggiunte e quattro differenze
  riesaminate, focus libero anche nei casi compatti, nessun blocco residuo.

I file temporanei `/tmp` sono stati rimossi fra le riprese. Le prove browser erano
complete prima della rimozione e i relativi JSON/PNG sono integri: non sono stati
ricreati usando dati diversi né inventati esiti. Per una futura riproduzione usare
API intercettate, fixture del repository e contenuto processato dal sanitizer esistente;
la snapshot completa Golfo di Napoli dell'audit non è più disponibile in `/tmp`.
I riferimenti visivi essenziali B e after restano conservati in `docs/design-reference`.
Questa limitazione riguarda la riproduzione futura, non l'esame degli artefatti finali.

# Fase 4 — review visiva indipendente

26 ottobre 2026. Diff da `a41fe1a`; applicati `DESIGN.md` e la skill
`design-taste-frontend`, con precedenza a B e alla tipografia Wikipedia “after”.
Nessuna modifica applicativa o commit del reviewer.

## Esito finale: PASS — ciclo 3

**Composizione B e proposte P del gioco validate negli stati esaminati.
Nessun bloccante visivo residuo.** Il feedback della mossa fallita ora rimane
visibile nell'HUD; la crescita dell'HUD mantiene interi il controllo focalizzato
e il suo outline, senza cambiare identità del focus. Il PASS visivo è distinto
dai gate tecnico e di codice.

## Storico dei bloccanti e verifica conclusiva

| Ciclo / gravità | Evidenza e risultato |
| --- | --- |
| 1 — S2, corretto | `game-page.html` collocava notice/ErrorBanner prima del layout: assenti dal viewport durante lettura. Viste quattro `navigation-error-*` e otto diagnostiche recoverable/unexpected. `error-reading-initial.json` misura intersezione zero in 8/8 casi. Nel ciclo 2 il feedback è stato proiettato una sola volta dentro l'HUD misurato |
| 2 — S2, corretto | L'espansione copriva il link già focalizzato 18 px sotto il vecchio HUD. Viste dieci immagini di bordo: 8/8 casi compatti fallivano, desktop laterale passava. `error-edge-before.json` e `focus-before/` conservano il caso: a 320 focus top 124,9 contro HUD bottom 206,6 |
| 3 — PASS finale | Visti nuovamente tutti i dieci `error-edge-*`: link Monte di Procida e outline interamente sotto HUD a 768/390/320 e 320×740, per errore recuperabile e inatteso. `error-edge-final.json` conferma `focusCovered=false` in tutti gli otto casi compatti, annuncio unico e feedback interamente visibile nei dieci casi |
| Busy/focus — PASS | Viste le dieci `busy-focus-*`. Link vicino al bordo alle quattro dimensioni compatte, titolo e heading TOC a 390 restano interi. `focus-growth-final.json` conferma stesso elemento focalizzato in tutti i dieci casi; scroll solo dove necessario, nessun ulteriore scroll alla riduzione dell'HUD; zero compensazioni per già visibile, fuori viewport, comando HUD o dialogo |

File interessati dai rilievi: `game-page.html`, `game-hud.html/.css` per il
feedback; `game-page.ts:onHudHeightChanged` per la compensazione minima del focus.
Il difetto TOC verso heading in infobox chiusa, rilevato separatamente dal code
reviewer e corretto nel ciclo 1, è confermato risolto nelle quattro immagini
`toc-infobox-heading-*`: scheda aperta e titolo interno sotto HUD.

## Immagini realmente esaminate

Aperte con `view_image` tutte le **132 immagini stabili del primo set corretto**,
poi tutte le **30 aggiunte finali** e le **quattro immagini cambiate** del ciclo 3.
Ricalcolate direttamente le SHA-256 rispetto a
[visual-review-before-correction-2.sha256](visual-review-before-correction-2.sha256):
**128/132 identiche**, cambiate soltanto `navigation-error-{1440,768,390,320}.png`.
Il riscontro coincide con [screenshot-comparison.json](screenshot-comparison.json).

Ogni prefisso seguente è stato visto a **1440, 768, 390 e 320 px**, altezza 900:

| Gruppo | Prefissi `{prefisso}-{larghezza}.png` |
| --- | --- |
| B/interazioni | `game-start`, `game-reading`, `game-path`, `game-index`, `game-infobox`, `game-link-focus`, `game-busy`, `game-after-keyboard-navigation`, `game-after-backtrack` |
| Varianti P | `variant-click-easy`, `variant-click-medium`, `variant-click-hard`, `variant-time-easy`, `variant-time-medium`, `variant-time-hard`, `medium-left-3`, `medium-left-2`, `medium-left-0` |
| Contenuti P | `long-title`, `long-path`, `long-path-open`, `long-numbers`, `no-index-infobox`, `complex-content`, `complex-content-reading` |
| Stati P/regressione | `initial-loading`, `initial-error`, `initial-retry`, `navigation-error`, `guest-reading`, `toc-infobox-heading`, `infobox-keyboard-focus` |

Visti inoltre `game-{start,reading,path,busy}-320x740-320.png` a **320×740**.
Riaperti i **14 riferimenti B** archiviati: start/reading alle quattro larghezze,
path/busy/infobox/link-focus/index/long-title a 320. Per articolo e tipografia
prevale la serie “after”; busy/path precedenti servono solo alla composizione.

Aggiunte finali realmente viste: `error-{reading,edge}-{recoverable,unexpected}`
a 1440/768/390/320 e 320×740 (20 immagini);
`busy-focus-link-near` a 768/390/320 e 320×740;
`busy-focus-{title-near,toc-near,already-visible,offscreen,hud,dialog}-390` (10).
Visti anche i precedenti diagnostici durante i cicli FAIL, distinti dal set finale.

## Confronto e riscontri

| Criterio | Riscontro finale |
| --- | --- |
| Composizione B | Articolo bianco dominante; indice laterale e HUD/percorso a destra desktop. HUD compatto unico nelle altre larghezze; Navbar scorre via; meta gialla distinta dalle tappe e percorso in dialogo |
| Misure | `checks.json` conferma lettura 700/704/350/288 px; HUD compatto top 0, alto 73/107/107 e busy 105/139/139. A 320×740 restano 633 px di lettura, 601 busy. Il feedback errore aumenta l'altezza misurata senza coprire il focus |
| Tipografia | Titolo serif 36/36/32/30, h2 serif, corpo sans 18/18/17/17; proporzioni e lettura coerenti con “after”. Federico II intero su due righe mobile; numeri lunghi leggibili |
| Integrazione | Coerenti assenza di banner/controlli demo, Navbar e Leave game reali, indice completo e link reali sottolineati. L'articolo non viene ridotto all'estratto del prototipo |
| Infobox/contenuti P | Disclosure dopo introduzione; tabella originale completa, immagine e link conservati. A 320 scorrimento confinato nella regione con istruzione. Tabelle/preformattato larghi nei wrapper locali; nessun overflow pagina nel campione |
| Focus/azioni | Outline leggibili su link e nuovo titolo, focus Roma nella scheda. Busy testuale senza oscurare articolo. Modalità TIME evidenzia tempo, CLICK clic; MEDIUM distingue 3/2/0 con disabilitazione a zero; HARD senza Backtrack |
| Altri stati | Loading iniziale testuale, errore iniziale con Try again/Back to dashboard, recupero e guest leggibili. Percorsi lunghi in area scorrevole; nessuna collisione residua rilevata |

## Non bloccanti e limiti

Nessun altro difetto visivo rilevato nel perimetro concordato. La prima lettura
chiarisce articolo corrente, meta e metrica principale; la lettura resta centrale,
senza pannelli decorativi o progressi inventati.

Review di immagini e dati del tester: interazioni e suite non ripetute dal
reviewer. Rendering Angular **development** con API intercettate, distinto dalla
build production e dalle verifiche tecniche in [TEST-REPORT.md](TEST-REPORT.md).
La riconciliazione dei log tecnici dopo la ripresa appartiene al tester e non è
dedotta dalle immagini. Le risorse secondarie Wikimedia sono bloccate; la prima
foto Golfo è un JPEG locale del prototipo servito dal solo harness. Le icone
immagine mancanti non attestano regressioni app. I campioni stress passano dal
parser reale; MathML non ammesso rimane testo risultante. Fixture e contatori
non provano contenuti fra articoli diversi o timer ufficiale. Nessun PASS
dell'inspector autonomo; fallback Playwright dichiarato. Non verificati screen
reader, zoom 200%, altri browser/dispositivi, tutti i viewport intermedi o
rendering production.

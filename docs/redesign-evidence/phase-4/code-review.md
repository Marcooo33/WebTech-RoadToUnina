# Fase 4 — code review indipendente

Data: 26 ottobre 2026. Branch verificato: `feat/frontend-redesign`.
Diff da `a41fe1a`. Nessuna modifica applicativa o commit del reviewer.

## Esito finale: PASS dopo correzione 3

Il blocco P2 iniziale è risolto e ricontrollato in Chromium sull'Angular reale.
Nessun blocco residuo della code review. I gate del tester e della review visiva
restano separati; di seguito è conservato lo storico FAIL e il relativo riscontro.

## Storico: FAIL iniziale — problema P2 ora risolto

**P2 — voce dell'indice diretta a contenuto nascosto, senza focus né apertura.**
File: `frontend/src/app/features/game/wikipedia-article/wikipedia-article.ts:79`
(`onTocClick`), `:149` (`presentInfoboxes`), `:228` (`rebuildToc`).

`rebuildToc` include correttamente tutti i titoli h2–h6, anche nelle tabelle;
`presentInfoboxes` sposta quelle tabelle in un `details` inizialmente chiuso.
`onTocClick` impedisce la navigazione nativa, poi chiama focus/scroll sul titolo
senza aprire il disclosure antenato. Il collegamento appare nell'indice ma non
permette di vedere la sezione né trasferire il focus. Contraddice DESIGN §3.8
(indice completo e navigazione alle sezioni), con regressione sul contenuto
sanitizzato consentito dal parser esistente.

Riprodotto su Angular reale a `127.0.0.1:4400`, Chromium Playwright, viewport
390×900. Tutte le `/api/**` soddisfatte localmente con stato playing dell'audit
e identità di test; nessuna scrittura al backend. `contentHtml` usato:

```html
<table class="infobox"><tbody><tr><td>
  <h2 id="rtu-section-facts">Dati della scheda</h2>
  <a data-page-title="Roma">Roma</a>
</td></tr></tbody></table>
<p>Introduzione completa.</p>
<h2 id="rtu-section-body">Corpo</h2><p>Articolo.</p>
```

Azioni: aprire `Indice`, attivare `Dati della scheda`.
Osservato dopo il click: `details.wiki__facts.open === false`,
`document.activeElement !== heading`, focus rimasto sul link dell'indice,
`heading.checkVisibility({checkVisibilityCSS: true}) === false`.
Gli elementi e attributi del campione sono nella allowlist del parser backend;
non è richiesto nuovo HTML fiduciario per produrre questo caso.

Correzione richiesta: aprire i `details` antenati del titolo prima di focus e
scroll, mantenendo lo stesso DOM e il controllo locale della navigazione.
Aggiungere regressione sul titolo dentro infobox chiusa e verificare in browser
visibilità/focus sotto l'HUD. Non eliminare la voce dall'indice per aggirare il caso.

## Evidenze del resto del diff

| Controllo | File/righe | Riscontro |
| --- | --- | --- |
| Scope | Stato Git, diff e `git diff --check a41fe1a` | Scope autorizzato; whitespace PASS. Backend/core/auth/routing/config/dipendenze invariati; E2E navigation.spec e due matcher aggiornati in game-lifecycle/profile |
| Invarianti F | `game-page.ts:172`, `:195`, `:364`, `:384` | Metodi richieste/mosse/backtrack, doppia guardia busy, autorità del timer, pausa/uscita, selezione servizi guest e trustArticleHtml invariati; TS aggiunto circoscritto a presentazione/focus/dialogo |
| Trust boundary | `wikipedia-article.ts:130`, `:149`, `:192` | Nessun nuovo innerHTML o bypass fiduciario; DOM derivato dall'HTML già sanitizzato. Href aggiunti costanti locali; nuove etichette con textContent; tabelle originali spostate, senza clonazione o riassunto dei dati |
| HUD unico | `game-page.html:35`, `game-hud.ts:43`, `game-page.ts:152` | Un solo componente/stato HUD, misure effettive via ResizeObserver e cleanup, altezza nulla desktop e offset ereditato compatto; nessun secondo timer o stato di gioco |
| Link e busy | `wikipedia-article.ts:96`, `:126`, `:130`, `:221` | Semantica nativa href locale, Enter genera il click delegato unico; nessun keydown duplicato. Busy respinge emissione e GamePage respinge richieste concorrenti; aria-disabled/aria-busy e feedback HUD senza oscurare il testo |
| Focus titolo | `game-page.ts:397`, `wikipedia-article.ts:73` | Dopo nuovo pageId: misura HUD, focus sul titolo e scroll instant/inline nearest; CSS usa altezza dinamica più 20 px, focus 3 px e lingua it |
| Dialogo percorso | `game-page.html:72`, `game-page.ts:156` | Dialog nativo con showModal/close, nome, Close autofocus, contenuto percorso completo e meta separata; close, incluso Escape nativo, ripristina trigger. Trap affidato alla modalità nativa, non simulato |
| Infobox e tabelle | `wikipedia-article.ts:149`, `:192`, `:209` | Conservati nodi originali/link/media/attributi e tabelle annidate; disclosure dopo introduzione, wrapper scorrimento locale con hint/tabindex condizionali. Preparazione solo quando cambia html, senza duplicazione al solo busy |
| Tipografia e scope CSS | `wikipedia-article.css:5`, `styles.css:396`, `app.css:26` | Corpo sans 18/17, titolo serif 36/32/30, h2 serif 24; selettori globali circoscritti all'articolo. Rimosso body overflow:hidden; frame limitato al playing; percorso condiviso conserva input/ordine/ripetizioni |
| Regressioni | Spec GamePage/HUD/Path/WikipediaArticle, `e2e/tests/navigation.spec.ts:36` | Coperti flussi presentazionali, contenuto completo/nested, TOC, busy, focus titolo, pausa e Enter singolo; correzione 1 aggiunge il caso del titolo in infobox con disclosure annidati |

## Correzione 1 — ricontrollo finale PASS

Ricontrollato il solo delta finale. `onTocClick` a riga 84 apre tutti gli antenati
`HTMLDetailsElement` interni al body prima di aggiornare regioni, focus e scroll.
Lo spec a riga 141 verifica titolo h3 in infobox chiusa, ulteriore disclosure
annidato, focus e identità dei nodi/link. Nessun nuovo trust HTML o variazione F.
I due matcher E2E diventano `New game` exact e il titolo Home B; le asserzioni
di creazione/logout/profilo e le guardie DB restano intatte. Branch e whitespace
ricontrollati, nessuna modifica app o commit del reviewer.

Ripetuta la riproduzione sull'app con API intercettate a 390/1440 px e a 320 px
con un ulteriore details annidato: **3/3 PASS**. Infobox e tutti i disclosure
aperti, heading visibile e focalizzato; identici nodi titolo/link/tabella.
Titolo sotto l'HUD alle larghezze mobili e scrollWidth pari al viewport.
Dati misurati: [code-review-toc-recheck.json](code-review-toc-recheck.json).
Il FAIL storico è quindi chiuso. Build/unit/intera E2E e matrice finale sono
in esecuzione separatamente dal tester: non ne viene anticipato l'esito.

## Correzione 2 — review statica del feedback persistente PASS

Delta mirato verificato su GamePage HTML/spec e GameHud HTML/CSS. Nessun nuovo
cambio TS applicativo, timer, richieste, pausa, routing o trust boundary.
`game-page.html:2` rende feedback globale soltanto fuori da playing; il ramo
playing a riga 45 proietta gli stessi ErrorBanner/notice una sola volta nel HUD.
Restano `role=alert` di ErrorBanner e `role=status` della notice, senza nuovi
live region o copia responsive. Non cambiano testi, condizioni di errore né
azioni di recupero; il busy ha ancora il proprio unico messaggio.

`game-hud.html:66` ha un solo punto di proiezione. `.hud__feedback` a riga 4 del
CSS usa `flow-root` per contenere i margini verticali e `grid-column: 1 / -1` nel
compatto: il feedback contribuisce così all'altezza dello stesso host già
osservato dal ResizeObserver, senza un offset fisso o una seconda misura.
Il contenuto proiettato mantiene gli stili di GamePage/ErrorBanner.

I tre nuovi casi `game-page.spec.ts:158`, `:174`, `:188` controllano notice
recuperabile, errore inatteso e ramo non-playing: cardinalità, posizione nel
HUD, ruoli, articolo/busy conservati e recupero originale. `git diff --check
a41fe1a` passa. Nessun blocco statico residuo; visibilità dopo scroll e misura
effettiva con messaggio restano verifiche indipendenti del tester e reviewer
visivo, senza attribuire qui il loro esito. Nessuna modifica app o commit.

## Correzione 3 — review statica del focus dopo crescita HUD PASS

Ricontrollato il delta finale limitato a `game-page.ts` e relativo spec.
`onHudHeightChanged` a riga 153 conserva l'offset CSS aggiornato e confronta
l'altezza precedente, senza introdurre stato di gioco. Compensa soltanto una
crescita quando il focus è dentro WikipediaArticle, era nella parte visibile
del viewport ed è ora coperto dalla barra o dal suo margine per il focus ring.
Legge geometria, outline/offset e nuovo scroll-margin effettivi; usa scrollBy
istantaneo sul solo asse verticale, conservando elemento focalizzato e lettura
quando il controllo è già libero. Non sposta focus HUD/dialogo, target fuori
viewport, né reagisce a diminuzione/altezza uguale. Nessuna richiesta, modifica
timer/pausa/guest, nuovo trust HTML o handler di attivazione.

I sette casi aggiunti da `game-page.spec.ts:97` coprono link, titolo articolo,
titolo di sezione e voce TOC coperti; target libero/fuori viewport e focus nel
HUD/dialogo. Verificano entità dello scroll e identità del focus. Branch corretto
e `git diff --check a41fe1a` PASS. Nessun blocco statico residuo rilevato.
Il tester sta verificando gli scenari reali di errore/busy e focus ai bordi:
geometria browser, 79 unit, E2E e matrice restano esiti indipendenti, non anticipati
da questa review. Nessuna modifica applicativa o commit del reviewer.

## Osservazioni non bloccanti e limiti

- Il focus di ritorno al trigger Path nascosto dopo un resize a desktop resta
  un caso limite da considerare nella verifica intermedia, come per la Navbar.
- La misura dello scorrimento locale dipende da ResizeObserver e toggle;
  comportamento con caricamento delle immagini e contenuti complessi deve essere
  verificato sulle catture e nel browser dal tester.
- Non rieseguiti build/unit/E2E né matrice completa dal reviewer; tester
  indipendente attivo. Le prove browser mirate svolte qui riguardano il difetto
  TOC e il suo ricontrollo. Non attribuiti PASS alla matrice o all'approvazione visiva A/V/P.
  Non provati screen reader, altri browser o dispositivi fisici.
- Le modifiche presentazionali del Path condiviso richiedono le sentinelle
  History già previste; questa review non anticipa l'implementazione della Fase 5.

# Fase 0 — review visiva indipendente

Data: 26 ottobre 2026. Perimetro: archivio del riferimento approvato e baseline
Angular, prima di qualsiasi trasferimento del redesign. Il reviewer non ha
modificato codice applicativo e non ha creato commit.

## Esito

**PASS per il gate visivo della Fase 0.** I riferimenti essenziali sono integri,
la baseline esiste realmente ed è stata esaminata tramite `view_image`, e i
difetti preesistenti sono riconoscibili e documentati. **Nessun bloccante della
Fase 0 rilevato.** Questo esito non approva l'aspetto attuale come risultato del
redesign e non attribuisce un PASS all'inspector autonomo della skill.

La direzione **B — Atlante dei collegamenti**, con l'ultima tipografia Wikipedia,
prevale sulle preferenze generiche della skill. Nessun nuovo sorteggio di
direzione o cambiamento del prototipo. Le pagine operative restano proposte P;
la loro baseline non rappresenta un'approvazione del futuro tema.

## Metodo e integrità

Letti `AGENTS.md`, `frontend/AGENTS.md`, `DESIGN.md`, la skill
`design-taste-frontend`, le sue regole per app screen e il rubric di critica;
consultati l'inventario di fase, il rapporto tecnico, le misure DOM e i log del
fallimento dell'inspector. Si applica il percorso di review della skill:
registrare e criticare il prima, senza correggerlo in questa fase documentale.

- Viste **30 immagini Angular** e **tutte le 18 immagini archiviate del
  riferimento**, non solo nomi o miniature. L'elenco seguente è il campione
  effettivamente aperto, non una dichiarazione di visione di tutte le 89 catture.
- `sha256sum -c SHA256SUMS`, eseguito dentro `docs/design-reference/`: **19/19
  OK**, comprese le 18 immagini e il CSS.
- Confrontati inoltre gli SHA-256 con i file originali in
  `/tmp/roadtounina-ui-prototype/`: tutte le copie corrispondono. Home proviene da
  `screenshots/final/`; start/reading e casi tipografici da
  `typography-review/after/`; busy/path da `screenshots/final/`; CSS da
  `styles.css` attuale. La provenienza descritta nel README è corretta.
- `measurements.json` contiene 89 record alle quattro larghezze. I dati registrati
  sono coerenti con i difetti visibili nelle catture esaminate.

## Immagini realmente viste

I percorsi della prima tabella sono relativi a questa directory. Le catture
ordinarie sono full-page; start/reading/busy del gioco sono catture del viewport.

| Area | File aperti con `view_image` | Riscontro |
| --- | --- | --- |
| Home | `home-1440.png`, `home-768.png`, `home-390.png`, `home-320.png` | Vecchia palette e composizione reali; CTA equivalenti e wrapping mobile documentati |
| Partita, inizio | `game-start-1440.png`, `game-start-768.png`, `game-start-390.png`, `game-start-320.png` | Tre aree desktop; grandi pannelli prima dell'articolo nelle altre larghezze |
| Partita, lettura | `game-reading-1440.png`, `game-reading-768.png`, `game-reading-390.png`, `game-reading-320.png` | HUD desktop visibile, HUD tablet/mobile assente; scorrimento orizzontale del contenuto mobile |
| Partita, altezza ridotta | `game-320x740-320.png` | Inquadratura a scroll 400; HUD quasi completamente fuori vista, infobox dominante |
| Partita, stati | `game-busy-320.png`, `game-error-390.png` | Articolo attenuato in busy; errore iniziale e azioni reali visibili |
| Auth | `login-390.png`, `register-validation-320.png` | Form, label e validazione reale rappresentati |
| Dashboard | `dashboard-1440.png`, `dashboard-confirm-320.png`, `dashboard-empty-390.png` | Dati pieni, conferma inline Delete, dati vuoti e statistiche |
| Configurazione | `new-game-390.png`, `new-game-limit-320.png` | Radio/default e variante TIME/MEDIUM; duplicazione e frammentazione del limite visibili |
| Risultato | `result-320.png` | Esito autenticato, metriche e azioni correnti visibili |
| Classifica | `history-1440.png`, `history-empty-390.png`, `history-error-320.png` | Dati, filtri, zero ed errore distinti |
| Dettaglio | `history-detail-320.png`, `history-detail-moves-390.png` | Percorso con arrivo fuori vista; mosse aperte e titoli lunghi conservati |
| Profilo | `profile-390.png`, `profile-dialog-320.png` | Form distinti e conferma distruttiva; screenshot full-page del dialogo non usato per inferire un difetto del backdrop |

Tutte le seguenti immagini in `../../design-reference/` sono state aperte:

| Riferimento | File | Riscontro |
| --- | --- | --- |
| Home B | `home-1440.png`, `home-768.png`, `home-390.png`, `home-320.png` | Titolo sans, CTA guest dominante, percorso orizzontale/verticale e meta gialla |
| Tipografia after, inizio | `game-start-1440.png`, `game-start-768.png`, `game-start-390.png`, `game-start-320.png` | Titolo serif regolare e corpo sans; introduzione prima della scheda |
| Tipografia after, lettura | `game-reading-1440.png`, `game-reading-768.png`, `game-reading-390.png`, `game-reading-320.png` | h2 serif, corpo sans, HUD presente durante la lettura alle quattro larghezze |
| Casi after 320 | `game-long-title-320.png`, `game-link-focus-320.png`, `game-infobox-320.png`, `game-index-320.png` | Titolo lungo intero, focus riconoscibile, scheda e indice aperti |
| Composizione 320 | `game-path-320.png`, `game-busy-320.png` | Dialogo e attesa nell'HUD; il corpo Georgia di queste due catture è superato dalla serie after |

## Criticità preesistenti, non bloccanti per la raccolta baseline

Sono problemi da risolvere nei gate di implementazione indicati, non regressioni
introdotte dalla Fase 0.

| Priorità futura | Evidenza | Problema e conseguenza | Gate previsto |
| --- | --- | --- | --- |
| Bloccante per il gioco trasferito | `game-reading-768/390/320.png`, `game-320x740-320.png` | Destinazione, metriche e Backtrack escono dalla lettura; a 320×740 l'HUD misurato ha top −274 px | Fase 4: HUD persistente e spazio effettivo sotto la barra |
| Bloccante per il gioco trasferito | `game-start-390/320.png`, `game-reading-390/320.png` | Bordi tagliati e testo sul bordo; misure 401/390 e 338/320 px. Lo scroll produce anche scrollX 11/16 px | Fase 4: contenitori senza overflow pagina e senza occultarlo |
| Bloccante per accessibilità del gioco | `measurements.json`, campione articolo | 266 link giocabili, 0 con `href` o `tabindex`; è evidenza DOM, non una prova completa di tastiera svolta dal reviewer | Fase 4: semantica, attivazione singola e busy |
| Alta | `game-start-320.png`, `history-detail-320.png` | Il badge comprime “Golfo di Napoli” fino a spezzare “Napoli”; il percorso storico mostra solo l'inizio e nasconde l'arrivo | Fasi 4–5: percorso live a richiesta, storico completo |
| Alta | `game-start-390/320.png`, `game-busy-320.png` | Infobox estesa prima dell'introduzione; busy attenua il testo e l'attesa non rimane nell'area visibile | Fase 4: introduzione prima e contenuti completi, attesa persistente |
| Alta | `new-game-limit-320.png` | Due avvisi sul limite; il secondo divide una frase in tre colonne strette | Fase 3: messaggio unico in flusso testuale |
| Media | `home-390/320.png` | Due CTA piene competono; “Create an account” su tre righe e titolo Home su tre righe a 320 | Fase 2: composizione B e guest dominante |
| Media | `dashboard-1440.png`, `dashboard-confirm-320.png` | Le statistiche precedono Resume, conteggio duplicato; su mobile la ripresa scende molto | Fase 3: gerarchia operativa P |
| Media | `history-1440.png`, `history-detail-moves-390.png` | Numeri non allineati a destra; tabella mobile molto alta con destinazione lunga | Fase 5: leggibilità dati e contenuto completo |
| Da confermare sul rendering futuro | `skill-probe.json` | “Clicks” rilevato a 4,4:1 contro 4,5 richiesto; corpo articolo Georgia 16,2/15,5 px della baseline, diverso dall'after approvato | Fasi 1/4: contrasto e tipografia effettiva |

## Critica del prima

ROUND 0 — baseline, nessuna correzione applicativa in questa fase.

Seen in one second: titolo serif Home e pannello navy; nel gioco mobile pannelli
di stato prima dell'articolo.

Idea (one sentence): raggiungere Federico II attraverso collegamenti Wikipedia;
il percorso è riconoscibile ma ancora poco affidabile come gerarchia mobile.

Live thing: ingresso guest e gioco reali; questa review statica non ne riprova
interazioni, persistenza o timer.

Layout words by section: Home hero=split / percorso=sidebar / regole=tre colonne;
telefono=stack. Gioco desktop=tre aree / telefono=pannelli e articolo in sequenza.

Scores: design 6 · usability 5 · creativity 6 · content 8 → overall **5,8**.

Caps applied: la leggibilità mobile tagliata limita usability a 5; Home con
titolo su tre righe a 320 e shadow/rules della baseline limita la valutazione
pagina a 6,5. I requisiti generici di quattro fotografie e motion non vengono
usati per sovrascrivere B né applicati agli app screen. Sono punteggi del prima,
non del prototipo o del gate documentale.

Top three problems (most visible first), each with screenshot and future fix:

1. `game-reading-320.png`: lettura senza stato/azioni; trasferire l'HUD B
   persistente e verificare anche busy e 320×740.
2. `game-start-320.png`: colonna oltre il viewport e titolo del percorso
   spezzato; correggere cornice e consultazione del percorso in Fase 4.
3. `new-game-limit-320.png`: errore ripetuto e frase frammentata; deduplicare il
   messaggio con regressione sullo stato in Fase 3.

## Limiti e accettazione delle fasi successive

- Il reviewer ha ispezionato immagini e dati prodotti dal tester, non eseguito
  una nuova sessione interattiva o rigenerato le catture. La provenienza Angular
  e l'isolamento API sono documentati in `TEST-REPORT.md`; le immagini non sono
  screenshot del prototipo presentati come app.
- L'inspector autonomo della skill termina prima di aprire Chrome; consultati
  entrambi i log. Le misure alternative del probe e le catture Playwright sono
  utili alla baseline, **non un PASS dell'inspector**. Il limite rimane esplicito
  e va riesaminato nei gate di rendering successivi.
- Le immagini remote Wikipedia sono bloccate: gli spazi e le icone di immagine
  mancante non provano un difetto nuovo del frontend né validano le immagini
  reali. Il riferimento after verifica solo un estratto e una scheda sintetica.
- Campione non esaustivo dei 89 screenshot: non svolti screen reader, zoom 200%,
  focus/Tab/Escape interattivi, altri browser/dispositivi, guest non salvato,
  varianti lunghe TIME/HARD, tutte le infobox reali e viewport intermedi.
- La baseline è sufficiente per il perimetro Fase 0; gli stati mancanti devono
  essere acquisiti quando diventano pertinenti. Nessun difetto elencato è
  dichiarato risolto. Il futuro PASS del redesign richiede confronto sulle stesse
  fixture, prove comportamentali e approvazione esplicita delle estensioni P.

# ROADTOUNINA — Atlante dei collegamenti

Direzione visiva **B approvata**, inclusa la rifinitura tipografica Wikipedia.
Formalizzazione del 26 ottobre 2026. Questo documento guida il futuro trasferimento
nel frontend Angular: **non attesta che il redesign sia già implementato**.

## 0. Stato delle decisioni e riferimenti

Le indicazioni usano tre stati:

- **A/V — approvato e verificato nel prototipo:** riferimento visivo da preservare;
  la verifica riguarda Chromium e i dati campione, non l'applicazione integrata.
- **P — proposta da validare:** estensione coerente a schermate, stati o contenuti
  non prototipati. Non equivale a un'approvazione visiva già ottenuta.
- **F — vincolo funzionale:** comportamento dell'applicazione da conservare.

L'approvazione riguarda Home e partita del prototipo attuale, con gli articoli
aggiornati all'ultima tipografia. Le altre schermate richiedono confronto visivo
durante l'implementazione. I nomi dei token riportati sotto sono una proposta di
integrazione nei token esistenti: **un valore verificato non implica che quel
token esista già nel frontend**.

Ordine di precedenza:

1. Vincoli funzionali e approvazione esplicita dell'utente.
2. Prototipo B attuale, compreso il blocco finale di rifinitura tipografica del CSS.
3. Questo documento per regole, valori e distinzione delle proposte.
4. Esplorazione iniziale e audit come contesto e backlog.

In particolare, Georgia per tutto il corpo enciclopedico e le dimensioni iniziali
del titolo nell'esplorazione sono superate dalla rifinitura approvata. La richiesta
di redesign supera la conservazione della vecchia palette crema/navy indicata in
`frontend/AGENTS.md`; restano validi gli altri vincoli delle guide. Non occorre
modificare `AGENTS.md` per eseguire questo piano.

### Materiali di riferimento

- [Guida repository](AGENTS.md) e [guida frontend](frontend/AGENTS.md).
- [Esplorazione delle direzioni](/tmp/roadtounina-ui-exploration/VISUAL-DIRECTIONS.md).
- [Audit e backlog numerato](/tmp/roadtounina-ui-audit/REPORT.md).
- Prototipo: `/tmp/roadtounina-ui-prototype/`, in particolare `index.html`,
  `game.html` e `styles.css`.
- [Revisione del prototipo](/tmp/roadtounina-ui-prototype/PROTOTYPE-REVIEW.md) e
  [revisione tipografica](/tmp/roadtounina-ui-prototype/typography-review/TYPOGRAPHY-REVIEW.md).
- [Home e stati della prima proposta B](/tmp/roadtounina-ui-prototype/SCREENSHOTS.md).
- [Confronti tipografici più recenti](/tmp/roadtounina-ui-prototype/typography-review/SCREENSHOTS.md):
  per l'articolo fanno fede `typography-review/after/` e la metà destra dei confronti;
  le immagini precedenti restano valide per HUD e composizione.

Questi percorsi `/tmp` sono evidenze locali temporanee, non risorse dell'applicazione
o dipendenze di build. I valori essenziali sono riportati qui perché il documento
rimanga utilizzabile anche senza il server del prototipo. Alla futura revisione
Angular allegare screenshot dei componenti effettivamente implementati.

## 1. Identità del prodotto

**ROADTOUNINA è un gioco di navigazione enciclopedica: si parte da un articolo
Wikipedia italiano e si raggiunge l'Università degli Studi di Napoli Federico II
seguendo i collegamenti consentiti.**

Il percorso fra articoli è il principale elemento distintivo. Rappresenta tappe
reali della navigazione, non una mappa geografica o una decorazione di sfondo.
La personalità è esplorativa, precisa e accessibile: un gioco riconoscibile anche
quando l'articolo occupa quasi tutto lo schermo.

Regole della direzione approvata:

- Il cobalto identifica collegamenti, azioni e tappa corrente; il giallo identifica
  la destinazione Federico II. L'arrivo ha anche nome e simbolo riconoscibili.
- Partenza, tappe visitate e articolo corrente devono essere distinguibili anche
  senza colore. Una destinazione non ancora raggiunta resta separata dalle tappe.
- Niente nodi futuri inventati, percentuali di avvicinamento o barre di distanza:
  il numero di clic non misura la distanza residua.
- Il testo enciclopedico è lo spazio principale della partita. La Home può avere
  più forza compositiva; durante la lettura gli strumenti rimangono compatti.
- Il contesto universitario deriva dal nome completo dell'ateneo e dalla meta;
  non inventare stemmi, certificazioni o un'affiliazione istituzionale.
- Usare superfici, tipografia e allineamenti per la gerarchia. Evitare dashboard
  SaaS generiche, card annidate senza funzione, glassmorphism, gradienti decorativi
  e animazioni che competano con testo o timer.

## 2. Design token

### 2.1 Palette e ruoli

| Ruolo | Valore | Integrazione proposta | Stato |
|---|---|---|---|
| Sfondo applicativo | `#F3F6FC` | `--color-canvas` | A/V |
| Superficie e foglio dell'articolo | `#FFFFFF` | `--color-surface` | A/V |
| Testo principale | `#192842` | `--color-text` | A/V |
| Azione, link e percorso attivo | `#1D4ED8` | `--color-brand`, `--color-accent` | A/V |
| Hover dell'azione primaria | `#153DA9` | `--color-brand-hover`, `--color-accent-hover` | A/V |
| Destinazione | `#F1DC68` | `--color-target` | A/V |
| Testo secondario | `#53617A` | `--color-muted` | A/V |
| Testo dei paragrafi enciclopedici | `#243148` | `--color-article-text` | A/V |
| Separatore leggero | `#D5DFEF` | `--color-border` | A/V |
| Bordo di controllo | `#7B8CA6` | `--color-border-strong` | A/V |
| Superficie disabilitata | `#EDF1F7` | `--color-disabled-bg` | A/V |
| Fondo hover del link nell'articolo | `#EEF3FF` | ruolo locale / `--color-accent-soft` | A/V |
| Linea del percorso e anello loader | `#B6C9F7` | ruolo locale del componente | A/V |

Il bianco prevale nell'articolo; lo sfondo freddo organizza le pagine applicative.
Il giallo non è il colore generico di selezione, avviso o successo. Non applicarlo
a tutti i badge, a tutte le card o alle metriche. Le superfici selezionate usano
testo leggibile, bordo e indicatore nativo oltre al colore.

I rapporti già calcolati nel prototipo sono: testo/bianco **14,75:1**,
secondario/bianco **6,25:1**, secondario/sfondo **5,78:1**, cobalto/bianco
**6,70:1**, testo/giallo **10,66:1**, testo articolo/bianco **13,06:1**,
bordo controllo/bianco **3,42:1**. Sono misure di coppie cromatiche, non una
certificazione di tutte le combinazioni future o degli stati Angular.

### 2.2 Colori semantici

Errore, successo e avviso non sono stati prototipati come sistema completo.
La seguente base riutilizza i token già presenti nel frontend: **P**, da verificare
insieme alla nuova palette e ai componenti renderizzati.

| Significato | Testo / fondo / bordo proposti | Convenzione |
|---|---|---|
| Errore e azione distruttiva | `#A12B2B` / `#FCEDED` / `#E9B9B9` | Messaggio e nome dell'azione, non solo rosso |
| Successo | `#27643B` / `#EDF7F0` / `#BDD9C5` | Conferma testuale; non sostituisce il giallo della meta |
| Avviso | `#855B12` / `#FFF7DF` / `#EAD49D` | Spiegazione e recupero, senza confondersi con Federico II |
| Informazione | `#192842` / `#EEF3FF` / `#D5DFEF` | Messaggio neutro; cobalto solo dove serve enfasi |

Riutilizzare `--color-success*`, `--color-warning*`, `--color-danger-*` e i
componenti condivisi esistenti. Verificare il contrasto del testo, delle icone
informative e dei bordi necessari; un separatore decorativo non sostituisce il
bordo riconoscibile di un campo.

### 2.3 Famiglie tipografiche

**A/V — interfaccia applicativa**, inclusi marchio, Home, Navbar, HUD, percorso,
pulsanti, form, badge, metriche, indice e scheda sintetica:

```text
system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
```

**A/V — titolo dell'articolo e sezioni principali h2**:

```text
"Linux Libertine", "Libertinus Serif", Georgia, Times, "Times New Roman", serif
```

**A/V — corpo enciclopedico**: `sans-serif` su desktop/tablet; fino a 600 px:

```text
-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif
```

I titoli enciclopedici hanno peso 400 e spaziatura normale. La regola del prototipo
per h3–h6 è sans-serif in grassetto; il rendering dei livelli inferiori va ancora
validato su articoli completi. Non assegnare serif a tutto il contenuto Wikipedia
né ai titoli delle pagine applicative.

Non servono font scaricati. Nel Chromium usato per la verifica, Linux Libertine
e Libertinus non erano installati: i titoli erano resi con Liberation Serif e il
corpo con Liberation Sans; i controlli usavano il font di sistema. Questi sono
fallback osservati, non nuovi font da distribuire. La verifica su altri sistemi
deve accettare i fallback previsti, controllando nuovamente gli a capo.

Timer e statistiche usano `font-variant-numeric: tabular-nums`. Non trasformare
il timer in un carattere monospace decorativo.

### 2.4 Scala tipografica

Valori CSS in px come riferimento a dimensione base standard; nell'implementazione
usare unità relative dove opportuno senza impedire ingrandimento o ridimensionamento.
La notazione dimensione/interlinea indica due misure, non un rapporto di scala.

| Ruolo | Dimensione e trattamento | Stato |
|---|---|---|
| Titolo Home | `clamp(40px, 5.3vw, 76px)`, peso 750, interlinea 1,03; regole responsive sotto | A/V |
| Titolo Home fino a 800 px | `clamp(38px, 6vw, 52px)` | A/V |
| Titolo Home fino a 600 px | `clamp(36px, 9.7vw, 48px)`; fino a 350 px: 36 px | A/V |
| Titolo di pagina operativa | 28–32 px, peso 650–750, interlinea 1,2–1,3 | P |
| Titolo articolo a 1440/768 | 36 / 45 px, serif regolare | A/V |
| Titolo articolo a 390 | 32 / 40 px | A/V |
| Titolo articolo a 320 | 30 / 37,5 px | A/V |
| Sezione enciclopedica h2 | 24 / 33 px | A/V |
| Sottosezioni h3–h6 | Sans, peso 700 nel CSS di riferimento; scala proposta 18–20 px per h3, 17–18 per livelli inferiori | P verifica visiva e dimensioni |
| Corpo articolo desktop/tablet | 18 px, interlinea 1,625 = 29,25 px | A/V |
| Corpo articolo mobile, fino a 600 px | 17 px, interlinea 1,65 = 28,05 px | A/V |
| Testo applicativo normale | 16 px, interlinea 1,55; istruzioni più ampie solo dove utili | A/V base; P estensione |
| Label e metadati | 12–14 px; 11 px solo in didascalie secondarie già presenti nel prototipo | A/V campione; P nuovi usi |
| Metrica principale HUD | 42 px desktop; 25 px tablet; 24 px mobile | A/V CLICK |
| Metrica secondaria HUD | 23 px desktop; 20 px tablet; 19 px mobile | A/V CLICK |
| Indice / infobox sintetica | Indice 13 px; scheda 14 px, label interne 12 px | A/V |
| Metrica principale del risultato | 40–56 px, sans tabulare | P |

Non ridurre un titolo per far posto a un badge. Gli a capo avvengono fra parole;
`overflow-wrap: break-word` è un ripiego per stringhe indivisibili, non un invito
a usare `word-break: break-all`. Il titolo lungo dell'università a 320 px occupa
due righe nel fallback verificato: è un riferimento, non un limite di righe fisso.

### 2.5 Spaziature e contenitori

Conservare la scala già disponibile nel frontend: `--space-1…8` corrispondono a
**4, 8, 12, 16, 24, 32, 40, 48 px** alla base standard. La riadozione dei nomi è
**P**; i valori 8/12/16/24/32/48 ricorrono nel prototipo. Non cambiare implicitamente
il significato di `--space-5` da 24 a 20 px.

Misure contestuali **A/V**, da mantenere dove definiscono la composizione approvata:

| Contesto | Misura |
|---|---|
| Home e sua testata | Massimo esterno 1264 px, padding laterale desktop 32 px: 1200 px utili a 1440 |
| Home mobile | Padding laterale 24 px a 390; 20 px a 320 |
| Gioco desktop | Massimo esterno 1280 px, padding laterale 32 px |
| Griglia gioco desktop | Indice 164 px, articolo flessibile, pannello 280 px; gap 36 px fra colonne |
| Colonna articolo a 1440 | 700 px utili |
| Gioco tablet | Massimo esterno 792 px, padding 32 px; articolo 704 px a 768 |
| Articolo mobile | Padding 20 px a 390 e 16 px a 320; lettura utile 350 e 288 px |
| Pannello obiettivo / metriche desktop | Padding 20 px |
| Paragrafi articolo | Separazione 20 px; h2 con margine superiore 36 px desktop, 30 px mobile |
| Dialogo percorso | Larghezza `min(480px, 100% - 24px)`; altezza massima `100dvh - 32px` |

Per form di autenticazione mantenere come base il contenitore esistente da
28 rem, circa 448 px; per pagine di dati usare inizialmente il massimo esistente
di 1120 px: **P**, entrambi da confrontare nel nuovo tema. Non allargare i form
fino alla larghezza dell'articolo o della Home.

Spazi di 20/28/36 px servono a composizioni specifiche; non richiedono una nuova
astrazione globale per ogni valore. Per le nuove pagine partire da gap 16–24 px
fra gruppi e 32–48 px fra sezioni, **P**.

### 2.6 Bordi, raggi e stati

| Elemento / stato | Convenzione | Stato |
|---|---|---|
| Pulsante primario | Cobalto, testo bianco, raggio 8 px, minimo 48 px di altezza | A/V |
| Pulsante secondario | Bianco, testo scuro, bordo 1 px `#7B8CA6`; hover sfondo freddo e bordo/testo cobalto | A/V |
| Card ordinaria / campo | Raggio 8 px, bordo 1 px; campo alto almeno 44 px | P, derivato dai controlli approvati |
| Percorso Home / dialogo | Raggio 10 px; sequenza mobile con estremità arrotondate | A/V |
| Scheda sintetica articolo | Bordo 1 px, raggio 6 px, summary alto almeno 48 px | A/V |
| Focus comandi e link giocabili | Outline cobalto 3 px, offset 4 px; titolo focalizzato offset 5 px | A/V |
| Focus campi | Stesso outline, senza sostituirlo con sola ombra trasparente | P |
| Disabled | Sfondo `#EDF1F7`, testo `#53617A`, bordo leggero, nessuna opacità sull'intero componente | A/V |
| Loading | Testo di stato visibile, indicatore cobalto, azioni incompatibili disabilitate; articolo precedente leggibile | A/V campione |
| Hover del link giocabile | Fondo `#EEF3FF`, colore hover cobalto scuro, sottolineatura conservata | A/V |
| Pressione pulsante | Spostamento verticale massimo 1 px; transizioni di 140 ms | A/V |

Card e foglio articolo non hanno ombre per separare ogni blocco. L'ombra del
dialogo è `0 24px 80px #19284233`, con backdrop `#19284270`, **A/V**. Eventuali
ombre dei menu sono **P**, leggere e motivate dalla sovrapposizione.

Con `prefers-reduced-motion: reduce` disattivare animazioni, transizioni e smooth
scroll; il loader mantiene un segno statico e un testo di stato. Non usare la
rotazione come unico indizio di caricamento.

### 2.7 Breakpoint del riferimento

I breakpoint appartengono ai componenti, non a un dispositivo specifico:

| Intervallo | Comportamento del prototipo | Stato della verifica |
|---|---|---|
| Da 1120 px | Gioco a tre aree; indice e pannello laterali | A/V a 1440 |
| 681–1119 px | Gioco a colonna unica, HUD superiore a una riga, percorso in dialogo | A/V a 768 |
| Fino a 680 px | HUD su due righe; nessun percorso completo permanente | A/V a 390/320; margine 601–680 da ricontrollare |
| Fino a 600 px | Home a una colonna, percorso verticale; misure mobili di lettura e HUD | A/V a 390/320 |
| Fino a 350 px | Padding e titolo adeguati a 320, CTA Home larga, nessuna compressione dei titoli | A/V a 320 |
| Fino a 800 px | Gerarchia Home intermedia, titolo e spazi adattati | A/V a 768 |

Le regole intermedie esistono nel prototipo; non tutte le larghezze fra soglie
sono state osservate. Il menu della Navbar completa richiede una verifica propria:
non eredita automaticamente il breakpoint dell'HUD o quello dell'articolo.

## 3. Convenzioni dei componenti

### 3.1 Navbar

**A/V**: marchio sans ben leggibile, superfici chiare, azioni account secondarie,
assenza di una grande testata persistente durante la lettura mobile. La testata
del prototipo scorre via; l'HUD rimane l'unica barra persistente del gioco.

**F**: mantenere le destinazioni e gli stati anonimo/autenticato della Navbar
Angular. History, profilo, logout e ingresso guest non vanno rimossi copiando la
Navbar semplificata del prototipo. Nessuna nuova sidebar applicativa.

**P**: applicare il trattamento al menu completo; pagina corrente distinguibile
anche con `aria-current="page"`, menu mobile con nome accessibile,
`aria-expanded`, Escape e ritorno del focus all'apertura. Una normale navigazione
espandibile non richiede il focus trap di un dialogo modale.

### 3.2 Pulsanti e collegamenti

**A/V**: un'azione visivamente primaria per contesto; secondari con bordo e
terziari testuali riconoscibili. Le icone accompagnano un testo o hanno un nome
accessibile. I controlli principali sono alti almeno 44 px; la CTA principale 48.
Path ha larghezza minima 48 px; la chiusura del dialogo misura 44×44 px.

Usare link per destinazioni e pulsanti per azioni. I link nell'articolo restano
inline e non diventano grandi pulsanti da 44 px che spezzano i paragrafi.
Non rendere cliccabili nodi, card o titoli privi di una reale azione.

I piccoli controlli di anteprima del prototipo non sono un precedente per i
controlli di gioco: non saranno presenti nell'applicazione ufficiale.

### 3.3 Card, form e badge

**P**, salvo le superfici approvate di Home e HUD:

- Card per gruppi di dati o decisioni, non per ogni riga o paragrafo. Evitare
  una card esterna attorno a tutto l'articolo e una seconda card per ogni metrica.
- Form con label persistente, istruzioni vicine, campo bianco e bordo forte.
  Conservare controlli nativi, autocomplete, vincoli e validazione esistenti.
- Radio per modalità/difficoltà: selezione tramite radio, bordo, fondo e testo.
  `fieldset` e `legend` restano significativi; niente wizard aggiunto.
- Badge compatti per stato, modalità o difficoltà. Sans 12–13 px come base da
  validare, senza assegnare un colore diverso a ogni valore o una pillola a ogni
  parola. Nel percorso il badge non sottrae larghezza al titolo.

### 3.4 Messaggi, errori e stati vuoti

**P**: riutilizzare `ErrorBanner`, `LoadingSpinner`, `.status` e `.empty-state`,
allineandoli ai nuovi token. Un contenitore può allineare icona e corpo del
messaggio; la frase con eventuali link deve restare in un unico flusso testuale,
senza diventare una serie di colonne flex strette.

Errore, caricamento e assenza di dati sono stati distinti. Usare `role="alert"`
per errori da annunciare, status non invasivi per attese e conferme. Evitare
annunci duplicati o aggiornamenti live del timer a ogni secondo. Lo stato vuoto
spiega cosa manca e usa soltanto azioni già disponibili; non dice “prima partita”
a chi ne ha già concluse. Retry e nuovi comportamenti di recupero rimangono nel
backlog UX, non si considerano introdotti da questa convenzione grafica.

### 3.5 HUD

**A/V**: destinazione gialla, metriche tabulari, modalità/difficoltà leggibili,
Backtrack raggiungibile. Desktop: pannello laterale da 280 px. Tablet: barra a
riga singola; mobile: due righe. Titolo completo dell'articolo e tappe non entrano
nell'HUD.

Misure osservate durante la lettura: **73 px a 768**, **107 px a 390/320**;
busy aggiunge 32 px, per **105/139 px**. Sono misure di riferimento con i dati
campione, non altezze fisse che autorizzino il taglio del contenuto. A 320×740
rimangono 633 px verticali di lettura, 601 in busy. Eventuali safe area del
dispositivo richiedono una verifica aggiuntiva, non sono incluse in queste misure.

**F**: tempo e clic provengono dal modello attuale; la metrica principale dipende
dalla modalità. **P**: verificare la variante TIME nello stesso spazio, oltre a
valori lunghi, MEDIUM con disponibilità residua e HARD senza Backtrack. EASY,
MEDIUM e HARD conservano tutte le condizioni attuali, compreso il limite MEDIUM
di tre ritorni e il controllo finale del backend.

Un solo stato di gioco deve alimentare le varianti responsive. Non duplicare
richieste, timer o azioni perché esistono due presentazioni dell'HUD; non lasciare
controlli nascosti raggiungibili con Tab o ID duplicati.

### 3.6 Percorso

**A/V**: nodo vuoto per la partenza, nodo pieno per l'articolo corrente, etichette
testuali e titoli completi. La lista rappresenta soltanto tappe reali. I nodi non
sono scorciatoie di navigazione e non sostituiscono Backtrack.

Il numero di tappe non è il numero di clic: il campione iniziale ha due articoli
e un clic. Il contatore ufficiale non va ricostruito dalla lunghezza del percorso,
anche quando un ritorno ne modifica la sequenza visibile.

Nella Home l'esempio concluso è orizzontale su desktop e verticale su mobile.
Nel gioco il percorso è laterale e richiudibile su desktop; su tablet/mobile si
consulta tramite Path in un dialogo, poi si torna alla stessa lettura. La
destinazione non raggiunta appare separata, senza linea verso tappe ipotetiche.

**P**: nel dettaglio storico mantenere una lista verticale completa o espandibile,
non il percorso orizzontale che nasconde l'arrivo. Verificare percorsi lunghi e
ripetizioni reali senza alterare il significato dei dati ricevuti.

### 3.7 Articolo Wikipedia e link giocabili

**A/V**: foglio bianco, titolo serif regolare, h2 serif, corpo sans e misura di
lettura controllata. Non disegnare nodi o linee dietro i paragrafi. Link giocabili
cobalto sempre sottolineati, con hover e focus visibili. Durante busy il testo
precedente resta leggibile, senza ridurre l'opacità dell'intero articolo.

**F**: rendere gli stessi contenuti sanitizzati già forniti dal backend. Nessun
aggiramento della sanitizzazione, nuovo HTML fiduciario o modifica del parser/API
per ottenere lo stile. Ogni collegamento consentito resta utilizzabile; non
replicare il sottoinsieme limitato delle fixture del prototipo.

La tastiera richiede una correzione presentazionale esplicita: gli attuali
`a[data-page-title]` senza `href` non diventano operabili grazie al CSS. La futura
soluzione deve fornire semantica e attivazione equivalenti, preferendo controlli
nativi, e passare dallo stesso evento `navigate` esistente. Non deve aprire
Wikipedia esternamente, generare doppi eventi o consentire azioni durante busy.

Applicare `lang="it"` al contenitore dell'articolo. Dopo una mossa riuscita il
titolo del nuovo articolo deve essere visibile sotto l'HUD e il focus gestito in
modo prevedibile. Calcolare lo spazio di scroll in funzione dell'altezza effettiva
della barra; non copiare un offset fisso per tutte le larghezze.

### 3.8 Indice e infobox

**A/V — indice**: sans-serif, laterale quando c'è spazio, consultabile tramite
`details` sopra il testo nelle altre larghezze. Conservare livelli dei titoli,
nomi leggibili e navigazione alle sezioni sotto la barra persistente.

**A/V — scheda del prototipo**: dati sintetici dopo l'introduzione, richiudibili,
sans-serif, immagine contenuta. Non deve precedere il primo paragrafo con una
tabella più alta del viewport.

**P — infobox reali complete**: il prototipo contiene un'immagine e tre dati,
non dimostra il trattamento di tutte le tabelle Wikipedia. Trasferire il principio
di lettura prima della scheda conservando **tutti** i dati e i link, anche quando
la scheda è richiudibile. La tecnica di presentazione va verificata sul DOM
sanitizzato reale: niente eliminazione di righe o collegamenti per farla somigliare
alla sintesi dimostrativa.

Immagini proporzionate con larghezza massima del contenitore. Tabelle, codice e
contenuti intrinsecamente larghi possono avere uno scorrimento **locale** indicato
e utilizzabile da tastiera; non devono allargare l'intera pagina. Verificare anche
articoli senza indice/infobox, più tabelle, formule e titoli molto lunghi.

### 3.9 Dialoghi e caricamento

**A/V**: dialogo del percorso con nome accessibile, chiusura esplicita, Escape,
focus iniziale, contenimento di Tab/Shift+Tab e ripristino del focus all'apertura.
Contenuto lungo scorre internamente, senza tagliare titolo o pulsanti a 320 px.
Preferire primitive native senza aggiungere librerie.

**P**: applicare lo stesso linguaggio al dialogo distruttivo del profilo,
conservandone la conferma e il focus iniziale su Cancel. Il menu di navigazione
resta distinto da un dialogo modale.

**A/V**: loader inline da 14 px con testo, rotazione di 0,8 s solo se il movimento
è consentito; fallback statico con reduced motion. Il busy di una mossa compare
nell'area persistente mobile o nel pannello desktop. Disabilita le azioni
incompatibili e comunica `aria-busy`, senza oscurare il testo. La richiesta reale
determina inizio/fine dell'attesa: nessun ritardo artificiale copiato dal prototipo.

## 4. Regole per le schermate

### 4.1 Home — A/V

Riprodurre la gerarchia approvata: marchio, grande titolo sulla sfida verso
Federico II, spiegazione concreta della navigazione Wikipedia e **Play as Guest**
come unica CTA piena dominante. Login e registrazione restano individuabili e
secondari. Le istruzioni e il percorso fanno parte della composizione, non sono
una griglia di funzionalità da landing SaaS.

Il percorso dimostrativo verificato è **Roma → Napoli → Università degli Studi
di Napoli Federico II**, dichiarato esempio di una partita conclusa. Non implica
che ogni partita segua quel tragitto. Su mobile diventa verticale senza scroll
orizzontale; a 320 la CTA occupa la larghezza utile. Conservare i testi reali sulle
regole, senza inventare statistiche, distanze, benefici account o vincoli guest.

Il click guest segue il flusso Angular esistente. Login e Register aprono le
rispettive schermate reali, non il dialogo informativo usato solo nel prototipo.

### 4.2 Login e registrazione — P

Form centrati, misura contenuta, titolo sans e collegamento reciproco evidente.
Una sola azione primaria di invio; campi bianchi, label sopra e requisiti già
previsti esposti prima dell'errore. Non aggiungere un percorso decorativo intorno
al form, provider social o ulteriori passaggi.

Conservare validatori, autocomplete, gestione errori e continuazione della partita
guest dopo autenticazione. Errori associati ai campi e orientamento al primo
invalido richiedono implementazione e prove specifiche. Mostra/nascondi password
è una proposta UX separata, non un elemento già approvato nel prototipo.

### 4.3 Dashboard — P

Pagina dei percorsi personali: New game e partite da riprendere precedono le
statistiche, soprattutto sul telefono. Origine e articolo corrente identificano
la partita; Resume è più evidente di Delete, che mantiene la conferma attuale.
Partite concluse e metriche restano gruppi chiari, senza pareti di KPI o grafici
inventati. I titoli sono sans, anche quando contengono nomi di articoli.

Ridurre conteggi e intestazioni duplicati; rendere gli stati vuoti proporzionati.
Specificare l'ambito delle medie CLICK/TIME senza cambiare calcoli o dati. Questi
testi e il riordino sono proposte ancora da confrontare nel nuovo layout.

### 4.4 Nuova partita — P

Una pagina di configurazione, con spiegazione breve della destinazione, due gruppi
nativi Mode/Difficulty, distacco netto fra gruppi e una CTA Start game. Opzioni
più compatte su mobile senza nascondere le regole di backtracking. Nessun wizard,
preselezione diversa o impostazione aggiuntiva.

Il limite partite usa l'errore effettivo del sistema. L'avviso non deve apparire
due volte né frammentare una frase con link in colonne. Eliminare la duplicazione
richiede verificare la gestione degli stati, non solo cambiare la classe `.status`.

### 4.5 Partita in corso — A/V composizione; P varianti non coperte

Articolo dominante, indice a sinistra e stato/percorso a destra sul desktop.
Su mobile mantenere la barra persistente approvata e il percorso consultabile in
dialogo. Non reintrodurre grandi pannelli prima del testo, una seconda barra
persistente o il titolo lungo dentro l'HUD.

Destinazione, metrica principale, metrica secondaria e Backtrack quando ammesso
restano raggiungibili durante la lettura. Il caricamento è visibile nella stessa
area. Mantenere anche le reali azioni di uscita/pausa e tutti gli stati della
`GamePage`: il prototipo non giustifica la loro rimozione.

CLICK/EASY è il campione visivo validato; TIME, MEDIUM, HARD, recupero guest,
errori iniziali e di navigazione richiedono prove dedicate nello stesso linguaggio.

### 4.6 Risultato — P

Il risultato è un traguardo del percorso: nome della destinazione, conferma
esplicita e metrica ufficiale della modalità dominanti; metriche secondarie e
sfida di supporto. Usare successo testuale e icona, mantenendo il giallo come meta.
Niente punteggio aggregato nuovo, medaglie, diplomi o confetti obbligatori.

Conservare tutte le azioni reali e la distinzione guest/autenticato, incluso il
risultato non ancora salvato. Mostrare il percorso già disponibile senza nuove
richieste non necessarie è una proposta da validare. Un nuovo accesso diretto a
New game è un'opportunità dell'audit **da approvare separatamente**: l'approvazione
del tema non modifica automaticamente il flusso post-partita.

### 4.7 History — P

Conservare il carattere di classifica pubblica, filtri, URL e criterio di
ordinamento esistenti. Desktop: dati confrontabili e numeri allineati, con metrica
principale in evidenza. Mobile: righe o schede compatte, giocatore/rank e metrica
principale prima di data e dettagli secondari. Nessun KPI aggiunto.

Lo stato selezionato deve essere percepibile senza colore. Il pattern ARIA dei
filtri e l'eventuale Retry esplicito richiedono una decisione UX e prove, senza
cambiare significato, query param o risultato dei filtri.

### 4.8 Dettaglio partita — P

Identificare una partita conclusa, non soltanto uno username. Percorso verticale
con titoli interi e arrivo individuabile anche a 320, metrica ufficiale e
metadati proporzionati. Le tappe sono informative, non link per riprendere un
gioco concluso. Non ruotare la bandiera per adattarla al layout.

Conservare dati e significato della tabella mosse; verificare una presentazione
mobile che non imponga alla pagina uno scroll orizzontale. Eventuale scroll locale
deve essere riconoscibile e utilizzabile, senza perdere righe o colonne.

### 4.9 Profilo — P

Identità essenziale, form ordinati e separazione chiara fra dati account, password
e zona di cancellazione. Non trasformare il profilo in una dashboard aggiuntiva.
Conservare richieste, validazione, conferma distruttiva e feedback esistenti.

Completare associazioni degli errori e messaggi coerenti per ogni esito della
password, senza cambiare regole di autenticazione o introdurre una nuova area di
sicurezza. Colori semantici e spaziature vanno verificati anche con messaggi lunghi.

## 5. Responsive e accessibilità: criteri di accettazione

Ogni fase che modifica il rendering deve produrre screenshot e controlli a
**1440, 768, 390 e 320 CSS px**. Usare gli stessi dati tra prima e dopo. Altezza
base 900 px; aggiungere almeno una prova mobile 320×740 per l'ingombro dell'HUD.

| Larghezza | Riferimento Home | Riferimento partita |
|---|---|---|
| 1440 | Titolo ampio e percorso orizzontale; una CTA primaria | Tre aree; lettura 700 px; indice e pannello laterali |
| 768 | Gerarchia e percorso adattati senza compressioni | Lettura 704 px; HUD a una riga di 73 px |
| 390 | Una colonna; percorso verticale e azioni leggibili | Lettura 350 px; HUD a due righe di 107 px |
| 320 | CTA larga, titoli interi, nessuno scroll laterale | Lettura 288 px; stesso HUD, titolo lungo naturale e percorso a richiesta |

Verifiche richieste, non risultati già attribuiti all'applicazione Angular:

1. `document.documentElement.scrollWidth` non supera `innerWidth`; lo scroll
   all'articolo non introduce spostamenti orizzontali. Non usare
   `overflow-x: hidden` sul body per occultare una griglia troppo larga.
2. Al gioco: catture di inizio, lettura dopo scroll, percorso aperto e busy;
   aggiungere indice aperto, infobox completa e focus su un link giocabile.
3. Durante lo scroll mobile l'HUD rimane visibile a `top: 0`, con destinazione,
   metrica principale e azioni ammesse; la Navbar scorre via. Nessun titolo o
   elemento focalizzato deve essere coperto dalla barra.
4. Titoli lunghi di articoli, username, email e messaggi vanno a capo senza
   troncare informazioni necessarie. Verificare numeri e tempi più lunghi dei
   campioni, con fallback tipografici effettivi.
5. Comandi principali con area almeno 44×44 px ove applicabile; CTA alta 48 px.
   Link nel testo restano inline; non rimpicciolire i controlli per farli entrare.
6. Tutti i link giocabili si raggiungono con Tab e si attivano con la tastiera
   secondo la semantica scelta; una sola mossa per attivazione. Busy impedisce
   azioni duplicate anche da tastiera. Provare ritorno e destinazione raggiunta.
7. Focus visibile su link, pulsanti, campi, summary e dialoghi, non tagliato dai
   contenitori. Escape/Tab/Shift+Tab e ripristino del focus funzionano nel dialogo;
   il menu mobile espone uno stato coerente e non trattiene impropriamente il focus.
8. Nome e ruolo dei controlli, pagina corrente, stato selezionato, errori associati
   e lingua dell'articolo sono programmaticamente disponibili. Non duplicare
   landmark o annunci per le due varianti responsive.
9. Contrasto di progetto: almeno 4,5:1 per testo normale e 3:1 per testo grande;
   indicatori e bordi necessari dei controlli distinguibili almeno a 3:1 rispetto
   alle superfici adiacenti. Verificare focus, hover, selezione, errori e disabled,
   non solo la palette nominale. Colore sempre accompagnato da testo o forma.
10. Reduced motion: niente animazioni attive o scorrimento fluido forzato;
    caricamento riconoscibile anche con spinner statico. Nessuna animazione
    necessaria a capire le regole o usare un comando.

Aggiungere verifiche **ancora aperte** con zoom al 200%, screen reader, viewport
intermedi attorno a 350/600/680/800/1120 px, dispositivi fisici e browser diversi.
Le prove del prototipo in Chromium non costituiscono una certificazione completa
di accessibilità o di compatibilità multipiattaforma.

## 6. Vincoli funzionali e limiti del prototipo

**F — il redesign non modifica:** regole, difficoltà, conteggio dei clic,
backtrack, punteggi, timer e autorità del backend; contratti REST, database,
autenticazione, recupero/continuazione guest, routing, guardie e flussi esistenti.
Nessuna nuova dipendenza, font remoto o libreria senza autorizzazione.

La struttura attuale delle rotte va preservata:

- `/` rende LandingPage oppure Dashboard secondo l'autenticazione;
  `/dashboard` è un redirect esistente, non una nuova destinazione da creare.
- `/login`, `/register`, `/new-game`, `/game/:id`, `/guest/game/:id`,
  `/history`, `/history/:gameId` e `/profile` mantengono le rispettive condizioni.
- Il risultato è lo stato `completed` della GamePage, non una nuova rotta `/result`.
- L'uscita dal gioco conserva `pauseBeforeLeave()` e la guardia esistente.

Per TIME mostrare il tempo effettivo già previsto; non inventare countdown,
scadenze o allarmi basati su soglie nuove. Per CLICK usare i clic ufficiali.
Disabilitazione e messaggi nell'HUD non sostituiscono i controlli del backend.

**Non trasferire dal prototipo**: timer fermo a `0:18`, contatori locali,
fixture statiche, banner “Prototype”, controlli Preview/Reset, query di demo,
dialoghi fittizi di autenticazione/risultato, ritardi `setTimeout`, blocco CSP
`connect-src 'none'` o lista ridotta di link supportati. Sono strumenti della
prova visiva, non requisiti del prodotto ufficiale.

## 7. Trasferimento in Angular e roadmap incrementale

### 7.1 Punti di integrazione esistenti

| Area | File / componenti | Indicazione |
|---|---|---|
| Fondamenta | `frontend/src/styles.css` | Adattare token, `.btn`, `.card`, `.field`, `.badge`, `.status`, `.empty-state`; evitare un secondo sistema concorrente |
| Cornice e navigazione | `frontend/src/app/app.html`, `shared/components/nav-bar/` | Allineare contenitori e navigazione esistente; non restringere il gioco nel contenitore generico |
| Home / autenticazione | `features/home/`, `features/auth/` | Conservare Home come scelta fra LandingPage e Dashboard; mantenere form e continuazione guest |
| Percorsi personali / configurazione | `features/dashboard/`, `features/game/new-game/` | Applicare gerarchia proposta senza cambiare servizi o limiti |
| Gioco | `game-page`, `game-hud`, `game-path`, `wikipedia-article` | Conservare orchestrazione e input/output; presentazione responsive sullo stesso stato |
| Esiti e consultazione | `game-result`, `features/history/`, `features/profile/` | Trasferire le convenzioni dopo confronto delle proposte |

I percorsi dei componenti gioco sono sotto `frontend/src/app/features/game/`;
gli altri componenti condivisi sotto `frontend/src/app/shared/components/`.
Riutilizzare Angular standalone, OnPush, signals e icone Lucide già presenti.
Non copiare gli SVG sprite o l'architettura JavaScript della prova statica.

Il contenuto `[innerHTML]` di Wikipedia non riceve gli attributi di encapsulation
Angular: gli stili dei discendenti iniettati vanno nel livello già predisposto
in `styles.css`, circoscritti ad `app-wikipedia-article .wiki__body`. I titoli
applicativi non devono cambiare perché è stata definita una regola globale per h2.
Template/CSS del componente gestiscono titolo, indice e cornice; eventuali
adattamenti semantici richiedono interventi TypeScript mirati e relativi test.

La cornice attuale usa `.container` in `app.html` e il gioco ha un proprio
centraggio: la nuova misura va integrata consapevolmente, senza sommare padding
e massimi incompatibili o mascherare eccessi con trasformazioni e overflow nascosto.
Questo è un dettaglio d'integrazione da verificare, non un invito a rifare il layout
generale o i servizi.

### 7.2 Regola comune di validazione

Ogni gruppo è piccolo e revisionabile: componenti coinvolti, stati previsti,
screenshot alle quattro larghezze e riscontro prima/dopo. Le modifiche globali
richiedono controllo delle pagine già trasferite e di quelle ancora nel vecchio tema.
Non lasciare indefinitamente due palette o versioni incompatibili dei pulsanti.

Per una futura modifica frontend eseguire, dalla directory `frontend/`, i test
pertinenti con `npm test -- --watch=false` e `npm run build`; aggiungere regressioni
quando cambiano semantica o comportamento, senza test che rispecchino soltanto
valori CSS. Le verifiche di rendering si fanno in Playwright/Chromium già disponibile.
Nessuna installazione di dipendenze è implicita nel piano.

Scenari con scritture soltanto nell'ambiente E2E disposable e con le guardie del
repository: localhost/127.0.0.1:55432, database `roadtounina_e2e`. Non usare dati di
produzione o una partita reale per verificare timer e navigazione; non aggirare
le guardie. Fixture e intercettazioni verificano la presentazione, non provano
da sole persistenza o cronometraggio integrato.

### Fase 0 — Baseline e perimetro

Raccogliere le baseline Angular sui medesimi dati, elencare stati autentico/guest,
rotte e problemi dell'audit. Conservare come riferimento Home approvata e serie
tipografica “after”; non usare per errore i primi screenshot con Georgia nel corpo.
Nessuna modifica funzionale. Uscita: matrice di confronto e gruppi di lavoro definiti.

### Fase 1 — Fondamenta visive e componenti condivisi

Trasferire palette, famiglie, scala di spaziatura, controlli, bordi, focus e stati
base. Adattare Navbar, ErrorBanner e LoadingSpinner senza cambiare le destinazioni.
Verificare Home, form, lista e pagina gioco come sentinelle delle modifiche globali.
Le combinazioni semantiche P diventano validate solo dopo rendering e controllo
del contrasto. Affrontare subito il focus debole, non rinviarlo alla rifinitura finale.

Uscita: primitive coerenti, nessuna regressione responsive, test pertinenti e build.

### Fase 2 — Home e autenticazione

Trasferire la composizione Home approvata, mantenendo ingresso guest e navigazione
reali. Poi applicare la proposta ai due form in un gruppo distinto, con errori,
invio in corso e continuazione guest. Verificare il percorso verticale a 320,
le CTA e il focus dei campi invalidi se incluso nella correzione autorizzata.

Uscita: confronto Home/prototipo e revisione visiva esplicita dei form P; nessuna
variazione a validatori, sessioni o API di autenticazione.

### Fase 3 — Dashboard e configurazione

Trasferire prima righe di partita e gerarchia, poi form Mode/Difficulty e messaggi
di limite. Verificare dati presenti/assenti, titoli lunghi, conferma Delete,
statistiche con ambito corretto e limite raggiunto. Separare i cambi di copy e la
deduplicazione degli errori dalle sole modifiche dei token.

Uscita: proposte P confrontate visivamente, azioni e selezioni ancora equivalenti,
test di stato dove modificati e screenshot anche con messaggi di errore.

### Fase 4 — Partita e articolo Wikipedia

Procedere in gruppi distinti: contenitori e tre aree desktop; HUD persistente e
percorso consultabile; tipografia e indice; semantica dei link e focus; infobox
complete. Non sommare tutto in un unico trasferimento automatico del CSS statico.

Verificare tastiera, busy e Backtrack insieme alla nuova composizione, poi tutte
le modalità/difficoltà, fixture lunghe e contenuto Wikipedia reale sanitizzato.
La navigazione da tastiera, l'assenza di overflow e il contesto persistente sono
criteri bloccanti di questa fase. La sola somiglianza di uno screenshot non basta.

Uscita: confronto con il prototipo, prove degli stati e test dei comportamenti
presentazionali modificati; eventuale E2E integrato solo nell'ambiente protetto.

### Fase 5 — Risultato, History, dettagli e profilo

Un gruppo per esito, uno per classifica/dettaglio e uno per profilo. Verificare
risultato guest non salvato, classifiche filtrate/vuote/in errore, percorsi lunghi,
form e conferma distruttiva. Conservare le azioni attuali; eventuali nuove azioni
di continuità o recupero entrano soltanto dopo approvazione del relativo cambio UX.

Uscita: proposta visiva delle schermate P validata sui dati reali o di test,
senza cambi a ranking, filtri, autenticazione o operazioni distruttive.

### Fase 6 — Chiusura UX/accessibilità e verifica trasversale

Chiudere il backlog residuo con interventi separati e prove esplicite. Le criticità
bloccanti di focus e gioco sono già affrontate nelle fasi 1 e 4: questa fase non
autorizza a rinviarle. Eseguire la matrice completa, controllare il passaggio fra
schermate e completare le verifiche su zoom, tecnologie assistive e altri browser
compatibilmente con l'ambiente disponibile, dichiarando i limiti rimasti.

Uscita: elenco di problemi effettivamente chiusi, prove collegate e decisioni
ancora aperte. Non dichiarare l'audit risolto perché tutte le pagine sono blu.

### 7.3 Backlog che il nuovo CSS non risolve automaticamente

Gli ID si riferiscono all'audit originale. Tutti rimangono da verificare nel
frontend ufficiale fino a implementazione e riscontro.

| Audit | Tema | Destinazione e prova richiesta |
|---|---|---|
| 1, 5 | Semantica/attivazione dei link, sottolineatura | Fase 4: Tab, attivazione singola, busy e stesso evento di navigazione |
| 2, 3, 7, 9 | HUD, overflow, percorso e busy fuori vista | Fase 4: inizio/scroll/dialogo/busy alle quattro larghezze |
| 4 | Focus, campi e testo selezionato | Fasi 1–3: contrasto e focus sui controlli reali, non solo sui token |
| 6, 13 | Messaggio di limite duplicato e configurazione | Fase 3: stato simulato controllato, un messaggio e testo continuo |
| 8 | Infobox prima dell'introduzione | Fase 4: contenuto completo, tutti i link conservati, tastiera anche a scheda aperta |
| 10, 11, 12, 19 | Gerarchia Home/Dashboard, label e identità | Fasi 2–3: confronto visuale e testi coerenti con dati e modalità |
| 14, 20 | Densità classifica, percorso storico, numeri e icona | Fase 5: lettura mobile e dati completi, senza scroll della pagina |
| 15 | Pattern tab incompleto e Retry History | Fasi 5–6: decidere pattern e recupero, poi prove di tastiera/errore; proposta UX |
| 16 | Errori, requisiti e feedback password | Fasi 2/5: associazioni, focus e tutti gli esiti previsti, senza cambiare autenticazione |
| 17 | Escape menu, pagina corrente e lingua articolo | Fasi 1/4: semantica, chiusura e ripristino del focus |
| 18 | Collegamento dal risultato alla prossima partita | Proposta UX aperta: approvazione separata prima di aggiungere l'azione |

## 8. Decisioni ancora aperte

- Rendering e colori semantici delle pagine P: autenticazione, Dashboard,
  configurazione, esito, classifica, dettaglio e profilo.
- Varianti TIME/MEDIUM/HARD, valori numerici lunghi e stati di errore/recupero
  integrati: la composizione approvata va estesa senza perdere contesto o regole.
- Presentazione completa e non distruttiva delle infobox e dei contenuti Wikipedia
  non coperti dall'estratto del prototipo.
- Tecnica di adattamento accessibile dei link sanitizzati e gestione del focus:
  comportamento richiesto chiaro, implementazione da verificare nei componenti.
- Nuove azioni UX dell'audit, come Retry esplicito, mostra password e accesso diretto
  a New game dal risultato; nessuna è implicitamente implementata dal tema.
- Comportamento del menu completo, fallback dei font su altri sistemi, ingrandimento,
  screen reader e dispositivi fisici. Le etichette applicative restano nella lingua
  attuale; il documento in italiano non autorizza una traduzione dell'interfaccia.

HUD persistente, percorso consultabile, composizione mobile e tipografia mista
dell'articolo sono **decisioni approvate**, non opzioni da rimettere in discussione
durante un semplice trasferimento. Gli aspetti aperti riguardano estensione e
verifica dell'integrazione. Questa formalizzazione non avvia la roadmap: la prossima
fase richiede l'approvazione dell'utente.

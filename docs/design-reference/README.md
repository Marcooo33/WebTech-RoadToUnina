# Riferimento approvato — Atlante dei collegamenti

Archivio selettivo del prototipo B presente il 26 ottobre 2026 in
`/tmp/roadtounina-ui-prototype/`. L'approvazione di Home e partita, compresa
l'ultima tipografia Wikipedia, è registrata in [DESIGN.md](../../DESIGN.md).
Questo materiale documenta il riferimento; non è codice dell'applicazione e non
prova la correttezza dell'integrazione Angular.

## Provenienza e precedenza

- `home-{1440,768,390,320}.png`: copie esatte da `screenshots/final/`.
- `game-start-*.png` e `game-reading-*.png`: copie esatte dalla serie più recente
  `typography-review/after/`, alle quattro larghezze richieste.
- `game-long-title-320.png`, `game-link-focus-320.png`, `game-infobox-320.png` e
  `game-index-320.png`: stessa serie `after`, casi essenziali di lettura mobile.
- `game-busy-320.png` e `game-path-320.png`: copie da `screenshots/final/`, valide
  per ingombro e composizione HUD/dialogo. La loro tipografia enciclopedica è
  precedente alla rifinitura: per l'articolo prevalgono sempre le immagini `after`.
- [prototype-reference.css](prototype-reference.css): copia esatta del CSS attuale,
  incluso il blocco finale di rifinitura. Serve a consultare misure e breakpoint;
  non va importato nell'applicazione né trasferito automaticamente.
- [SHA256SUMS](SHA256SUMS): impronte dei file archiviati per verificarne integrità
  e corrispondenza alle fonti.

L'archivio non contiene fixture, HTML di demo, JavaScript del prototipo, timer
simulati, controlli Preview, immagini degli articoli o risorse di build. Nessun
file di questa directory è un asset pubblico del frontend.

## Lettura del riferimento

L'interfaccia usa il font di sistema; titolo articolo e h2 usano la famiglia
serif prevista da `DESIGN.md`, il corpo enciclopedico è sans-serif. Le vecchie
immagini con corpo Georgia non sono il riferimento tipografico approvato.

Home: unica CTA piena dominante Play as Guest, esempio concluso
Roma → Napoli → Università degli Studi di Napoli Federico II; percorso
orizzontale desktop e verticale mobile. Account e login sono secondari.

Partita: articolo bianco dominante, indice laterale e pannello di gioco a destra
da 1120 px; HUD superiore persistente nelle altre larghezze, percorso a richiesta
in dialogo. Destinazione gialla distinta dalle tappe non ancora raggiunte.

Gli screenshot usano dati campione. Tempi, contatori, richieste, navigazione,
autenticazione e stato guest devono restare quelli dell'applicazione Angular.
TIME/MEDIUM/HARD, contenuti Wikipedia completi e pagine operative sono estensioni
P da validare, non risultati visivi già approvati.

## Fonti consultate

Nel filesystem originale sono disponibili `PROTOTYPE-REVIEW.md`,
`typography-review/TYPOGRAPHY-REVIEW.md`, i due indici `SCREENSHOTS.md`,
`/tmp/roadtounina-ui-audit/REPORT.md` e
`/tmp/roadtounina-ui-exploration/VISUAL-DIRECTIONS.md`.
L'audit e l'esplorazione sono contesto: prevalgono le decisioni A/V e i vincoli F
del documento di progetto. Le nuove evidenze Angular devono essere distinte
da questi riferimenti statici.

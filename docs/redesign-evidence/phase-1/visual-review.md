# Fase 1 — review visiva indipendente

26 ottobre 2026. Diff esaminato rispetto a `ba799db`. Perimetro: token e
primitive globali, Navbar, ErrorBanner e LoadingSpinner. Applicata la skill
`design-taste-frontend`, con precedenza al prototipo B e a `DESIGN.md`.
Nessuna modifica applicativa o commit effettuato dal reviewer.

## Esito

**PASS per il gate visivo della Fase 1. Nessun nuovo bloccante rilevato.**
Palette, bordi, controlli e focus risultano coerenti con le fondamenta approvate;
le sentinelle restano leggibili alle quattro larghezze. Il risultato è un
trasferimento delle primitive: Home, articolo/HUD e pagine P non sono ancora
approvati come composizioni definitive.

## Evidenze effettivamente viste

**68 immagini aperte tramite `view_image`**, non soltanto controllate per
esistenza: 30 del campione standard e tutte le 38 catture mirate. File relativi
a questa directory; `{1440,768,390,320}` indica tutti e quattro i file.

| Gruppo | Immagini realmente esaminate |
| --- | --- |
| Sentinelle globali | `home-{1440,768,390,320}.png`, `login-{1440,768,390,320}.png`, `history-{1440,768,390,320}.png`, `game-start-{1440,768,390,320}.png` |
| Lettura | `game-reading-{1440,768,390,320}.png`, `game-320x740-320.png` |
| Altri stati/primitive nelle pagine | `profile-1440.png`, `new-game-limit-1440.png`, `new-game-limit-320.png`, `register-validation-320.png`, `history-empty-390.png`, `history-error-320.png`, `game-error-390.png`, `game-busy-320.png`, `dashboard-empty-390.png` |
| Navbar anonima e autenticata | `navbar-anon-{1440,768,390,320}-closed.png`, `navbar-auth-{1440,768,390,320}-closed.png`, `navbar-anon-{768,390,320}-open.png`, `navbar-auth-{768,390,320}-open.png` |
| Focus e login | `field-focus-{1440,768,390,320}.png`, `login-busy-{1440,768,390,320}.png`, `login-error-{1440,768,390,320}.png` |
| Loader | `loading-anon-{1440,768,390,320}.png`, `loading-auth-{1440,768,390,320}.png` |
| Semantici | `semantic-primitives-{1440,768,390,320}.png`: specimen CSS temporaneo del tester, non una schermata introdotta nell'app |

## Riscontri

| Controllo | Esito e riscontro |
| --- | --- |
| Palette e superfici | PASS: sfondo freddo, cobalto su azioni e link, superfici bianche e nessuna ombra sulle card. Il token giallo non è stato applicato indiscriminatamente agli stati |
| Campi/focus | PASS: bordo più riconoscibile; anello cobalto visibile e non tagliato nel form a tutte le larghezze. `checks.json`: outline 3 px, offset 4 px; contrasto bordo/bianco 3,42:1 e focus/bianco 6,70:1 |
| Disabled/busy | PASS: testo “Logging in…” leggibile e contenuto stabile. Il tester misura CTA 48 px, opacità 1 e contrasto 5,52:1 |
| ErrorBanner | PASS: icona distinta dal testo, messaggi lunghi vanno a capo nel proprio flusso a 320. Errore reale login misurato a 6,38:1, con `role=alert` nel controllo tecnico |
| Semantici P condivisi | PASS per le combinazioni renderizzate dello specimen: info 13,28:1, warning 5,60:1, success 6,45:1. Testo e significato restano distinguibili; non è validazione di ogni futuro uso di questi stati |
| Navbar | PASS: marchio riconoscibile, pagina corrente sottolineata, destinazioni leggibili; a 768/390/320 il menu si apre con tutti i link e focus intero. Controlli misurati almeno 44 px; desktop anonimo/auth senza collisioni |
| Menu tastiera | Controlli del tester in `checks.json`: Escape ripristina il focus sul toggle e l'uscita dall'ultimo link non intrappola Tab, per anonimo/auth alle tre larghezze collassate. Le immagini confermano il focus visibile; il reviewer non ha ripetuto questa prova interattiva |
| Loader/reduced motion | PASS visivo: indicatore piccolo accompagnato da testo di stato. Il tester misura `animation: none` con reduced motion; non si confonde attesa con assenza di dati |
| Responsive sentinelle | Nessuna nuova perdita di contenuto nel campione. `measurements.json`: Home/login/History senza overflow alle quattro larghezze; gioco resta a +11 px a 390 e +18 px a 320, identico alla baseline |

## Non bloccanti della Fase 1 e backlog preservato

- Home conserva due CTA piene, titoli serif e titolo su tre righe a 320:
  `home-320.png`. È la composizione originaria, da trasferire in Fase 2; il
  presente PASS non dichiara Home conforme al prototipo B.
- Gioco mobile conserva pannelli grandi, percorso compresso, overflow, infobox
  prima dell'introduzione e HUD fuori vista durante lettura/busy:
  `game-start-320.png`, `game-reading-320.png`, `game-busy-320.png`. Difetti già
  registrati in Fase 0, bloccanti per il futuro gate Fase 4, senza nuova
  regressione misurata in questa fase. Il corpo Georgia e gli override locali
  dei link Wikipedia attendono la stessa fase.
- Il limite partite è ancora duplicato: `new-game-limit-320.png`. La frase
  gialla ora scorre correttamente anziché dividersi in colonne; la deduplicazione
  di stato resta Fase 3.
- Densità della classifica, gerarchia Dashboard, profilo e contenuti definitivi
  degli stati P richiedono i rispettivi gate. I nuovi token non ne attestano
  automaticamente il completamento.

## Critica del gruppo e limiti

Le primitive rispondono alla loro funzione: l'azione domina tramite cobalto,
il focus è riconoscibile, errore e attesa mantengono testo esplicito. Gli app
screen conservano oggetti e dati del prodotto senza aggiungere metriche o nuove
azioni. Nessun problema visivo nuovo richiede un giro di correzioni in questo
perimetro. Le tre priorità successive restano Home B, gerarchia/configurazione,
HUD e articolo; i difetti di composizione non vengono nascosti dal punteggio
di una review sulle primitive.

Esame indipendente di immagini e dati del tester, non nuova esecuzione
interattiva del reviewer. Catture Angular con API intercettate e immagini
Wikipedia esterne bloccate, come nella baseline; lo specimen semantico è
soltanto uno strumento di verifica. Nessun PASS dell'inspector autonomo della
skill è attribuito: il suo limite d'avvio documentato in Fase 0 resta distinto
dal fallback Playwright e dall'esame delle immagini. Non verificati qui screen
reader, zoom 200%, dispositivi fisici, altri browser o tutte le larghezze
intermedie: il collapse a 1000 px è stato letto nel CSS, il rendering osservato
è desktop a 1440 e collassato a 768/390/320. La verifica finale sul build di
produzione e l'estensione degli stati avverranno nei rispettivi gate.

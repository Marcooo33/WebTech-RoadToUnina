# Fase 0 — verifica tecnica e baseline

Data: 26 ottobre 2026 (Europe/Rome). Branch iniziale verificato: `feat/frontend-redesign`.
Codice applicativo e dipendenze non modificati dal tester.

## Esito

**PASS per build, unit ed E2E baseline e per produzione delle evidenze.** Il quality gate
complessivo della fase richiede inoltre le review indipendenti: questo rapporto non
attribuisce alcuna approvazione visiva autonoma del tester né afferma che i difetti
preesistenti siano risolti.

| Verifica | Comando / metodo | Risultato |
|---|---|---|
| Ambiente | Node v24.20.0, npm 12.2.1, Docker server 29.9.2, Playwright Chromium 1234 | Disponibile, nessuna installazione |
| Build Angular | `cd frontend && npm run build` | PASS; initial bundle 324.48 kB; nessun warning di budget |
| Unit Angular | `cd frontend && npm test -- --watch=false` | PASS; 17 file, 29 test |
| E2E integrato | `cd e2e && npm test` | PASS; 21 test, 58 s |
| Database E2E | Runner ufficiale, migration deploy e guardie esistenti | Solo database disposable `localhost:55432/roadtounina_e2e`; container e volume rimossi dal runner |
| Baseline browser | Playwright Chromium, app Angular a `127.0.0.1:4400` | 89 catture; quattro larghezze e gioco 320×740 |
| Inspector skill | `inspect.mjs` Home e gioco `--app` su snapshot renderizzati | Non eseguito fino al completamento: processo Chrome termina all'avvio; evidenza failure conservata |
| Misure alternativa skill | `probe` della skill tramite Playwright sugli stessi snapshot Angular | Misure disponibili in `skill-probe.json`; non equivale a un PASS dell'inspector |

I log completi sono [build.txt](build.txt), [unit.txt](unit.txt), [e2e.txt](e2e.txt).
La violazione intenzionale di sequenza nel test di rollback guest produce il log
`Unique constraint failed`: il test verifica il rollback e passa, non è un errore
non gestito della suite.

## Sicurezza e riproducibilità delle catture

Lo script temporaneo `/tmp/roadtounina-redesign-capture.cjs` usa l'app Angular reale,
con tutte le richieste `/api/**` soddisfatte localmente da Playwright e tutte le
richieste esterne bloccate. Non contatta il backend reale. Le risposte di presentazione
provengono esclusivamente da `fixtures.json` e `real-article.json` dell'audit locale
`/tmp/roadtounina-ui-audit/`, senza copiare fixture nel frontend o nel repository.
L'articolo completo è **Golfo di Napoli**, già sanitizzato dal parser di progetto
nell'audit, con **266 link giocabili**. L'utente isolato è sempre `audit_e2e`.
I dati di Home e dei form sono quelli effettivamente renderizzati dall'applicazione.
Questo harness è una verifica di presentazione e non prova persistenza o timer:
questi flussi sono coperti separatamente dalla suite E2E disposable.

Comando locale per ripetere le catture della fase N:

```sh
node /tmp/roadtounina-redesign-capture.cjs N
```

Il frontend isolato è avviato con `npm start -- --port 4400 --host 127.0.0.1`.
Per le fasi successive i selettori dello script vanno adattati solo quando cambia
la presentazione. Gli input campione devono rimanere uguali per confronti prima/dopo.
I file `/tmp` sono strumenti locali, non dipendenze applicative o di build.

## Matrice screenshot

Tutti i seguenti prefissi sono presenti a **1440, 768, 390, 320×900**:

| Area | Prefissi screenshot |
|---|---|
| Home e account | `home`, `login`, `login-validation`, `register`, `register-validation` |
| Dashboard | `dashboard`, `dashboard-confirm`, `dashboard-empty` |
| Configurazione | `new-game`, `new-game-limit` (TIME/MEDIUM selezionati) |
| Profilo | `profile`, `profile-dialog` |
| Classifica e dettaglio | `history`, `history-empty`, `history-error`, `history-detail`, `history-detail-moves` |
| Partita | `game-start`, `game-reading`, `game-busy`, `game-error` |
| Risultato | `result` (autenticato) |

Aggiuntivo: `game-320x740-320.png` durante la lettura.
Le catture ordinarie sono full-page; gioco start/reading/busy sono viewport per
misurare il contesto realmente visibile. Movimento ridotto attivo nelle catture.
Le misure DOM e il testo renderizzato sono in [measurements.json](measurements.json);
le richieste intercettate in [requests.json](requests.json).

## Difetti baseline misurati, da correggere nelle fasi previste

- Gioco a 390 px: `scrollWidth=401`, overflow 11 px; a 320: `scrollWidth=338`,
  overflow 18 px. Lo scroll a una sezione provoca anche spostamento orizzontale.
- I **266** link `a[data-page-title]` hanno **0** link con `href` o `tabindex`:
  non risultano raggiungibili secondo la semantica nativa da tastiera.
- In lettura a 768/390/320 l'HUD è fuori viewport (top negativo): non è persistente.
- A 320×740 l'HUD top è −274 px e resta visibile solo l'ultima porzione: baseline
  di confronto della futura barra persistente.

Sono difetti dell'applicazione preesistente già destinati alla Fase 4, non
regressioni introdotte dalla Fase 0. La valutazione visiva e l'assegnazione finale
PASS/FAIL del perimetro Fase 0 spettano ai reviewer indipendenti.

## Limiti

- L'inspector autonomo skill fallisce prima di aprire una pagina anche con
  `CHROME_PATH` esplicito al Chromium di Playwright; Playwright funziona normalmente.
- Immagini remote di Wikipedia bloccate: le catture verificano testo, struttura e
  link sul contenuto completo, senza dipendere dalla rete esterna.
- Questo giro non prova screen reader, browser diversi da Chromium, dispositivi
  fisici, zoom, varianti TIME/HARD lunghe o risultato guest; vanno affrontati nei
  gate pertinenti delle fasi successive.
- Nessun test o screenshot della fase successiva attribuito a questa baseline.

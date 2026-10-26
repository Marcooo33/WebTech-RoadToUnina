# Fase 3 — verifica tecnica indipendente

Data: 26 ottobre 2026. Branch verificato: `feat/frontend-redesign`.
Base di confronto: `ea8cdcd`. Scope applicativo: HTML/CSS/spec Dashboard e NewGame;
nessun TypeScript applicativo cambiato nel diff, nessuna modifica del tester al
codice applicativo, alle dipendenze o ai contratti API.

**PASS tecnico.** Il quality gate finale richiede inoltre code review e visual
review indipendenti delle proposte P; le immagini sono state consegnate al reviewer.

| Verifica realmente eseguita | Risultato |
|---|---|
| `cd frontend && npm run build` | PASS; solo warning Home CSS 6.42 kB già documentato in Fase 2 |
| `cd frontend && npm test -- --watch=false` | PASS, **49 test / 21 file** |
| `cd e2e && npm test -- game-lifecycle.spec.ts navigation.spec.ts` | PASS, **3 test**, 11.6 s |
| Database | Runner ufficiale, solo disposable con guardie esistenti; container e volume rimossi |
| `git diff --check` | PASS |
| Playwright Chromium | **84 record di verifica / 76 screenshot** a 1440, 768, 390, 320 × 900 |
| Target configurazione | Label radio e back link almeno 44×44, CTA almeno 48 px alle quattro larghezze |

Log: [build](build.txt), [unit](unit.txt), [E2E](e2e.txt), [browser](checks.txt).
Evidenze strutturate: [checks.json](checks.json), [requests.json](requests.json),
[targets.json](targets.json).

## Dashboard: scenari verificati

Ogni larghezza include `dashboard`, `dashboard-row-focus`, `dashboard-confirm`,
`dashboard-delete-busy`, `dashboard-empty`, `dashboard-loading`, `dashboard-error`,
`dashboard-limit`, `dashboard-long-title`.

- Due partite in corso, CLICK/EASY e TIME/MEDIUM, e due risultati completati (CLICK e TIME);
  gruppi di percorsi prima delle statistiche anche nell'ordine DOM.
- Ambiti espliciti `Average clicks · CLICK` e `Average time · TIME`; dati presenti
  e assenti distinti. Stato vuoto usa `Start a new game` anche per chi torna.
- Riga focalizzabile da tastiera con outline 3 px; azioni Resume ancora raggiungibili.
- Delete richiede conferma; apertura e Cancel producono zero richieste DELETE.
  Conferma genera una sola richiesta, espone `Deleting…` e pulsanti disabled;
  successo rimuove solo la riga interessata. E2E verifica la cancellazione integrata.
- Caricamento e errore realmente indotti dalle risposte API intercettate, con i
  rispettivi status/banner condivisi.
- Dieci partite: conteggio 10/10, avviso di limite e New game disabilitato.
- Nome utente lungo, titolo articolo lungo e stringa iniziale indivisibile:
  nessun troncamento del contenuto o overflow della pagina nei campioni.

## NewGame: scenari verificati

Sei combinazioni native di radio per ogni larghezza: CLICK/TIME × EASY/MEDIUM/HARD,
con immagini `new-game-{mode}-{difficulty}`; inoltre `new-game-radio-focus`,
`new-game-busy`, `new-game-error`, `new-game-limit`.

- Default **CLICK/EASY**, due fieldset con legend Mode/Difficulty, cinque radio;
  tutte le selezioni conservano stato nativo `checked` e nome accessibile.
- Freccia destra cambia CLICK in TIME; focus visibile sulla label con outline
  3 px/offset 4 px. Nessuna sostituzione dei radio con controlli fittizi.
- Richiesta reale del frontend intercettata: payload **TIME/MEDIUM** invariato,
  `aria-busy=true`, submit disabled durante l'attesa; errore generico in un solo
  ErrorBanner e pulsante di nuovo disponibile.
- Risposta `GAME_LIMIT_REACHED` 409: **un solo alert**, nessun ErrorBanner duplicato,
  messaggio del server conservato, link esistente `Finish or delete one` verso `/`,
  testo continuo con `display:block` sul paragrafo e link inline, submit disabled.

In **tutti** gli stati catturati `scrollWidth === innerWidth`: nessun overflow
alle quattro larghezze. La pagina di configurazione mantiene il form esistente,
le stesse regole e gli stessi servizi; gli E2E verificano creazione, arrivo nella
partita e avanzamento del percorso con backend disposable.

## Rettifica documentata del solo campione

Il visual reviewer ha osservato che il primo campione Fase 3 mostrava una sola
partita conclusa CLICK ma valorizzava anche Best TIME e media TIME. Il tester ha
rettificato **esclusivamente le risposte del proprio harness temporaneo**, senza
modificare codice o calcoli applicativi. Le 76 immagini sono state rigenerate e
le 84 verifiche browser ripetute con esito PASS; reviewer avvisato del set finale.

Rispetto al primo giro Fase 3: risultati conclusi da 1 a **2**; aggiunta una partita
TIME di **42 s / 3 clic**, accanto alla CLICK già presente di **58 s / 3 clic**;
Completed da 1 a **2**, media CLICK da 4 a **3**, media TIME da 76 s a **42 s**.
Best CLICK rimane **3 clic**, Best TIME rimane **42 s**, ora entrambi giustificati
dalle righe mostrate. Il campione completo delle fasi 0–1 mostrava soltanto la
conclusa CLICK: la riga TIME aggiunta è una differenza di dati dichiarata per
verificare correttamente i nuovi ambiti delle statistiche, non una regressione
dell'applicazione o una variazione dei calcoli del backend. Nei confronti di
Fase 6 va riutilizzato questo campione corretto del medesimo harness.

Questa rettifica delle evidenze non costituisce un ciclo di correzione applicativa.
Build, unit ed E2E erano già PASS e non sono stati ripetuti senza modifiche app.

## Limiti e strumenti

- Catture prodotte dall'app Angular development a `127.0.0.1:4400`; production
  build eseguita separatamente. Il reviewer visivo è stato avvisato al completamento.
- Tutte le API di presentazione sono intercettate, rete esterna bloccata; fixture
  audit soltanto in `/tmp`. Questi rendering non provano persistenza o timer.
- Nessuna verifica screen reader, browser diverso o dispositivo fisico in questo gate.
- L'harness ha corretto una propria assunzione: Angular RadioControlValueAccessor
  espone `.value` DOM predefinito `on`; la verifica ora legge titolo della label e
  `checked`, poi conferma i valori effettivi nel payload HTTP. Nessuna correzione
  applicativa necessaria per questo adattamento del solo test temporaneo.

Harness locale: `/tmp/roadtounina-phase3-checks.cjs`. Nessuna dipendenza o fixture
aggiunta al repository/frontend.

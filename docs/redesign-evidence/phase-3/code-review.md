# Fase 3 — code review indipendente

Data: 26 ottobre 2026. Branch verificato: `feat/frontend-redesign`.
Diff esaminato da `ea8cdcd`; nessuna modifica applicativa o commit del reviewer.

## Esito: PASS

Nessun problema bloccante individuato nella review statica. Build/unit/E2E,
prove browser e approvazione visiva delle proposte P restano gate separati.

## Evidenze

| Controllo | File/righe | Risultato |
| --- | --- | --- |
| Scope | Stato Git e diff da `ea8cdcd` | Solo Dashboard e NewGame HTML/CSS/spec, più registro autorizzato. Nessun TS applicativo, stile globale, backend, servizio/API, routing/guardia/auth, gioco o dipendenza modificati |
| Gerarchia DOM | `frontend/src/app/features/dashboard/dashboard.html:40`, `:135`, `:196` | Ordine reale in-progress → completed → statistics; nessun riordino puramente CSS che diverga dalla lettura/tastiera |
| Azioni e stati F | `dashboard.html:26`, `:97`, `:100`, `:179`, `:187` | Stesse destinazioni Resume/details/New game, conferma Delete/Cancel, binding busy/disabilitati, liste e limite, espansione conclusi; guest continuation/loading/error invariati. Resume cambia soltanto enfasi grafica |
| Copy e statistiche | `dashboard.html:45`, `:60`, `:229` | Conteggio in-progress unico nel titolo; azione vuota valida anche per utenti di ritorno; etichette medie CLICK/TIME con stessi valori e pipe. Letto `backend/src/modules/me/stats.service.ts:92`: le aggregazioni esistenti sono già filtrate per modalità, nessun calcolo cambiato |
| Focus e layout | `frontend/src/app/features/dashboard/dashboard.css:74`, `:132` | Focus riga 3 px interno, contenitore non più tagliato da overflow:hidden, conferme avvolgibili, comandi conferma ≥44 px; minmax/min-width per titoli e numeri. Nessuna modifica agli handler tastiera |
| Radio e invio | `frontend/src/app/features/game/new-game/new-game.html:19`, `:25`, `:40`, `:57` | Due fieldset/legend e cinque radio nativi con gli stessi formControlName/value, label e regole; default CLICK/EASY e invio invariati nel TS. Aggiunti aria-busy e descrizione del gruppo Difficulty |
| Errore limite | `new-game.html:11` | Rami esclusivi: GAME_LIMIT_REACHED usa un solo role=alert con `error()` effettivo e link originale `/`; gli altri errori restano in ErrorBanner. Frase nello stesso paragrafo e stile `.status` normale, senza colonne flex |
| Focus radio | `frontend/src/app/features/game/new-game/new-game.css:63` | Focus 3 px sull'intera label tramite :has(input:focus-visible), controllo nativo conservato; selezione riconoscibile tramite radio, bordo e fondo, senza badge Selected sovrapposto |
| Regressioni pertinenti | `dashboard.spec.ts`, `new-game.spec.ts` | Otto casi significativi al posto dei due smoke: ordine DOM, copy/ambito, Delete esplicito/pending, limite, gruppi/default, selezione TIME/MEDIUM realmente inviata, deduplicazione limite e recupero dagli altri errori |

`git diff --check ea8cdcd` passa. Lettura dei file TS di Dashboard/NewGame e
delle aggregazioni backend soltanto per verificare i binding e il significato
dei dati; nessuno di questi file è stato modificato.

## Problemi bloccanti

Nessuno rilevato.

## Osservazioni non bloccanti e limiti

- La prova di selezione radio degli unit test usa click: navigazione nativa con
  Tab/frecce, focus effettivamente visibile e ingombri richiedono il browser.
- Conferma Delete, valori/titoli lunghi, errori e stato vuoto devono essere
  valutati a quattro larghezze dal tester e reviewer visivo; le proposte P non
  diventano approvate tramite questa sola review del sorgente.
- Non rieseguiti build/unit/E2E o browser dal reviewer; tester indipendente
  attivo. Nessun esito ancora mancante anticipato, nessuna verifica screen reader
  attribuita. Difetti del gioco della baseline restano nel gate della Fase 4.

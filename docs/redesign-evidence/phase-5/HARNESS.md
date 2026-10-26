# Fase 5 — piano di verifica e harness persistente

Harness preparato senza eseguire test prima del VIA e poi eseguito sul codice finale.
I risultati effettivi sono in `TEST-REPORT.md`; nessun PASS attribuito alla sola preparazione.
Codice applicativo e dipendenze non modificati dal tester.

Harness: `e2e/support/redesign-phase-5.mjs`, esecuzione esplicita con `--run`.
Usa Playwright già installato in `e2e/`; frontend locale separato, default
`http://127.0.0.1:4400`. Tutte API soddisfatte dal browser, richieste esterne bloccate;
nessuna scrittura o connessione a un backend/database. Log e misure direttamente
in `docs/redesign-evidence/phase-5/` per sopravvivere alle interruzioni.

## Input dichiarati

L'audit e i prototipi temporanei originali non sono più in `/tmp`. Il nuovo campione
segue i DTO effettivi e il grafo E2E esistente: Partenope → Golfo di Napoli → Storia
di Napoli → Backtrack → Golfo → Napoli → Federico II, con contatori e mosse coerenti.
Il risultato guest conserva il solo default CLICK/EASY consentito dal contratto;
TIME è verificato sul risultato autenticato. Le varianti lunghe ripetono soltanto
archi presenti nel grafo E2E. Ranking sintetico
coerente: 41 risultati, pagine di 20, valori ordinati per i rispettivi obiettivi.
Non è lo stesso dataset delle catture baseline: confronto visivo per composizione,
non differenza pixel fra dati identici. Nessuna fixture/asset distribuita al frontend.

## Matrice eseguita dopo il VIA

Tutte le famiglie alle quattro larghezze 1440/768/390/320 × 900:

- Risultato guest CLICK/EASY e autenticato CLICK/TIME, percorso breve/lungo, destinazione e azioni
  attuali; risultati guest esplicitamente non salvati, nessuna azione UX aggiunta.
- History pronta, filtri e URL, frecce/Home/End per tab, pagina 2 e ritorno, vuota,
  errore senza righe stale, loading. Dettaglio breve/lungo con tutte le mosse,
  giocatore eliminato, errore.
- Profilo: invalidi e associazioni, password corrente/nuova/conferma, mismatch,
  busy/successo/errore API, account update busy/success/error, identità lunga;
  dialogo Delete con Cancel/Escape, focus e blocco della cancellazione durante busy,
  errore del server con dialogo ancora aperto.
- Misure DOM: pagina senza overflow, target principali ≥44px, contrasto messaggi ≥4.5:1.
  Screenshot esaminati successivamente dal reviewer indipendente.

Comandi effettivi per ripetere il browser:

```sh
node e2e/support/redesign-phase-5.mjs --run
node e2e/support/redesign-phase-5.mjs --keyboard-only
```

Il frontend va prima servito su localhost:4400. `REDESIGN_BASE_URL` e
`REDESIGN_OUTPUT_DIR` permettono un'origine locale/output alternativi. Non usare
la directory di evidenze di una fase già committata per un nuovo confronto.
Build/unit ed E2E sono stati eseguiti separatamente, con scritture soltanto tramite
runner disposable ufficiale. Le attese ARIA del test rispettano il rendering
Angular asincrono dopo l'aggiornamento dell'URL.

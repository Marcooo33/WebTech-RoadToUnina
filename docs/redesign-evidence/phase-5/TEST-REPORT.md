# Fase 5 — verifica tecnica indipendente

26 ottobre 2026. Branch `feat/frontend-redesign`, base `7910114`.
**PASS tecnico**; review visiva e del codice restano gate indipendenti.
Il tester ha modificato soltanto harness ed evidenze, nessun codice applicativo.

| Verifica effettiva | Risultato |
|---|---|
| `cd frontend && npm run build` | PASS; solo warning Home CSS 6.42 kB preesistente |
| `cd frontend && npm test -- --watch=false` | **96 PASS / 22 file** |
| `cd e2e && npm test` | **22 PASS**, 53.2 s |
| Database | Runner e guardie ufficiali, solo disposable; container e volume rimossi |
| Harness browser | **172 record / 124 screenshot**, `failures.json=[]` |
| Supplemento tastiera | ArrowRight/Left, Home/End alle quattro larghezze; **4 screenshot** |
| Responsive/semantica | Nessun overflow; target principali misurati ≥44×44; contrasto messaggi minimo 6.38:1 |
| `git diff --check` | PASS |

**128 immagini finali** a 1440/768/390/320×900, visual reviewer notificato.
Log: [build](build.txt), [unit](unit.txt), [E2E](e2e.txt), [browser](browser.txt),
[tastiera](keyboard.txt). Evidenze: [checks.json](checks.json), [keyboard.json](keyboard.json),
[requests.json](requests.json), [failures.json](failures.json).

## Copertura

- Risultato autenticato CLICK/TIME e guest CLICK/EASY, percorso breve/lungo:
  metrica primaria, destinazione, azioni reali prima del percorso e link per salvare
  il risultato guest. Tutte le tappe conservate.
- History pronta, TIME/HARD, pagina 2/rango 21 e ritorno, empty/error/loading;
  frecce/Home/End, focus, unico tabstop, ARIA panel e URL. Dettaglio con percorso
  lungo, tutte le mosse, giocatore eliminato ed errore. A 390/320 ArrowRight scorre
  la regione locale della tabella, senza scroll orizzontale della pagina.
- Profilo: invalidi e primo focus, hint/errori associati, current/new/confirm password
  e mismatch; busy/successo/APIerror, reset dopo successo e payload invariato.
  Username update, conflitto email, identità lunga. Delete: Cancel/Escape senza
  richiesta, ritorno focus, tastiera modale, Escape bloccato durante busy, errore
  server con dialogo ancora aperto. Cancellazione reale coperta dagli E2E disposable.

## Metodo, dati e limiti

Harness durevole: `e2e/support/redesign-phase-5.mjs`; istruzioni in [HARNESS.md](HARNESS.md).
API interamente intercettate e rete esterna bloccata. Catture Angular development
su localhost:4400; build production separata. I mock provano presentazione;
persistenza e flussi integrati sono verificati dai 22 E2E nel disposable autorizzato.

I materiali `/tmp` originali non erano più disponibili: campione nuovo dichiarato,
coerente con DTO e grafo E2E esistente, contatori e mosse riconciliati, ranking 41
risultati/pagine 20. Guest soltanto CLICK/EASY. Nessun confronto pixel dichiarato
su input identici e nessuna fixture/asset copiata nel frontend.

Primo giro: 91 immagini e tre interruzioni del solo harness, che leggeva ARIA prima
del successivo render Angular dopo l'URL. Corrette le attese, nuovo giro completo
PASS; log `-initial` conservati. Nessun ciclo correttivo applicativo necessario.
La sola etichetta viewport/client-width di otto record è stata distinta senza
alterare misure, usando la cattura adiacente della stessa sessione: traccia in
[metadata-correction.json](metadata-correction.json).

Nessuna verifica screen reader, dispositivo fisico, altro browser o zoom in questa
fase; nessuna attività della Fase 6 anticipata o dichiarata eseguita.

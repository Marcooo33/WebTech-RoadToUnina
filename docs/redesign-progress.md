# ROADTOUNINA — registro redesign frontend

Avvio: 2026-10-26. Branch autorizzato: `feat/frontend-redesign`.
Punto di partenza: `6e09ba9` (`docs: define frontend redesign design system`).
Working tree iniziale pulito; nessun registro preesistente o directory `docs/`.

L'orchestrazione segue `DESIGN.md`: A/V preservate, P da validare sul rendering,
F invariati. Nessun push, merge, nuova dipendenza o modifica backend autorizzata.
Solo l'implementatore delegato modifica il codice applicativo. Tester e reviewer
producono evidenze e verifiche indipendenti. Le intercettazioni browser provano la
presentazione; soltanto la suite disposable prova i flussi integrati.

| Fase | Stato | Commit |
| --- | --- | --- |
| 0 — Baseline e perimetro | PASS | `chore: complete redesign phase 0` (hash registrato dopo il commit) |
| 1 — Fondamenta e componenti condivisi | PENDING | — |
| 2 — Home e autenticazione | PENDING | — |
| 3 — Dashboard e configurazione | PENDING | — |
| 4 — Partita e articolo | PENDING | — |
| 5 — Risultato, History, dettagli, profilo | PENDING | — |
| 6 — Verifica trasversale | PENDING | — |

## Fase 0 — 2026-10-26

- Branch e stato Git verificati prima di avviare il lavoro.
- Riferimenti `/tmp/roadtounina-ui-prototype/`, audit ed esplorazione disponibili.
- Nessuna documentazione tecnica preesistente sotto `docs/`.
- Implementatore: inventario Angular, matrice accettazione, conservazione riferimenti essenziali.
- Tester: build, unit, suite E2E protetta e baseline Playwright alle quattro larghezze.
- Ambiente: Node 24.20.0, Docker e Chromium disponibili; dipendenze già installate.
- Build baseline PASS; unit baseline PASS (17 file, 29 test), segnalati dal tester.
- [Inventario e criteri](redesign-phase-0.md), [riferimenti](design-reference/README.md).
- [Rapporto tecnico](redesign-evidence/phase-0/TEST-REPORT.md): build PASS,
  29 unit in 17 file PASS, 21 E2E PASS; disposable rimosso; 89 screenshot prodotti.
- [Review visuale indipendente](redesign-evidence/phase-0/visual-review.md): PASS,
  30 catture Angular e 18 riferimenti esaminati; nessun blocco Fase 0.
- [Code review indipendente](redesign-evidence/phase-0/code-review.md): PASS,
  codice invariato, 19 checksum e provenienza verificati, nessun blocco Fase 0.
- Gate complessivo PASS: difetti preesistenti documentati e assegnati alle fasi future.
- Limiti: inspector autonomo skill fallito all'avvio Chrome; usato probe reale tramite
  Playwright. Catture con API intercettate e immagini remote bloccate; persistenza e
  flussi integrati verificati separatamente dagli E2E. Screen reader/browser fisici
  e varianti future non attribuiti alla baseline. Input temporanei mantenuti in `/tmp`.
- Correzioni: nessuna. Codice applicativo invariato.
- Commit: tutti i gate superati; hash registrato subito dopo la creazione.

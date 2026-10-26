# Fase 6 — consegna dell'implementatore

26 ottobre 2026. Branch verificato: `feat/frontend-redesign`; base di fase
`bd12101`. Nessun commit creato dall'implementatore.

## Residui riprodotti e correzioni

| Caso | Prima | Correzione e riscontro locale |
| --- | --- | --- |
| Indici mosse 10–31 | Due righe in 66/66 celle a 768, 390 e 320 px | Solo prima colonna `nowrap`, overflow-wrap normale; tutte le 66 celle ora su una riga, larghezza pagina invariata e scorrimento locale conservato |
| Navbar mobile → desktop → Escape | Focus BODY, stato expanded=true; ritorno mobile riapriva il menu | Escape ascoltato su window soltanto con menu aperto; ritorno al toggle visibile o al marchio, mantenendo un link già visibile eventualmente focalizzato |
| Percorso mobile aperto → desktop → chiusura | Ritorno a BODY perché il trigger mobile era nascosto | HUD segnala se il trigger può ricevere focus; fallback sul summary del percorso desktop, visibile e focalizzato |
| Menu aperto rimasto dopo resize + dialogo profilo | Il nuovo listener consumava il primo Escape: dialogo ancora aperto | Guardia `dialog[open]` prima di preventDefault/focus: chiude soltanto lo stato menu e lascia il comando al dialogo nativo |
| Stessa interazione con percorso a 1040 px | Verifica aggiuntiva via controlli reali: Navbar desktop e HUD ancora compatto | Primo Escape chiude il dialogo e restituisce focus al trigger Path; stato menu chiuso, nessuna interferenza con il modal |

Evidenze: [baseline](implementation-before.json),
[rischio del listener prima della guardia](implementation-modal-before.json),
[verifica finale dell'implementatore](implementation-after.json).
Il secondo documento fotografa un caso dell'implementazione iniziale in corso,
successivamente corretto; non descrive lo stato finale.

Probe riusabile:
[redesign-resize-probe.mjs](../../../e2e/support/redesign-resize-probe.mjs).
Usa esclusivamente API intercettate nel browser e abortisce le richieste fuori
dall'origine locale. I dati sono campioni di test coerenti con i DTO, non fixture
dell'applicazione, e non provano persistenza o autorità del timer.

## Verifiche locali eseguite

- `npm run build`: PASS, initial 328,61 kB; rimane soltanto il warning Home già
  noto (6,42 kB sul budget warning 4 kB; limite error 8 kB invariato).
- `npm test -- --watch=false`: 22 file, 101 test PASS. Nuove regressioni su
  fallback di focus al resize, mantenimento di focus già visibile e priorità
  del dialogo rispetto al listener Escape della Navbar.
- `node e2e/support/redesign-resize-probe.mjs after`: PASS. Copre i due ritorni
  di focus al resize, Escape nativo con menu rimasto aperto sia nel profilo sia
  nel percorso a 1040 px, e le 66 celle numeriche alle tre larghezze.
- `git diff --check`: PASS.

Sono stati esaminati dall'implementatore lo screenshot delle mosse a 320 e quello
del ritorno al percorso desktop; gli altri screenshot restano evidenze da
esaminare nella review visiva indipendente. La matrice finale completa, E2E con
database disposable e review indipendenti spettano al gate dell'orchestratore:
questa consegna non dichiara PASS la Fase 6.

Nessuna modifica ad API, backend, autenticazione, routing, timer o regole.
Nessuna dipendenza, nuova azione UX o listener media introdotto. Il listener
window è registrato da Angular nel componente e rimosso alla sua distruzione.

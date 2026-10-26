# Verifica finale sul bundle production

Harness indipendente: `e2e/support/redesign-phase-6.mts`, con server statico
`redesign-production-server.mjs`. Comando dopo build e consegna finale:

```sh
backend/node_modules/.bin/tsx e2e/support/redesign-phase-6.mts --run
```

Usa solo dipendenze già installate. Il server legge `frontend/dist/frontend/browser`,
serve fallback SPA su 127.0.0.1:4500 e non ha proxy API. Tutte le API browser sono
intercettate; richieste esterne bloccate. Il sotto-harness Fase 5 viene ripetuto
sulla stessa origine production, con output separato `phase5-production/`.
Nessuna evidenza storica di altre fasi viene sovrascritta.

Campione coerente Fase 5 e grafo E2E locale. L'articolo complesso è generato e
sanitizzato dal vero `normalizeArticle`; soltanto tag ammessi, nessun MathML.
Il raw dell'articolo reale originario e i file `/tmp` non sono più disponibili:
confronti per composizione/token/typography, senza dichiarare identità degli input
con la precedente serie Wikipedia. Le prove reali e 266 link della Fase 4 restano
conservate e non vengono cancellate o sostituite.

Matrice: schermate principali e stati/focus/error/busy alle quattro larghezze,
gioco 320×740, soglie 350/600/680/800/1000/1120, passaggi fra schermate, resize
Navbar/Path/dialogo profilo, indici 10–31, reduced motion, nomi/ruoli AX.
AX programmatico è controllo del tree Chromium, non interazione con screen reader.

Zoom 200: profilo Chromium isolato e temporaneo, estensione locale generata solo
come strumento del test, `chrome.tabs.setZoom(2)`/`getZoom(2)` e verifica che il
viewport CSS dimezzi. Non usa DPR, pinch o CSS zoom come sostituto. Se questa prova
non funziona viene segnalato FAIL/limite, senza attribuire un falso PASS al 200%.
Il profilo temporaneo viene eliminato alla chiusura, senza toccare profili utente.

Altri engine: lanciati soltanto se già installati; nessun download. In preparazione
sono stati trovati soltanto Chromium e headless-shell. Il binario Orca è presente,
ma ciò non dimostra una sessione screen-reader utilizzabile o una prova assistiva:
si dichiarerà esattamente cosa viene effettivamente verificato nell'ambiente.

Build/unit e suite E2E disposable sono verifiche separate; gli E2E usano il runner
ufficiale, non il server statico isolato. Tutti i log e report nuovi restano qui.

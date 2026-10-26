# Fase 6 — verifica finale indipendente

26 ottobre 2026. Branch `feat/frontend-redesign`, base `bd12101`.
**PASS tecnico con i limiti assistivi/browser dichiarati sotto.** Nessuna modifica
applicativa o dipendenza del tester; solo harness ed evidenze. Review visiva e
code review restano controlli indipendenti del coordinatore.

| Verifica effettiva | Risultato |
|---|---|
| `cd frontend && npm run build` | PASS; solo warning Home CSS 6.42 kB preesistente |
| `cd frontend && npm test -- --watch=false` | **101 PASS / 22 file** |
| `cd e2e && npm test` | **22 PASS**, 50 s; disposable rimosso dal runner ufficiale |
| Bundle production statico, API isolate | **220 record finali**, nessun fallimento rimasto |
| Replay Fase 5 sul medesimo production | **172 record / 124 PNG PASS** |
| Soglie/resize/indici | Rerun mirato **30 record PASS**; nessuna modifica app necessaria |
| Zoom 200 reale | Chrome `setZoom(2)`/`getZoom=2`, CSS viewport 1440→720, PNG viewport 1440×900 |
| Assistivo nativo mirato | Orca e AT-SPI effettivamente esercitati su bus privato; evidenze 6/6, audio disattivato |
| `git diff --check` | PASS |

Log: [build](build.txt), [unit](unit.txt), [E2E](e2e.txt), [run production](browser-production.txt),
[rerun resize](resize-final.txt). Risultati consolidati: [checks.json](checks.json),
[failures.json](failures.json), [riconciliazione](verification-reconciliation.json).
La prima run e il rerun mirato sono conservati separatamente: il consolidamento
sostituisce soltanto la famiglia nuovamente verificata, senza inventare esiti.

## Copertura finale

- Home, Login/Register, Dashboard, NewGame, partita, risultato, History, dettaglio,
  profilo e 404 a 1440/768/390/320. Errori, loading/busy, invalid-focus, nomi/ruoli,
  lingua articolo, singolo landmark main e reduced motion.
- Partita 320×740: start/lettura/Path/busy; errori recuperabili/generici nel singolo
  HUD, focus preservato e visibile, indice/infobox completa con heading focalizzato.
- Soglie 349/350/351,599/600/601,679/680/681,799/800/801,999/1000/1001,
  1119/1120/1121. Nessun overflow pagina nelle misure.
- Passaggi reali del router Home→Login→Dashboard→NewGame→partita→Leave→Dashboard,
  alle quattro larghezze, senza cambiare flussi o destinazioni.
- Resize Navbar/Escape e Path verso desktop: focus visibile ripristinato; primo
  Escape con menu rimasto aperto chiude sia dialogo profilo sia Path a 1040 px senza
  consumare il comando nativo. Indici 10–31 delle mosse: **66/66 celle su una riga**
  a 768/390/320, scroll locale conservato.
- Zoom browser reale 200%, cinque schermate: Home, Login, partita, History, Profilo.
  API Chrome e reflow misurato; nessuna sostituzione con pinch, DPR o CSS transform.
  Le prime fullPage erano tagliate dallo strumento sotto zoom: ricatturate come
  viewport completi 1440×900, esaminate dal visual reviewer senza app change.

**280 PNG indipendenti**, più 18 immagini di contesto dell'implementatore escluse
dal conteggio del tester: [indice completo](SCREENSHOTS.json). Blocchi production
stabili notificati al visual reviewer. Origine e fingerprint del bundle:
[production-source.json](production-source.json), [SHA256](production-bundle-sha256.json).

## Prova assistiva effettiva e limiti

Orca è installato ed è stato avviato, non simulato: bus D-Bus/AT-SPI privato,
config/cache/runtime temporanei, impostazioni in memoria e audio/braille disattivati.
Ispezionata soltanto la nostra istanza Chromium, senza leggere applicazioni utente.
Il log Orca riconosce il link ROADTOUNINA, Current password e la descrizione
`Enter your current password.`, il dialogo Delete e Cancel focalizzato. Il tree
AT-SPI nativo conferma `Cancel` focused=true e Orca registra l'output vocale generato
del dialogo/controllo. [Esito mirato](assistive-result.json), [log Orca](orca-debug.txt),
[tree nativo](assistive-atspi-tree.txt), [tentativo isolato](assistive-attempt.txt).

Questa prova automatizzata mirata non è una verifica manuale/uditiva completa o
certificazione di accessibilità. Separatamente è stato interrogato il vero AX tree
Chromium per nomi/ruoli/controlli: non viene presentato come prova screen reader.
Firefox/WebKit non installati, nessun download; dispositivi fisici e confronto su
altri sistemi/font restano da eseguire manualmente prima del merge.

## Metodo e rettifiche del solo harness

Server statico sul bundle production a 127.0.0.1:4500, fallback SPA e nessun proxy;
tutte API intercettate. Gli E2E integrati sono separati, esclusivamente nel DB
disposable autorizzato e con guardie intatte. Campione coerente Fase 5/grafo E2E;
nuovo articolo complesso sanitizzato dal parser locale, nessun MathML non ammesso.
Raw Wikipedia originale e /tmp persi: confronto B per composizione/token/typography,
non pixel sugli stessi dati. Le evidenze reali e 266 link della Fase 4 restano intatte.

Le sole rettifiche dei test riguardano attesa del render ARIA, selettore del toggle
nascosto e posizione di lettura busy; non erano bug applicativi. Il rerun mirato
chiude i casi resize/indici. Nel primo tentativo Orca, la cache isolata spostava il
percorso del browser: corretto puntando al Chromium già installato, senza installazioni.

Harness durevoli e comandi in [HARNESS.md](HARNESS.md). Nessuna prova obbligatoria
rimasta ineseguita; i limiti manuali/multipiattaforma sono esplicitamente dichiarati.

Cleanup assistivo: il primo shutdown incontrava un endpoint temporaneamente disconnesso.
Dopo la terminazione verificata di tutti i nostri processi/bus e in assenza di mount
sotto i soli mkdtemp registrati, rimossa la directory residua di nostra proprietà.
Nessun processo/mount utente toccato: [cleanup finale](assistive-cleanup-final.json).

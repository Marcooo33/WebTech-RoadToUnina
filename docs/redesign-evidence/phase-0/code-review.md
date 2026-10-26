# Fase 0 — review indipendente del codice e della documentazione

Data: 26 ottobre 2026. Branch verificato: `feat/frontend-redesign`.
Base e HEAD osservati: `6e09ba9` (`docs: define frontend redesign design system`).
Reviewer indipendente dall'implementatore e dal tester.

## Esito: PASS

**PASS per il perimetro della review codice/documentazione della Fase 0.** Nessun
problema bloccante rilevato. Questo esito non sostituisce la review visiva
indipendente né autorizza da solo il passaggio di fase o il commit: il registro
deve riportare anche il relativo gate e il commit effettivo.

## Controlli ed evidenze

| Controllo | Evidenza esaminata | Risultato |
| --- | --- | --- |
| Perimetro Git | `git status --short --untracked-files=all`, diff staged/unstaged e `git diff 6e09ba9 --name-only` | Nessuna modifica tracciata: codice applicativo, backend, route/guardie, configurazione e manifest/lock delle dipendenze invariati |
| Documentazione ignorata | `git check-ignore -v docs/redesign-phase-0.md` e ispezione diretta di `docs/` | `/docs` è ignorato da `.gitignore:46`; il diff vuoto non è stato usato come prova dell'assenza dei documenti nuovi |
| Vincoli e inventario | `AGENTS.md`, `frontend/AGENTS.md`, `DESIGN.md`, `docs/redesign-phase-0.md`, route e package frontend | Inventario coerente; risultato come stato della GamePage, redirect `/dashboard`, accessi auth/guest e guardia di uscita preservati |
| Distinzione A/V, P, F | `docs/redesign-phase-0.md`, `docs/design-reference/README.md` | Home B e articolo after identificati come riferimento; pagine operative, varianti e infobox complete restano P; regole, API, autenticazione e timer restano F |
| Integrità dell'archivio | `sha256sum -c docs/design-reference/SHA256SUMS` eseguito dalla directory del manifest; confronto SHA-256 aggiuntivo con le fonti `/tmp` documentate | Tutti i 19 file PASS: 18 PNG e CSS; corrispondenza byte per byte alle fonti |
| Contenuto dell'archivio | Inventario completo di `docs/design-reference/` e lettura CSS/README | Solo riferimenti selezionati, provenienza e checksum; nessuna fixture, HTML, JavaScript, immagine articolo o risorsa di build aggiunta; nessun import/font/URL remoto nel CSS archiviato |
| Baseline prodotta | `TEST-REPORT.md`, `measurements.json`, `requests.json`, `skill-probe.json`, PNG | 89 misure corrispondenti a 89 PNG e larghezze fisiche corrette: 22 per 1440/768/390 e 23 per 320, inclusa la prova 320×740 |
| Build e test | `build.txt`, `unit.txt`, `e2e.txt` | Log coerenti: build completata, 324.48 kB iniziali; 29 test unitari in 17 file; 21 E2E passati in 58 s |
| Sicurezza delle prove | Harness locale `/tmp/roadtounina-redesign-capture.cjs`, `requests.json`, log E2E e guardie `e2e/support/db.ts` | Tutte le API delle catture soddisfatte localmente, richieste esterne bloccate; suite integrata sul disposable `localhost:55432/roadtounina_e2e`; rimozione container/volume documentata nel log |
| Segreti e dati | Lettura dei metadati/testi/log e scansione mirata dei file testuali in `docs/` | Nessuna chiave privata, credenziale DB, bearer token, JWT o assegnazione di segreto individuata; identità campione `audit_e2e@example.test` |

Il CSS è conservato integralmente come riferimento e contiene anche selettori
inerti del prototipo, fra cui `.prototype-controls`. Non è importato dall'app:
README e piano vietano il trasferimento automatico di questi controlli. I dati
campione visibili negli screenshot non sono fixture eseguibili nel frontend.

## Riconciliazione della baseline

Le misure confermano quanto riportato dal tester: 266 link articolo e zero
anchor con `href`/`tabindex`; scrollWidth 401 a viewport 390 e 338 a viewport
320; HUD fuori viewport in lettura a 768/390/320; top −274 e bottom circa 39
nella prova 320×740. Sono difetti preesistenti, registrati e assegnati alla
Fase 4. Non sono regressioni introdotte dalla preparazione documentale e non
devono essere risolti ampliando il perimetro della Fase 0.

L'errore `Unique constraint failed` nel log E2E appartiene al caso intenzionale
di rollback guest, marcato come passato; non contraddice i 21 PASS.

L'inspector autonomo della skill non è passato: i log `inspect-home-failure.txt`
e `inspect-game-failure.txt` mostrano l'uscita di Chrome prima dell'apertura
della pagina. `skill-probe.json` contiene otto probe reali via Playwright sugli
snapshot Angular, non l'esito positivo dell'inspector. La disponibilità del
browser e le catture alle quattro larghezze sono comunque documentate. La
distinzione è esplicita e non viene trasformata in un'approvazione visiva.

## Problemi bloccanti

Nessuno per questa review della Fase 0. Il gate visivo indipendente e la
chiusura del registro restano necessari prima di avanzare.

## Osservazioni non bloccanti

- Il registro `docs/redesign-progress.md` è ancora `IN_PROGRESS` al momento
  della lettura. Prima della chiusura deve associare esiti effettivi delle due
  review, limiti e commit; non anticiparne l'approvazione.
- `docs/` è ignorato: la conservazione nel commit richiede inclusione esplicita
  dei soli artefatti autorizzati. Nessuna modifica a `.gitignore` è necessaria
  per questa fase e nessun file è stato aggiunto all'indice dal reviewer.
- Harness e input della baseline restano sotto `/tmp`, come dichiarato. Sono
  presenti ora e consentono il confronto locale, ma la riproducibilità delle
  catture non è garantita dopo la pulizia di quei percorsi. Le immagini e le
  misure conservate rimangono consultabili; mantenere disponibili gli stessi
  input durante le fasi successive.
- La matrice del piano include più stati delle catture attuali. Il rapporto
  enumera i prefissi realmente prodotti: non prova baseline guest-result,
  auth error/busy/continuazione, tutte le varianti TIME/HARD, form profilo
  invalid/success/error o focus/tastiera completi. Integrare le prove nei gate
  pertinenti senza considerare la matrice una dichiarazione di copertura.

## Verifiche non eseguite da questo reviewer

Non rieseguiti build/unit/E2E: sono stati controllati i log originali, in una
fase priva di cambi applicativi. Non avviati nuovi database né effettuate
scritture API. Non svolta la valutazione visiva degli screenshot, assegnata
al reviewer visivo indipendente. Non provati screen reader, altri browser,
dispositivi fisici, zoom 200%, tutti i viewport intermedi o varianti ancora
non catturate. Nessuna dichiarazione di conformità completa di accessibilità.

Nessuna modifica al codice applicativo, nessun commit e nessuna operazione
di push/merge/rebase eseguiti durante questa review.

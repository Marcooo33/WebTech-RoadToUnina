# Fase 1 — code review indipendente

Data: 26 ottobre 2026. Branch ricontrollato: `feat/frontend-redesign`.
Diff esaminato rispetto a `ba799db`, incluso il nuovo `nav-bar.spec.ts`
non ancora tracciato. Nessuna modifica applicativa o commit del reviewer.

## Esito: PASS

PASS per la review statica del codice. Nessun problema bloccante rilevato.
Build/unit e prove browser del tester, oltre alla review visiva indipendente,
restano gate separati prima del commit e dell'avanzamento.

## Evidenze

| Area | File e righe | Riscontro |
| --- | --- | --- |
| Perimetro | Diff da `ba799db`, stato Git e file untracked | Solo `styles.css`, Navbar, ErrorBanner, LoadingSpinner, spec Navbar e registro autorizzato; nessuna variazione backend, servizi/API/auth, route/guardie, manifest/lock o configurazione |
| Token A/V e proposte P | `frontend/src/styles.css:2` | Palette e famiglie corrispondenti a DESIGN; nessun font remoto; scala `--space-1…8` conservata; primitive riusate, senza sistema CSS concorrente |
| Focus e controlli | `frontend/src/styles.css:94`, `:175`, `:205`, `:235` | Outline cobalto 3 px/offset 4, campi ≥44 px, bottoni ≥48 px, disabled con colori espliciti; cascata disabled prevale anche sugli hover delle varianti |
| Navbar e semantica | `frontend/src/app/shared/components/nav-bar/nav-bar.html:1` | Nome del landmark, toggle nativo con nome/expanded/controls, collegamenti RouterLink nativi e aria-current; azioni e destinazioni auth/anonime/guest conservate |
| Menu e focus | `frontend/src/app/shared/components/nav-bar/nav-bar.ts:64`, `nav-bar.css:108` | Escape chiude e focalizza toggle; uscita verso un controllo esterno chiude senza trattenere il focus; pannello chiuso display:none; nessun focus trap improprio |
| Comportamenti F | `frontend/src/app/shared/components/nav-bar/nav-bar.ts:83` | Logout, navigazione success/error e fonte dello stato AuthService invariati; aggiunte TS limitate alla presentazione e alla tastiera |
| Regressioni pertinenti | `frontend/src/app/shared/components/nav-bar/nav-bar.spec.ts:44` | Cinque casi coprono destinazioni anonime/guest, Escape/focus, uscita dal menu, aria-current e destinazioni/logout autenticati; non sono test di soli valori CSS |
| Feedback | `frontend/src/app/shared/components/error-banner/error-banner.ts:8`, `loading-spinner/loading-spinner.ts:7` | Role alert/status e input conservati; errore con testo unico avvolgibile e icona decorativa; loader 14 px/0,8 s con testo sempre presente |
| Reduced motion | `frontend/src/styles.css:520`, `loading-spinner/loading-spinner.ts:36` | Animazioni/transizioni e smooth scroll disattivati; il testo loading rimane disponibile |
| Scope globale | `frontend/src/styles.css:306`, `:397` | Status torna a flusso testuale normale, coerente con DESIGN; selettori articolo restano circoscritti e invariati; body overflow preesistente non introdotto dalla fase |

`git diff --check ba799db` passa. Ricalcolati i contrasti nominali: testo/bianco
14,75:1; muted/bianco 6,25:1 e canvas 5,78:1; cobalto/bianco 6,70:1;
bordo controllo/bianco 3,42:1 e canvas 3,16:1; muted/disabled 5,52:1.
Testo error/success/warning sui rispettivi fondi: 6,38/6,45/5,60:1.
Questi calcoli confermano le coppie CSS, senza sostituire il rendering degli stati P.

## Problemi bloccanti

Nessuno rilevato nel diff. Overflow e tastiera dei link Wikipedia già registrati
nella baseline restano attività della Fase 4 e non sono attribuiti alla Fase 1.

## Osservazioni non bloccanti e limiti

- Il nuovo breakpoint del menu a 1000 px, i nomi lunghi e il focus non tagliato
  richiedono verifica browser: gli unit test non applicano realmente il layout.
- `onFocusOut` chiude quando `relatedTarget` è un Node esterno; con destinazione
  nulla il menu rimane aperto. Il caso di perdita del focus alla finestra non
  altera le destinazioni e non costituisce un blocco di questa fase.
- Cambiare da menu mobile aperto a viewport desktop lascia `menuOpen=true`;
  Escape può allora tentare il focus sul toggle nascosto. È un caso limite di
  ridimensionamento, non un impedimento nel flusso normale; utile coprirlo nella
  verifica dei viewport intermedi della Fase 6.
- Non rieseguiti build/unit/E2E né prove browser dal reviewer: tester indipendente
  attivo. Non attribuiti qui esiti ancora mancanti o approvazione visiva. Nessuna
  prova screen reader o browser diverso da Chromium svolta in questa review.

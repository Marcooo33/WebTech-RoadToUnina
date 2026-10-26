# Fase 1 — verifica tecnica indipendente

Data: 26 ottobre 2026. Branch verificato: `feat/frontend-redesign`.
Diff applicativo rispetto a `ba799db`: token e primitive in `styles.css`, Navbar,
ErrorBanner, LoadingSpinner, nuovi test Navbar. Nessuna modifica applicativa o
alle dipendenze eseguita dal tester.

**PASS tecnico per il perimetro Fase 1.** Esito complessivo subordinato alle review
indipendenti visiva e del codice; nessuna attribuzione di approvazione P automatica.

| Verifica eseguita | Risultato |
|---|---|
| `cd frontend && npm run build` | PASS; nessun warning di budget |
| `cd frontend && npm test -- --watch=false` | PASS, **34 test / 18 file** |
| `cd e2e && npm test -- auth.spec.ts navigation.spec.ts public.spec.ts` | PASS, **4 test**, 32.9 s |
| Database | Runner ufficiale, solo disposable con guardie esistenti; container e volume rimossi |
| `git diff --check` | PASS |
| Catture medesimi dati baseline | **89** screenshot a 1440/768/390/320×900; gioco anche 320×740 |
| Navbar, focus, attesa e primitive | **38** catture aggiuntive e assert Playwright PASS |

Log: [build](build.txt), [unit](unit.txt), [E2E](e2e.txt), [assert browser](checks.txt).
Dati DOM: [measurements.json](measurements.json), [checks.json](checks.json).

## Prove browser e accessibilità

- Navbar anonima e autenticata alle quattro larghezze: desktop completa a 1440,
  menu collassato a 768/390/320, immagini sia aperto sia chiuso ove applicabile.
- `aria-current="page"` presente sul solo link History durante la relativa rotta.
- Menu: Escape chiude e restituisce il focus al toggle; Tab dall'ultima voce
  esce dalla navigazione e chiude il pannello, senza focus trap. Verificati Tab
  e Shift+Tab dentro il menu. Le destinazioni anonime/autenticate restano coperte
  anche dai nuovi unit test e dagli E2E integrati.
- Target Navbar visibili nelle varianti collassate almeno 44×44; campo 47.58px,
  pulsante primario 48px.
- Campo Login reale focalizzato da tastiera: `:focus-visible`, outline 3px,
  offset 4px, contrasto focus/bianco**6.70:1**, bordo/bianco**3.42:1**.
- Invio Login mantenuto in attesa tramite intercettazione: pulsante realmente
  disabled, opacità**1**, contrasto testo/fondo**5.52:1**, etichetta `Logging in…`.
- ErrorBanner reale dopo risposta errore Login: `role=alert`, contrasto**6.38:1**.
- LoadingSpinner reale della History in caricamento con movimento ridotto:
  `animation-name:none`, testo `Loading completed games…` nel `role=status`.
- Primitive `.status` P renderizzate in un **campione CSS di test aggiunto solo
  al DOM browser**, chiaramente distinto da uno stato applicativo: informazione
  **13.28:1**, avviso**5.60:1**, successo**6.45:1**. Nessuna nuova funzionalità o
  schermata introdotta dal campione. Tutti i rapporti superano 4.5:1.

Le nuove immagini hanno prefissi `navbar-anon/auth-*-closed/open`, `loading-*`,
`field-focus-*`, `login-busy-*`, `login-error-*`, `semantic-primitives-*`.
Le 89 catture originarie conservano i nomi e i dati della Fase 0 per confronto.

## Responsive e regressioni

Confronto automatico delle larghezze DOM con la baseline Fase 0: **nessun nuovo
overflow** nelle schermate catturate. Home, form, History, Dashboard e Profilo
rimangono entro viewport alle quattro larghezze. Gioco conserva esattamente gli
overflow già misurati: `scrollWidth 401` a 390 e `338` a 320, anche 320×740.
HUD non persistente e link Wikipedia non raggiungibili restano difetti baseline,
assegnati esplicitamente alla Fase 4; la Fase 1 non li dichiara risolti.

## Limiti dichiarati

- Rendering browser isolato: tutte API intercettate, richieste esterne bloccate;
  dati audit invariati, articolo Wikipedia completo già sanitizzato con 266 link.
  Non è prova della persistenza o del timer; E2E separati usano backend disposable.
- Le immagini vengono consegnate al visual reviewer indipendente: il tester non
  sostituisce quella review con la sola esistenza dei file.
- Inspector autonomo skill non ripetuto: fallimento d'avvio documentato in Fase 0;
  misure effettuate tramite Playwright funzionante.
- Nessuna verifica screen reader o altro browser in questa fase.
- Prima esecuzione dello script aggiuntivo leggeva `aria-expanded` prima del
  successivo rendering Angular: corretta l'attesa nel solo harness temporaneo,
  nuova esecuzione completa PASS. Nessuna correzione applicativa necessaria.

Harness temporanei riusabili: `/tmp/roadtounina-redesign-capture.cjs` e
`/tmp/roadtounina-phase1-checks.cjs`. Le fixture non sono nel repository/frontend.

# Fase 2 — verifica tecnica indipendente

Data: 26 ottobre 2026. Branch verificato: `feat/frontend-redesign`.
Base di confronto: `e92fe41`. Nessuna modifica applicativa o alle dipendenze da
parte del tester.

**PASS tecnico finale**, dopo aggiornamento matcher E2E e correzione degli spazi
Home. Quality gate complessivo subordinato alle review indipendenti del codice
e visiva; le proposte P dei form non si considerano approvate dalla sola build.

| Verifica finale eseguita | Risultato |
|---|---|
| `cd frontend && npm run build` | PASS; warning noto `home.css` 6.42 kB, oltre soglia warning 4 kB e sotto errore 8 kB; nessun budget modificato |
| `cd frontend && npm test -- --watch=false` | PASS, **43 test / 21 file** |
| `cd e2e && npm test -- auth.spec.ts guest.spec.ts guest-pending.spec.ts` | PASS, **13 test**, 48.1 s |
| Database | Runner ufficiale, solo disposable con guardie esistenti; container e volume rimossi |
| `git diff --check` | PASS |
| Browser Home/autenticazione | **84 verifiche / 84 immagini** a 1440, 768, 390, 320 × 900 |
| Spazi responsive Home | PASS, sei testi alle quattro larghezze dopo i sette `br` corretti |

Log finali: [build](build.txt), [unit](unit.txt), [E2E](e2e.txt),
[browser](checks.txt). Misure: [checks.json](checks.json),
[responsive-whitespace.json](responsive-whitespace.json).
Tutte le immagini correnti sono state **rigenerate dopo l'ultima correzione**;
nessuna cattura del giro iniziale usata come prova finale.

## Scenari browser realmente verificati

Alle quattro larghezze:

- Home base e focus CTA, avvio guest in attesa e in errore, recupero partita attiva,
  risultato guest non salvato, entrambe le conferme di sostituzione e annullamento.
- Login e registrazione base, validazione, focus primo invalido e passaggio al
  successivo invalido, invio busy, errore API; nessun invio API sui form invalidi.
- Hint di registrazione username/password visibili prima dell'invio e associati
  con `aria-describedby`; riferimenti agli errori esistenti nel DOM.
- Continuazione guest dopo login/registrazione riusciti: stato `Finishing guest
  game…`, errore di salvataggio dopo i tentativi esistenti, Retry e Go to Dashboard
  disponibili. I tredici E2E verificano separatamente le transizioni integrate.
- History vuota come sentinella dell'uscita dal frame Home: nessun overflow.

Il form espone `aria-busy` durante invio, CTA realmente disabled con opacità 1;
focus visibile della CTA con outline 3 px. Annullare la sostituzione guest non
produce richieste di creazione. Nessuna azione di gioco simulata è confluita
nell'applicazione.

## Layout e confronto

Misure DOM PASS: Home massimo esterno **1264 px**, padding laterale **32 px**
desktop/tablet, **24 px** a 390 e **20 px** a 320; form massimo **448 px**.
`document.documentElement.scrollWidth === innerWidth` in tutti gli stati catturati.
CTA Home alta almeno 48 px; percorso verticale a 390/320 e destinazione distinta.

Il tester ha esaminato direttamente anche Home 1440 e 320 accanto ai relativi
riferimenti conservati in `docs/design-reference/`: composizione, misura titolo,
colonne/percorso e gerarchia coincidono sostanzialmente con B. Le differenze
comprendono rimozione banner di prototipo e destinazioni reali Navbar/footer/
History, come richiesto dai vincoli funzionali. La review visiva indipendente
esamina inoltre le due larghezze intermedie e le proposte P dei form.

## Correzioni e cronologia verificabile

Primo giro: build PASS, 42 unit PASS, E2E **12 PASS / 1 FAIL**; il solo fallimento
cercava `Reach Federico II`, titolo precedente alla Home B. Segnalato al root;
l'implementatore ha aggiornato i matcher in `e2e/tests/auth.spec.ts:43` e `:52`.
La verifica finale integrata passa tutti i tredici scenari.

La correzione degli spazi dopo i `br` ora garantisce frasi complete quando il
CSS nasconde i ritorni a capo. Aggiunto dall'implementatore un test DOM; il tester
ha verificato nel browser anche i sei testi renderizzati a tutte le larghezze.

Log iniziali conservati con suffisso `-initial.txt`, distinti dagli esiti finali.
Il messaggio Prisma di vincolo duplicato è previsto dal test di rollback guest,
che passa; non indica una regressione non gestita.

## Limiti

- Catture dall'app Angular **development** servita a `127.0.0.1:4400`; build
  **production** eseguita separatamente e riportata sopra.
- API intercettate in tutti i browser di presentazione e rete esterna bloccata.
  Dati guest audit invariati. Solo gli E2E separati esercitano la persistenza,
  esclusivamente nell'ambiente disposable autorizzato.
- Nessuna verifica screen reader, dispositivi fisici o altri browser in questo
  gate; nessuna nuova verifica del timer richiesta dalle sole modifiche Home/auth.
- Warning dimensione CSS Home documentato come non bloccante; dipendenze e budget
  rimangono invariati.

Harness temporaneo: `/tmp/roadtounina-phase2-checks.cjs`; nessuna fixture copiata
nel repository o nel frontend.

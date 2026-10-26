# Fase 5 — review visiva indipendente

26 ottobre 2026. Branch `feat/frontend-redesign`, base `7910114`.
**PASS visuale per le proposte P Result, History, Detail e Profile.** Nessun
problema bloccante rilevato; un rilievo minore documentato sotto. Nessuna modifica
applicativa o commit del visual reviewer.

## Criterio e provenienza

Applicati AGENTS, guida frontend, `DESIGN.md` §§4.6–4.9 e taste skill già letti.
Queste pagine estendono il linguaggio B approvato: valutate palette, tipografia,
spazi, gerarchia, dati completi e azioni esistenti; nessuna equivalenza pixel con
un layout B inesistente per queste schermate.

Esaminate **effettivamente tramite `view_image` tutte le 128 PNG finali** in
questa directory. Viewport 1440/768/390/320×900; molte catture sono full-page.
Set finale stabile notificato dal tester, senza correzioni applicative durante
la fase. Angular development su localhost:4400, API intercettate; harness e
campione nuovi dichiarati in [HARNESS.md](HARNESS.md). Il campione originale
`/tmp` non è disponibile: nessun confronto con input baseline identici dichiarato.

## Immagini realmente viste

Ogni prefisso della tabella è stato aperto con tutti e quattro i suffissi
`-1440.png`, `-768.png`, `-390.png`, `-320.png`.

| Famiglia | Prefissi esaminati | PNG |
| --- | --- | ---: |
| Result | `result-auth-click`, `result-auth-time`, `result-guest-click`, più ciascuno con `-long-path` | 24 |
| History | `history`, `history-time-hard`, `history-page-2`, `history-empty`, `history-error`, `history-loading`, `history-keyboard-focus` | 28 |
| Detail | `detail`, `detail-moves`, `detail-long-path`, `detail-long-moves`, `detail-deleted-player`, `detail-error` | 24 |
| Profile | `profile`, `profile-validation`, `profile-password-mismatch`, `profile-password-busy`, `profile-password-success`, `profile-password-api-error`, `profile-account-busy`, `profile-account-success`, `profile-account-api-error`, `profile-delete-dialog`, `profile-delete-busy`, `profile-delete-error`, `profile-long-identity` | 52 |

## Riscontri

- Result: metrica ufficiale CLICK/TIME dominante, successo con testo/icona,
  destinazione gialla e titolo completo anche a 320. Azioni auth/guest precedono
  il percorso lungo; avviso guest non salvato esplicito. Tutte le tappe e l'arrivo
  rimangono presenti, senza nuove azioni New game.
- History: ranking e metrica primaria riconoscibili; mobile conserva rango,
  giocatore, entrambe le metriche, data e dettaglio. Username lungo va a capo.
  Filtri selezionati hanno bordi/sottolineatura oltre al colore; focus TIME
  visibile. Pagina 2 inizia dal rango 21. Empty, loading ed errore sono leggibili
  senza righe precedenti o Retry aggiunto.
- Detail: titolo identifica una partita conclusa anche per Deleted user; meta
  gialla con bandiera verticale. Percorso di 32 articoli e arrivo conservati a
  tutte le larghezze. Mosse aperte mantengono tutte le righe e cinque colonne;
  a 390/320 lo scorrimento resta locale, con istruzione e focus chiaramente
  visibili. Nessun overflow orizzontale della pagina osservato.
- Profile: identità e form distinti; hint persistenti e messaggi required,
  mismatch e API leggibili vicino al form interessato. Focus invalido visibile,
  busy con testo, successo esplicito. Identità lunga conservata senza clipping.
  Delete dialog, errore e busy restano contenuti nel viewport anche a 320;
  Cancel focalizzato e azioni leggibili. Nessun controllo mostra-password aggiunto.
- Tipo sans, blu delle azioni/focus, superfici chiare e giallo destinazione sono
  coerenti con B e con le fasi precedenti; nessuna decorazione compromette dati.

## Problemi

**Bloccanti: nessuno rilevato nel set esaminato.**

**S3, non bloccante — indici delle mosse a due cifre su più righe.** In
[detail-long-moves-768.png](detail-long-moves-768.png),
[390](detail-long-moves-390.png) e [320](detail-long-moves-320.png), la colonna
`#` stretta separa le cifre degli indici 10–31. Non perde dati o righe e non
impedisce lo scorrimento; riduce la scansione dei numeri. Eventuale rifinitura
futura: mantenere integro l'indice. Nessun ciclo correttivo richiesto per il gate.

## Verifiche e limiti

Esito tecnico separato in [TEST-REPORT.md](TEST-REPORT.md): build PASS, 96 unit,
22 E2E disposable, 172 record browser e supplemento tastiera PASS. Letti report
e `keyboard.json`; le misure target ≥44 e contrasto minimo 6.38:1, il movimento
locale con ArrowRight e il comportamento modale sono evidenze del tester, non
nuove esecuzioni del visual reviewer.

Le immagini dimostrano la resa e gli stati catturati, non annunci screen reader
o ogni posizione di scroll. Non eseguiti dal reviewer test con tecnologie
assistive, altri browser, dispositivi fisici, zoom o rendering production nel
browser. Nessuna verifica della Fase 6 anticipata.

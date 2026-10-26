# Fase 3 — review visiva indipendente

26 ottobre 2026. Diff da `ea8cdcd`; applicati `DESIGN.md` e la skill
`design-taste-frontend` per schermate applicative, con precedenza alla direzione B
approvata. Nessuna modifica applicativa o commit del reviewer.

## Esito: PASS

**Proposte P di Dashboard e NewGame validate visivamente alle quattro larghezze
e negli stati sotto elencati. Nessun bloccante residuo rilevato nel perimetro
della Fase 3.** Palette, superfici, tipografia e controlli estendono coerentemente
B senza aggiungere azioni o alterare le regole del gioco.

## Immagini realmente viste

Aperte mediante `view_image` tutte le **76 immagini** del set finale Angular.
Ogni prefisso seguente è stato esaminato a **1440, 768, 390 e 320 px**:

| Area | Prefissi `{prefisso}-{larghezza}.png` |
| --- | --- |
| Dashboard | `dashboard`, `dashboard-row-focus`, `dashboard-confirm`, `dashboard-delete-busy`, `dashboard-empty`, `dashboard-loading`, `dashboard-error`, `dashboard-limit`, `dashboard-long-title` |
| Configurazione | `new-game-click-easy`, `new-game-click-medium`, `new-game-click-hard`, `new-game-time-easy`, `new-game-time-medium`, `new-game-time-hard`, `new-game-radio-focus`, `new-game-busy`, `new-game-error`, `new-game-limit` |

Le Dashboard sono quelle ricatturate dopo la rettifica del campione. Le 28
immagini NewGame già esaminate prima della ricattura sono state confrontate per
hash e risultano identiche al set finale; i restanti stati sono stati aperti
dopo la notifica finale del tester.

## Riscontri

| Criterio | Esito |
| --- | --- |
| Gerarchia Dashboard | PASS: partite in corso e Resume precedono conclusi e statistiche; Delete resta secondario. Conteggio inline unico, righe e metriche leggibili senza pannelli decorativi |
| Dati e ambiti | PASS: le etichette `Average clicks · CLICK` e `Average time · TIME` chiariscono l'ambito. Le due concluse del campione finale giustificano Completed 2, Best/media CLICK 3 e Best/media TIME 0:42. Dati mancanti rappresentati con trattino, conteggi vuoti con zero |
| Focus e conferma | PASS visivo: outline della riga intero, radio con focus evidente sull'intera label. Conferma, Cancel e `Deleting…` leggibili; a 320 i controlli vanno a capo senza collisioni. CSS prevede conferme ≥44 px; misure browser dei target configurazione ≥44×44 e CTA ≥48 px documentate dal tester |
| Contenuti lunghi | PASS: username, titolo lungo e stringa indivisibile conservati. L'aumento di altezza a 320 è preferibile al taglio; azioni rimangono raggiungibili e separate |
| Vuoto/loading/errore | PASS visivo: stato vuoto con invito valido anche al ritorno, caricamento con testo, errore leggibile e distinguibile dal caricamento. Nessuna sovrapposizione fino a 320 |
| Limite Dashboard | PASS: 10/10, spiegazione e New game disabilitato; le dieci righe mantengono Resume/Delete e allineamento anche in colonna mobile |
| Configurazione P | PASS: gruppi Mode/Difficulty chiari, cinque radio nativi, sei combinazioni visivamente distinte tramite radio, bordo e fondo. Default CLICK/EASY; nessun badge sovrapposto; istruzioni vicine e CTA unica |
| Busy/API error/limite | PASS: `Creating…` conserva le selezioni; errore generico non tronca il form. GAME_LIMIT mostra una sola frase continua con link inline, senza duplicato o disposizione a colonne; CTA disabilitata leggibile |
| Responsive | PASS nel campione: nessun taglio laterale o collisione. Il tester conferma `scrollWidth === innerWidth` in tutti gli stati catturati |

## Critica e osservazioni non bloccanti

La prima lettura risponde a “quale percorso riprendo?” nella Dashboard e a
“quali regole scelgo?” nella configurazione. Resume domina la propria riga,
New game la testata; statistiche e azioni distruttive hanno peso inferiore.
La griglia segue i dati reali, i numeri hanno ambito esplicito, zero e assenza
sono distinti. Cobalto e rosso mantengono i rispettivi ruoli; il giallo della
destinazione non viene usato per selezionare i radio. A 320 la struttura si
impila conservando contenuto e controlli. Nessun difetto visivo nuovo da correggere.

Risolta durante la review un'incoerenza delle sole fixture: il primo campione
mostrava metriche TIME senza una conclusa TIME. Il tester ha corretto il proprio
harness e rigenerato tutte le immagini; nessun calcolo o codice app modificato.
La rettifica è dettagliata in [TEST-REPORT.md](TEST-REPORT.md).

## Limiti

Review delle immagini e dei riscontri del tester, senza ripetere interazioni o
suite. Build production, 49 unit, 3 E2E disposable e 84 record browser PASS sono
prove tecniche separate in [TEST-REPORT.md](TEST-REPORT.md). Le immagini provengono
da Angular **development** con API intercettate: non attestano rendering
production, persistenza o timer. Nessun PASS dell'inspector autonomo attribuito;
rimane il fallback Playwright già documentato. Non verificati qui screen reader,
zoom 200%, altri browser, dispositivi fisici o tutti i viewport intermedi.
I difetti del gioco registrati nella baseline restano nel gate della Fase 4.

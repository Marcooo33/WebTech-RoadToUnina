# ROADTOUNINA

**Riesci a raggiungere la Federico II partendo da un articolo casuale di Wikipedia?**

> Progetto universitario realizzato per il corso di Web Technologies.

ROADTOUNINA è un gioco di navigazione ispirato alle Wikipedia Speedrun: segui i
collegamenti tra gli articoli di Wikipedia fino a raggiungere
l'Università degli Studi di Napoli Federico II.


**[Gioca a ROADTOUNINA](https://roadtounina-ouva.onrender.com/)** — puoi provare subito, senza registrarti.

![Homepage di ROADTOUNINA](assets/screenshots/landing.png)

## Come si gioca

1. Parti da una voce casuale di Wikipedia.
2. Segui i link interni agli articoli per costruire un percorso verso la Federico II.
3. Raggiungi la voce dell'Università e scopri quanti click e quanto tempo hai impiegato.

Puoi cercare il percorso più breve in modalità **Click** oppure mettere alla prova
la tua velocità in modalità **Tempo**. Le tre difficoltà cambiano la possibilità
di tornare indietro lungo il percorso.

La partita di prova è in modalità **Click / Facile**. Dopo la vittoria puoi
registrarti o accedere per salvare il risultato e il percorso. Con un account
puoi scegliere modalità e difficoltà, consultare la cronologia delle partite,
seguire le tue statistiche e confrontare i risultati nelle classifiche pubbliche.

> Il sito è ospitato su Render con un piano gratuito: il primo accesso dopo un
> periodo di inattività può richiedere qualche istante.

## Il progetto

ROADTOUNINA unisce un'interfaccia Angular, un'API REST in Express e un database
PostgreSQL. Gli articoli e i collegamenti provengono dalle API di Wikipedia;
il backend gestisce le regole della partita, la validazione delle mosse e il
salvataggio dei percorsi.

| Area | Tecnologie |
| --- | --- |
| Frontend | Angular, TypeScript, RxJS, CSS |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL, Prisma ORM |
| Autenticazione | JWT, bcrypt |
| Test | Vitest, test runner Node.js, Playwright |
| Deploy e CI | Render, Supabase, GitHub Actions |

Il repository comprende l'intero flusso dell'applicazione: dalla partita come
ospite al salvataggio dopo l'accesso, fino a cronologia, statistiche e classifiche.
I test coprono frontend e backend; la suite end-to-end usa un database temporaneo
e risposte Wikipedia deterministiche. GitHub Actions esegue test e build prima
del deploy.

## Esplora il codice

- [Frontend](frontend/src/app): schermate di gioco, autenticazione e area personale.
- [Backend](backend/src): API, motore di gioco e integrazione con Wikipedia.
- [Schema del database](backend/prisma/schema.prisma): modelli e relazioni dei dati.
- [Test end-to-end](e2e/tests): scenari di utilizzo con Playwright.


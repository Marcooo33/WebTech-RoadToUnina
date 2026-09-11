# ROADTOUNINA — Game Rules

## 1. Purpose

ROADTOUNINA is a web game in which authenticated users start from a random Italian Wikipedia article and must reach the Wikipedia page dedicated to the University of Naples Federico II by navigating only through valid internal links contained in the current article.

The game state must be persistent on the server so that a player can leave a game and resume it later, including from another device.

Completed games are publicly browsable.

---

## 2. Target Page

The target is the Italian Wikipedia article for:

**Università degli Studi di Napoli Federico II**

Victory must be determined server-side using the stable MediaWiki page identifier, not by trusting the page title supplied by the frontend.

The backend must define the target page identifier as a configuration constant.

---

## 3. Game Status

A game has only two statuses in the initial version:

- `IN_PROGRESS`
- `COMPLETED`

A game becomes `COMPLETED` only when the player reaches the target page.

Leaving the browser, closing the tab, or logging out does **not** complete or abandon the game. The game remains `IN_PROGRESS`.

There is no `ABANDONED`, `LOST`, or `PAUSED` game status in the initial version.

---

## 4. Maximum Number of Open Games

Each user may have at most:

**10 games with status `IN_PROGRESS`**

If the user already has 10 in-progress games, creating another game must be rejected.

To create a new game, the user must either:

- complete one of the existing games; or
- delete one of the existing in-progress games.

Only `IN_PROGRESS` games may be deleted by their owner.

Completed games must not be deletable by normal users because they belong to the public game history and may contribute to rankings and statistics.

---

## 5. Game Modes

ROADTOUNINA has two game modes.

### 5.1 CLICK

Primary objective:

> Reach the target using the fewest valid navigation clicks possible.

Primary score:

`clickCount`

Lower is better.

Elapsed play time may be used as a tie-breaker.

### 5.2 TIME

Primary objective:

> Reach the target using the lowest effective play time possible.

Primary score:

`effectivePlayTimeMs`

Lower is better.

Click count may be used as a tie-breaker.

The core navigation rules are identical in CLICK and TIME modes. Only the ranking criterion changes.

---

## 6. Difficulty Levels

Each game has one difficulty.

### EASY

Backtracking is unlimited.

### MEDIUM

The player may use the explicit backtracking action at most 3 times.

### HARD

Backtracking is forbidden.

These rules are enforced by the backend.

---

## 7. Navigation Rules

A navigation click counts only when the player follows a valid internal Wikipedia article link from the current article.

Valid navigation links must refer to eligible encyclopedia articles inside Italian Wikipedia.

Examples of links that must not count as game navigation include:

- external websites;
- bibliography links;
- citation/note anchors;
- references;
- Wikimedia Commons links;
- category pages;
- language-switch links;
- edit/history/help/special pages;
- other links excluded by the backend's MediaWiki filtering rules.

The frontend must never decide whether a move is valid.

For every move, the backend must verify that the requested target page is actually reachable through a valid internal link from the current page.

---

## 8. Sandboxing

The game experience must remain sandboxed inside ROADTOUNINA.

The user must not navigate directly to arbitrary websites through article content.

Angular must not treat Wikipedia links as normal browser navigation.

Instead:

1. the backend retrieves and normalizes Wikipedia content;
2. valid internal links are identified;
3. article content is sanitized;
4. navigation actions are handled by the ROADTOUNINA frontend;
5. the backend validates and applies the move.

Angular must not communicate directly with MediaWiki for authoritative game actions.

---

## 9. Click Counting

`clickCount` is managed exclusively by the backend.

A successful `NAVIGATION` move increments:

`clickCount += 1`

A backtracking action does **not** increment `clickCount`.

Reloading the page, reopening the game route, or requesting the current article does not increment `clickCount`.

The frontend must never send an authoritative click count to the backend.

---

## 10. Backtracking

Backtracking is a dedicated game action, separate from normal Wikipedia navigation.

Example:

`A -> B -> C -> D`

Using BACK changes the active path to:

`A -> B -> C`

The database must retain the complete history. The movement from `D` back to `C` is stored as a `BACKTRACK` move.

If the player later follows a link from `C` to `E`, the active path becomes:

`A -> B -> C -> E`

The historical visit to `D` is not deleted from the event history.

If a player follows a normal Wikipedia link to a page that was visited before, that is still a normal `NAVIGATION`, not a backtracking action.

---

## 11. Game Move History

Game actions are stored in chronological order.

Supported initial move types:

- `NAVIGATION`
- `BACKTRACK`

Every move has a per-game sequence number.

The move history must make it possible to reconstruct:

- all navigation actions;
- all backtracking actions;
- the active path;
- click count;
- backtracking count.

---

## 12. Effective Play Time

ROADTOUNINA measures **effective game time**, not wall-clock time since game creation.

Example:

- play from 18:00 to 18:07;
- close the game;
- return at 18:37;
- play from 18:37 to 18:45.

Effective play time:

`7 minutes + 8 minutes = 15 minutes`

The 30 minutes spent outside the game must not count.

### How it is tracked

There is **no persistent play-session entity**. Effective play time is
server-authoritative and stored with three fields directly on `Game`:

| Field | Meaning |
|---|---|
| `effectivePlayTimeMs` | Play time already finalized/accounted. The authoritative value for completed games, History rankings and statistics. |
| `playStartedAt` | Start of the current unfinalized play interval. `null` when nothing is pending. |
| `lastHeartbeatAt` | Most recent proof the player was active — a heartbeat, or a valid move/backtrack. |

Rules:

- **Opening / resuming an in-progress game** (`GET /api/games/:id` by the owner)
  finalizes any pending interval up to its `lastHeartbeatAt`
  (`effectivePlayTimeMs += lastHeartbeatAt - playStartedAt`), then starts a fresh
  interval (`playStartedAt = lastHeartbeatAt = now`). The offline gap between the
  last heartbeat and reopening is never counted.
- **Heartbeat** (`POST /api/games/:id/heartbeat`, roughly every 12 s while
  playing) only sets `lastHeartbeatAt = now`. It creates nothing and changes
  nothing else.
- **A valid move or backtrack** also sets `lastHeartbeatAt = now` in the same
  transaction — a real action is stronger proof of activity than a heartbeat.
- **The winning move** finalizes the last interval up to now
  (`effectivePlayTimeMs += now - playStartedAt`) inside the completion
  transaction, then clears `playStartedAt` and `lastHeartbeatAt`.
- A stale `lastHeartbeatAt` is just data — there is no expiration process and no
  state transition. If a browser disappears, the time after the last heartbeat is
  simply not counted when the game is next opened.

The frontend timer is display-only: it animates
`effectivePlayTimeMs + (now - clientBaseline)` locally for smoothness and is
never sent back. The server remains authoritative for the official time.

---

## 14. Refresh and Multiple Tabs

Refreshing the same active game must preserve its current server-side state; the
frontend reloads the authoritative state from the backend, which also
re-establishes the timing interval (see §12).

Game state is persistent because of `Game` + `GameMove`, not because of any
session record. Opening the same game again — in the same tab, another tab, or
another device — simply finalizes the previous interval and starts a new one.

Simultaneous play from multiple tabs/devices is not a project requirement and is
not specially coordinated. There is no "one active session" rule, no version
field, and no locks. Ordinary database transactions and authoritative backend
checks keep game state consistent.

---

## 15. Persistent Resume

Users may have multiple `IN_PROGRESS` games.

The dashboard must display them and allow the user to resume any one of them.

Resuming a game restores at least:

- current page;
- active path/history;
- click count;
- backtracking count;
- mode;
- difficulty;
- effective play time (finalized so far).

---

## 16. Random Starting Page

The starting page must be selected randomly from eligible Italian Wikipedia articles.

The backend should reject unsuitable starting-page candidates.

Initial filtering criteria should include at least:

- main article namespace;
- no redirects where possible;
- reasonable article size;
- sufficient valid internal article links;
- exclusion of problematic/non-article pages.

Do not attempt to construct or crawl the complete Wikipedia graph in the initial version.

Difficulty is defined by backtracking rules, not by calculating graph distance from the target.

---

## 17. Completion

After every accepted navigation, the backend checks whether the new page is the configured target page.

If yes:

1. the game becomes `COMPLETED`;
2. `completedAt` is set;
3. the final play interval is finalized into `effectivePlayTimeMs` (up to the moment of the winning move) and `playStartedAt` / `lastHeartbeatAt` are cleared;
4. all of the above is persisted atomically in one transaction;
5. the completed game becomes eligible for public history;
6. the game receives a position in the relevant History ranking view.

The frontend must not be able to mark a game as completed directly.

---

## 18. History Ranking Views

History is the public collection of completed games. It has separate CLICK and
TIME ranking views, and every entry can be opened to inspect the completed game.

Difficulty levels must also remain separate because EASY, MEDIUM, and HARD provide different gameplay conditions.

Conceptually there are six ranking combinations:

- CLICK / EASY
- CLICK / MEDIUM
- CLICK / HARD
- TIME / EASY
- TIME / MEDIUM
- TIME / HARD

The UI represents these as two tabs plus a difficulty filter. Each combination
is paginated so the entire matching collection remains browsable; it is not
limited to an arbitrary Top N.

### CLICK ordering

Primary:
`clickCount ASC`

Tie-breaker:
`effectivePlayTimeMs ASC`

### TIME ordering

Primary:
`effectivePlayTimeMs ASC`

Tie-breaker:
`clickCount ASC`

History ranking data must be derived from completed games rather than stored in a separate authoritative ranking table.

---

## 19. Public and Authenticated Capabilities

Unauthenticated users may:

- browse completed games;
- inspect completed-game details;
- switch between CLICK and TIME History rankings and filter by difficulty;
- view the landing/how-to-play experience.

Authenticated users may additionally:

- create games;
- resume their games;
- delete their own in-progress games;
- play;
- view their personal dashboard and statistics.

Only the owner may mutate an in-progress game.

---

## 20. Core Authority Rule

**The backend is the only authority over game state.**

The frontend may request actions and display state, but it must not authoritatively decide:

- valid moves;
- click count;
- backtracking count;
- official play time;
- game completion;
- current page;
- game status;
- rankings.

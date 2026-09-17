# ROADTOUNINA — Database Design

## 1. Database

Database engine:

**PostgreSQL**

Hosting:

**Supabase**

ORM:

**Prisma**

Prisma schema and versioned migrations are the project's source of truth for database structure.

Avoid creating production schema changes manually through the Supabase Table Editor once migrations are established.

---

## 2. Main Entities

Initial domain model:

```text
User
  │ 1
  │
  │ N
Game
  │ 1
  │
  │ N
GameMove
```

Initial entities:

- `User`
- `Game`
- `GameMove`

Effective play time is tracked with three fields directly on `Game` — there is
no separate play-session table (see §7).

Do not create initial tables for:

- History rankings;
- UserStatistics;
- WikipediaPage.

Those are derived or external data in the initial architecture.

---

## 3. Enums

```prisma
enum GameMode {
  CLICK
  TIME
}

enum GameDifficulty {
  EASY
  MEDIUM
  HARD
}

enum GameStatus {
  IN_PROGRESS
  COMPLETED
}

enum GameMoveType {
  NAVIGATION
  BACKTRACK
}
```

---

## 4. User

Purpose:

Stores the ROADTOUNINA application account.

Fields:

| Field | Type | Constraints |
|---|---|---|
| id | UUID | primary key |
| username | varchar(30) | unique, required |
| email | varchar(255) | unique, required |
| passwordHash | varchar(255) | required |
| avatarUrl | text | nullable |
| createdAt | timestamptz | required |
| updatedAt | timestamptz | required |
| deletedAt | timestamptz | nullable; set when an account is soft-deleted |

Relations:

`User 1 -> N Game`

Password hashes, never plaintext passwords, are stored.

Email normalization should be enforced at application level before insertion.

Application account deletion is a soft deletion. Deleted accounts keep their
User row so completed games retain their owner relation, but identifying and
authentication fields are replaced with internal tombstones. Those tombstones
must never be exposed through public APIs.

---

## 5. Game

Purpose:

Stores the authoritative current state and aggregate score of a game.

Fields:

| Field | Type | Description |
|---|---|---|
| id | UUID | primary key |
| userId | UUID | owner FK |
| mode | GameMode | CLICK or TIME |
| difficulty | GameDifficulty | EASY/MEDIUM/HARD |
| status | GameStatus | IN_PROGRESS/COMPLETED |
| startPageId | integer | starting MediaWiki page id |
| startPageTitle | text | starting page title snapshot |
| currentPageId | integer | current MediaWiki page id |
| currentPageTitle | text | current page title snapshot |
| clickCount | integer | successful NAVIGATION actions |
| backtrackCount | integer | BACKTRACK actions used |
| effectivePlayTimeMs | integer | finalized official active play time (see §8) |
| playStartedAt | timestamptz? | start of the current unfinalized play interval; `null` when nothing is pending |
| lastHeartbeatAt | timestamptz? | most recent proof of activity (heartbeat or gameplay action) |
| startedAt | timestamptz | game creation/start |
| completedAt | timestamptz? | completion time |
| createdAt | timestamptz | row creation |
| updatedAt | timestamptz | last update |

Relations:

- belongs to `User`;
- has many `GameMove`.

### Important semantic rules

`COMPLETED` means the target page was reached.

`IN_PROGRESS` games may be resumed later.

A user may have at most 10 `IN_PROGRESS` games. This limit is a domain invariant enforced transactionally by the backend; it is not represented by a `maxGames` field.

Only `IN_PROGRESS` games may be deleted through normal user operations.

Deleting an in-progress game cascade-deletes its moves.

---

## 6. GameMove

Purpose:

Stores the complete chronological game event history.

Fields:

| Field | Type | Description |
|---|---|---|
| id | UUID | primary key |
| gameId | UUID | game FK |
| sequence | integer | chronological position within game |
| type | GameMoveType | NAVIGATION/BACKTRACK |
| fromPageId | integer | origin MediaWiki id |
| fromPageTitle | text | origin title snapshot |
| toPageId | integer | destination MediaWiki id |
| toPageTitle | text | destination title snapshot |
| createdAt | timestamptz | event time |

Constraints:

- `(gameId, sequence)` unique;
- `sequence > 0`.

Relations:

`Game 1 -> N GameMove`

Deletion:

Deleting a game cascades to all of its moves.

### Active path reconstruction

The active path is not stored in a separate table initially.

It can be reconstructed in sequence order:

- NAVIGATION => push destination;
- BACKTRACK => pop previous active node.

Historical events are never deleted merely because the user backtracked.

---

## 7. Effective Play Time

There is no play-session table. Effective play time is server-authoritative and
tracked with three fields on `Game`:

| Field | Meaning |
|---|---|
| `effectivePlayTimeMs` | Play time already finalized/accounted. Authoritative for completed games, History rankings and statistics. |
| `playStartedAt` | Start of the current unfinalized play interval. `null` when nothing is pending. |
| `lastHeartbeatAt` | Most recent proof the current playable interval was active; a heartbeat advances it and a successful article transition resets it with the new interval. |

### The algorithm

**Open / resume** (`GET /api/games/:id` by the owner, game `IN_PROGRESS`): first
capture the preparation-start boundary and prepare the current article, then use
a short transaction-local row lock for the timing read/update:

```text
boundary = min(lastHeartbeatAt, preparationStartedAt)
if playStartedAt is not null and boundary > playStartedAt:
    effectivePlayTimeMs += boundary - playStartedAt          # finalize stale interval
playStartedAt   = now
lastHeartbeatAt = now  # final transaction write after response state is loaded
```

**Heartbeat** (`POST /api/games/:id/heartbeat`, ~every 12 s while playing):

```text
lastHeartbeatAt = now
```

**Valid move / backtrack** — the games router captures `navigationStartedAt`
before asynchronous authentication. A successful article transition splits the
active interval in the same transaction as the game mutation:

```text
effectivePlayTimeMs += navigationStartedAt - playStartedAt
persist game mutation and GameMove
load authoritative response state
playStartedAt   = restartedAt       # final database write in the transaction
lastHeartbeatAt = restartedAt
```

The timestamps are server-controlled and the update is atomic with the move.
Rejected or failed actions leave the continuous interval unchanged.

**Winning move** — inside the completion transaction:

```text
effectivePlayTimeMs += navigationStartedAt - playStartedAt   # 0 if null
status = COMPLETED; completedAt = now
playStartedAt = null; lastHeartbeatAt = null
```

There is **no expiration process** and no state transition: a stale
`lastHeartbeatAt` is just data, used only to bound the interval at the next open.
If a browser disappears, the time after the last heartbeat is not counted.

The TIME History view uses `effectivePlayTimeMs`, never `completedAt - startedAt`.

The frontend timer is display-only and never authoritative.

---

## 8. Concurrency

There is no `Game.version` field, optimistic-concurrency token, or persistent
lock/lease. Simultaneous multi-tab / multi-device editing is not a project
requirement.

A navigation move updates the `Game` row and appends a `GameMove` in one
transaction; completion also finalizes timing in that same transaction. After
MediaWiki preparation, move/backtrack transactions briefly lock the game row and
verify that the source page, counters and timing interval still match their
prepared snapshot. A stale operation is rejected rather than applied to a newer
state. The prepared-state GET and heartbeat use the same short lock so their
timing read/update steps cannot overwrite each other.

---

## 9. Constraints

Recommended PostgreSQL constraints beyond Prisma's basic schema:

```sql
ALTER TABLE "games"
ADD CONSTRAINT "games_click_count_non_negative"
CHECK ("click_count" >= 0);

ALTER TABLE "games"
ADD CONSTRAINT "games_backtrack_count_non_negative"
CHECK ("backtrack_count" >= 0);

ALTER TABLE "games"
ADD CONSTRAINT "games_play_time_non_negative"
CHECK ("effective_play_time_ms" >= 0);

ALTER TABLE "game_moves"
ADD CONSTRAINT "game_moves_sequence_positive"
CHECK ("sequence" > 0);
```

Game completion consistency:

```sql
ALTER TABLE "games"
ADD CONSTRAINT "games_completion_consistency"
CHECK (
  (
    "status" = 'IN_PROGRESS'
    AND "completed_at" IS NULL
  )
  OR
  (
    "status" = 'COMPLETED'
    AND "completed_at" IS NOT NULL
  )
);
```

---

## 10. Indexes

Recommended initial indexes should correspond to actual application queries.

### User dashboard

Retrieve a user's games by status:

```text
(userId, status)
```

### Public completed History

```text
(status, completedAt)
```

### CLICK History ranking

```text
(status, mode, difficulty, clickCount)
```

### TIME History ranking

```text
(status, mode, difficulty, effectivePlayTimeMs)
```

### Game move history

```text
(gameId, sequence)
```

Do not add indexes speculatively without a query that benefits from them.

---

## 11. Prisma Reference Schema

This is the approved Prisma model.

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
}

enum GameMode {
  CLICK
  TIME
}

enum GameDifficulty {
  EASY
  MEDIUM
  HARD
}

enum GameStatus {
  IN_PROGRESS
  COMPLETED
}

enum GameMoveType {
  NAVIGATION
  BACKTRACK
}

model User {
  id           String   @id @default(uuid()) @db.Uuid
  username     String   @unique @db.VarChar(30)
  email        String   @unique @db.VarChar(255)
  passwordHash String   @map("password_hash") @db.VarChar(255)
  avatarUrl    String?  @map("avatar_url") @db.Text

  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(3)
  deletedAt DateTime? @map("deleted_at") @db.Timestamptz(3)

  games Game[]

  @@map("users")
}

model Game {
  id     String @id @default(uuid()) @db.Uuid
  userId String @map("user_id") @db.Uuid

  mode       GameMode
  difficulty GameDifficulty
  status     GameStatus @default(IN_PROGRESS)

  startPageId    Int    @map("start_page_id")
  startPageTitle String @map("start_page_title") @db.Text

  currentPageId    Int    @map("current_page_id")
  currentPageTitle String @map("current_page_title") @db.Text

  clickCount          Int @default(0) @map("click_count")
  backtrackCount      Int @default(0) @map("backtrack_count")
  effectivePlayTimeMs Int @default(0) @map("effective_play_time_ms")

  playStartedAt   DateTime? @map("play_started_at") @db.Timestamptz(3)
  lastHeartbeatAt DateTime? @map("last_heartbeat_at") @db.Timestamptz(3)

  startedAt   DateTime  @default(now()) @map("started_at") @db.Timestamptz(3)
  completedAt DateTime? @map("completed_at") @db.Timestamptz(3)

  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(3)

  user  User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  moves GameMove[]

  @@index([userId, status])
  @@index([status, completedAt])
  @@index([status, mode, difficulty, clickCount])
  @@index([status, mode, difficulty, effectivePlayTimeMs])

  @@map("games")
}

model GameMove {
  id     String @id @default(uuid()) @db.Uuid
  gameId String @map("game_id") @db.Uuid

  sequence Int
  type     GameMoveType

  fromPageId    Int    @map("from_page_id")
  fromPageTitle String @map("from_page_title") @db.Text

  toPageId    Int    @map("to_page_id")
  toPageTitle String @map("to_page_title") @db.Text

  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(3)

  game Game @relation(fields: [gameId], references: [id], onDelete: Cascade)

  @@unique([gameId, sequence])
  @@index([gameId, sequence])

  @@map("game_moves")
}
```

Depending on the installed Prisma version, datasource URLs may belong in `prisma.config.ts` rather than inside `schema.prisma`. Follow the installed version's supported configuration while preserving the data model above.

---

## 12. Supabase / Prisma Workflow

Expected workflow:

1. define/update `schema.prisma`;
2. generate a Prisma migration (`prisma migrate dev --create-only` when the migration needs hand-edited SQL, e.g. dropping an enum or a table);
3. add required PostgreSQL-specific custom constraints/indexes to the migration when Prisma cannot express them;
4. apply migration to Supabase PostgreSQL;
5. commit `schema.prisma`, the migration, and the regenerated client under `backend/src/generated/prisma/`;
6. never commit database secrets.

Migrations are forward-only. The `game_sessions` table, the `GameSessionStatus`
enum, the `one_active_session_per_game` partial unique index and the
`Game.version` column were removed by
`20260905120000_remove_sessions_and_version`; `0_init` is not rewritten.

Runtime and migration connection strings may differ depending on Supabase pooling configuration.

Secrets belong in `.env`, while `.env.example` contains placeholders only.

### Test databases (never Supabase)

Automated tests never touch the Supabase database. Both test suites run against a
single local Docker PostgreSQL 17 instance (`e2e/docker-compose.yml`, host port
`55432`) holding two **separate** databases:

```text
Supabase PostgreSQL        -> application / production
Local Docker PostgreSQL
  ├── roadtounina_e2e         -> Playwright E2E suite  (e2e/)
  └── roadtounina_integration -> backend integration suite (backend/tests/)
```

Both databases are schema-managed the same way as production: `prisma migrate
deploy` against the target `DATABASE_URL`. Each suite has a positive allow-list
guard (`e2e/support/db.ts`, `backend/tests/support/db.ts`) that aborts before any
migration or destructive query unless the connection string is exactly its own
local database — so a suite can never migrate or delete data in Supabase or in
the other suite's database.

---

## 13. Deletion Policy

Normal application behavior:

### User deletes an IN_PROGRESS game

Delete:

- Game;
- related GameMoves via cascade.

### COMPLETED game

Not deletable by its normal owner.

This preserves public history, rankings, and derived statistics.

### User deletes their account

In one transaction:

- set `User.deletedAt`;
- replace username and email with unique internal tombstones;
- replace the password hash with a bcrypt hash of a random secret and clear the avatar;
- delete the user's `IN_PROGRESS` games (their moves cascade);
- retain `COMPLETED` games and their moves.

Public History renders retained games under the neutral identity `Deleted user`.
The original username and normalized email become available for registration.
The required `Game.userId` relation remains unchanged. A direct physical User
deletion would still cascade to every Game, but it is not the application
account-deletion operation.

---

## 14. Derived Data

Do not create an authoritative History ranking table initially.

History rankings are queries over completed `Game` rows.

Do not create `UserStatistics` initially.

Statistics such as:

- number of completed games;
- best click score;
- best time;
- average clicks;
- average effective time

can be queried from games.

Optimization/caching may be considered later if measurements justify it.

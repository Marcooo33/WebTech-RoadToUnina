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
  │
  ├───────────────┐
  │ 1             │ 1
  │               │
  │ N             │ N
GameMove       GameSession
```

Initial entities:

- `User`
- `Game`
- `GameMove`
- `GameSession`

Do not create initial tables for:

- Leaderboard;
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

enum GameSessionStatus {
  ACTIVE
  ENDED
  EXPIRED
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

Relations:

`User 1 -> N Game`

Password hashes, never plaintext passwords, are stored.

Email normalization should be enforced at application level before insertion.

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
| effectivePlayTimeMs | integer | aggregate official active play time |
| version | integer | optimistic concurrency version |
| startedAt | timestamptz | game creation/start |
| completedAt | timestamptz? | completion time |
| createdAt | timestamptz | row creation |
| updatedAt | timestamptz | last update |

Relations:

- belongs to `User`;
- has many `GameMove`;
- has many `GameSession`.

### Important semantic rules

`COMPLETED` means the target page was reached.

`IN_PROGRESS` games may be resumed later.

A user may have at most 10 `IN_PROGRESS` games. This limit is a domain invariant enforced transactionally by the backend; it is not represented by a `maxGames` field.

Only `IN_PROGRESS` games may be deleted through normal user operations.

Deleting an in-progress game should cascade-delete its moves and sessions.

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

## 7. GameSession

Purpose:

Stores each period of effective active play.

Fields:

| Field | Type | Description |
|---|---|---|
| id | UUID | primary key |
| gameId | UUID | game FK |
| status | GameSessionStatus | ACTIVE/ENDED/EXPIRED |
| startedAt | timestamptz | session start |
| endedAt | timestamptz? | official session end |
| lastHeartbeatAt | timestamptz | latest confirmed active heartbeat |
| createdAt | timestamptz | row creation |

Relations:

`Game 1 -> N GameSession`

Deletion:

Deleting a game cascades to all sessions.

### Single active session invariant

A game may have at most one ACTIVE session.

This should be protected by PostgreSQL using a partial unique index:

```sql
CREATE UNIQUE INDEX "one_active_session_per_game"
ON "game_sessions" ("game_id")
WHERE "status" = 'ACTIVE';
```

The backend must enforce the rule too, but the database constraint is the final protection.

---

## 8. Effective Play Time

`effectivePlayTimeMs` is stored on `Game` as an intentional aggregate/denormalization for efficient ranking queries.

Detailed timing remains represented by `GameSession`.

For a normal ended session:

`duration = endedAt - startedAt`

For a session that expires because heartbeats stop, the official effective end should normally correspond to the last confirmed heartbeat rather than the later timeout-detection moment.

Updates to:

- session status/end;
- `Game.effectivePlayTimeMs`

should be made consistently, preferably in the same transaction when appropriate.

The TIME leaderboard must use effective play time, never:

`completedAt - startedAt`

---

## 9. Optimistic Concurrency

`Game.version` starts at `0`.

State-changing operations verify the expected version.

Conceptual update:

```text
client sends expected version 7
database currently version 7
    -> mutation succeeds
    -> version becomes 8
```

If the database version no longer matches the expected version, the mutation must fail rather than silently overwriting newer state.

Expected API behavior: HTTP `409 Conflict`.

---

## 10. Constraints

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

ALTER TABLE "games"
ADD CONSTRAINT "games_version_non_negative"
CHECK ("version" >= 0);

ALTER TABLE "game_moves"
ADD CONSTRAINT "game_moves_sequence_positive"
CHECK ("sequence" > 0);

ALTER TABLE "game_sessions"
ADD CONSTRAINT "game_sessions_dates_valid"
CHECK (
  "ended_at" IS NULL
  OR "ended_at" >= "started_at"
);
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

## 11. Indexes

Recommended initial indexes should correspond to actual application queries.

### User dashboard

Retrieve a user's games by status:

```text
(userId, status)
```

### Public completed history

```text
(status, completedAt)
```

### CLICK leaderboard

```text
(status, mode, difficulty, clickCount)
```

### TIME leaderboard

```text
(status, mode, difficulty, effectivePlayTimeMs)
```

### Game move history

```text
(gameId, sequence)
```

### Sessions

```text
gameId
(status, lastHeartbeatAt)
```

Do not add indexes speculatively without a query that benefits from them.

---

## 12. Prisma Reference Schema

This is the approved initial Prisma model.

```prisma
generator client {
  provider = "prisma-client-js"
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

enum GameSessionStatus {
  ACTIVE
  ENDED
  EXPIRED
}

model User {
  id           String   @id @default(uuid()) @db.Uuid
  username     String   @unique @db.VarChar(30)
  email        String   @unique @db.VarChar(255)
  passwordHash String   @map("password_hash") @db.VarChar(255)
  avatarUrl    String?  @map("avatar_url") @db.Text

  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(3)

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

  clickCount           Int @default(0) @map("click_count")
  backtrackCount       Int @default(0) @map("backtrack_count")
  effectivePlayTimeMs  Int @default(0) @map("effective_play_time_ms")
  version              Int @default(0)

  startedAt   DateTime  @default(now()) @map("started_at") @db.Timestamptz(3)
  completedAt DateTime? @map("completed_at") @db.Timestamptz(3)

  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(3)

  user     User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  moves    GameMove[]
  sessions GameSession[]

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

model GameSession {
  id     String @id @default(uuid()) @db.Uuid
  gameId String @map("game_id") @db.Uuid

  status GameSessionStatus @default(ACTIVE)

  startedAt        DateTime  @default(now()) @map("started_at") @db.Timestamptz(3)
  endedAt          DateTime? @map("ended_at") @db.Timestamptz(3)
  lastHeartbeatAt  DateTime  @default(now()) @map("last_heartbeat_at") @db.Timestamptz(3)
  createdAt        DateTime  @default(now()) @map("created_at") @db.Timestamptz(3)

  game Game @relation(fields: [gameId], references: [id], onDelete: Cascade)

  @@index([gameId])
  @@index([status, lastHeartbeatAt])

  @@map("game_sessions")
}
```

Depending on the installed Prisma version, datasource URLs may belong in `prisma.config.ts` rather than inside `schema.prisma`. Follow the installed version's supported configuration while preserving the data model above.

---

## 13. Supabase / Prisma Workflow

Expected workflow:

1. define/update `schema.prisma`;
2. generate a Prisma migration;
3. add required PostgreSQL-specific custom constraints/indexes to the migration when Prisma cannot express them;
4. apply migration to Supabase PostgreSQL;
5. commit both `schema.prisma` and the migration;
6. never commit database secrets.

Runtime and migration connection strings may differ depending on Supabase pooling configuration.

Secrets belong in `.env`, while `.env.example` contains placeholders only.

---

## 14. Deletion Policy

Normal application behavior:

### User deletes an IN_PROGRESS game

Delete:

- Game;
- related GameMoves via cascade;
- related GameSessions via cascade.

### COMPLETED game

Not deletable by its normal owner.

This preserves public history, rankings, and derived statistics.

Account deletion policy is not yet finalized and should not be invented by the coding agent without explicit instruction.

---

## 15. Derived Data

Do not create an authoritative leaderboard table initially.

Leaderboard rankings are queries over completed `Game` rows.

Do not create `UserStatistics` initially.

Statistics such as:

- number of completed games;
- best click score;
- best time;
- average clicks;
- average effective time

can be queried from games.

Optimization/caching may be considered later if measurements justify it.

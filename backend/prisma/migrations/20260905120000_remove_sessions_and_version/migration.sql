-- Remove the persistent play-session subsystem and the optimistic-concurrency
-- version field. Effective play time is now tracked with two nullable timestamp
-- columns directly on "games" (see docs/game-rules.md §12, docs/database.md §7).
--
-- Existing "game_sessions" rows are development/test data only and are dropped
-- without backfilling any in-flight ACTIVE-session time. Completed games keep
-- their already-finalized "effective_play_time_ms" value (column untouched).

-- DropIndex (partial unique index enforcing one ACTIVE session per game)
DROP INDEX IF EXISTS "one_active_session_per_game";

-- DropForeignKey
ALTER TABLE IF EXISTS "game_sessions" DROP CONSTRAINT IF EXISTS "game_sessions_game_id_fkey";

-- DropCheckConstraint
ALTER TABLE IF EXISTS "game_sessions" DROP CONSTRAINT IF EXISTS "game_sessions_dates_valid";

-- DropTable
DROP TABLE IF EXISTS "game_sessions";

-- DropEnum
DROP TYPE IF EXISTS "GameSessionStatus";

-- DropCheckConstraint (optimistic-concurrency version guard)
ALTER TABLE "games" DROP CONSTRAINT IF EXISTS "games_version_non_negative";

-- DropColumn
ALTER TABLE "games" DROP COLUMN IF EXISTS "version";

-- AddColumn (minimal server-authoritative timing state)
ALTER TABLE "games" ADD COLUMN IF NOT EXISTS "play_started_at" TIMESTAMPTZ(3);
ALTER TABLE "games" ADD COLUMN IF NOT EXISTS "last_heartbeat_at" TIMESTAMPTZ(3);

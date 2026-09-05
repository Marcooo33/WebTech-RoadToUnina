-- Remove the persistent play-session subsystem and the optimistic-concurrency
-- version field. Effective play time is now tracked with two nullable timestamp
-- columns directly on "games" (see docs/game-rules.md §12, docs/database.md §8).
--
-- Existing "game_sessions" rows are development/test data only and are dropped
-- without backfilling any in-flight ACTIVE-session time. Completed games keep
-- their already-finalized "effective_play_time_ms" value (column untouched).

-- DropIndex (partial unique index enforcing one ACTIVE session per game)
DROP INDEX IF EXISTS "one_active_session_per_game";

-- DropForeignKey
ALTER TABLE "game_sessions" DROP CONSTRAINT IF EXISTS "game_sessions_game_id_fkey";

-- DropCheckConstraint
ALTER TABLE "game_sessions" DROP CONSTRAINT IF EXISTS "game_sessions_dates_valid";

-- DropTable
DROP TABLE "game_sessions";

-- DropEnum
DROP TYPE "GameSessionStatus";

-- DropCheckConstraint (optimistic-concurrency version guard)
ALTER TABLE "games" DROP CONSTRAINT IF EXISTS "games_version_non_negative";

-- DropColumn
ALTER TABLE "games" DROP COLUMN "version";

-- AddColumn (minimal server-authoritative timing state)
ALTER TABLE "games" ADD COLUMN "play_started_at" TIMESTAMPTZ(3);
ALTER TABLE "games" ADD COLUMN "last_heartbeat_at" TIMESTAMPTZ(3);

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "GameMode" AS ENUM ('CLICK', 'TIME');

-- CreateEnum
CREATE TYPE "GameDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "GameMoveType" AS ENUM ('NAVIGATION', 'BACKTRACK');

-- CreateEnum
CREATE TYPE "GameSessionStatus" AS ENUM ('ACTIVE', 'ENDED', 'EXPIRED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "username" VARCHAR(30) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "avatar_url" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "games" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "mode" "GameMode" NOT NULL,
    "difficulty" "GameDifficulty" NOT NULL,
    "status" "GameStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "start_page_id" INTEGER NOT NULL,
    "start_page_title" TEXT NOT NULL,
    "current_page_id" INTEGER NOT NULL,
    "current_page_title" TEXT NOT NULL,
    "click_count" INTEGER NOT NULL DEFAULT 0,
    "backtrack_count" INTEGER NOT NULL DEFAULT 0,
    "effective_play_time_ms" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_moves" (
    "id" UUID NOT NULL,
    "game_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "type" "GameMoveType" NOT NULL,
    "from_page_id" INTEGER NOT NULL,
    "from_page_title" TEXT NOT NULL,
    "to_page_id" INTEGER NOT NULL,
    "to_page_title" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_moves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_sessions" (
    "id" UUID NOT NULL,
    "game_id" UUID NOT NULL,
    "status" "GameSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ(3),
    "last_heartbeat_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "games_user_id_status_idx" ON "games"("user_id", "status");

-- CreateIndex
CREATE INDEX "games_status_completed_at_idx" ON "games"("status", "completed_at");

-- CreateIndex
CREATE INDEX "games_status_mode_difficulty_click_count_idx" ON "games"("status", "mode", "difficulty", "click_count");

-- CreateIndex
CREATE INDEX "games_status_mode_difficulty_effective_play_time_ms_idx" ON "games"("status", "mode", "difficulty", "effective_play_time_ms");

-- CreateIndex
CREATE INDEX "game_moves_game_id_sequence_idx" ON "game_moves"("game_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "game_moves_game_id_sequence_key" ON "game_moves"("game_id", "sequence");

-- CreateIndex
CREATE INDEX "game_sessions_game_id_idx" ON "game_sessions"("game_id");

-- CreateIndex
CREATE INDEX "game_sessions_status_last_heartbeat_at_idx" ON "game_sessions"("status", "last_heartbeat_at");

-- AddForeignKey
ALTER TABLE "games" ADD CONSTRAINT "games_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_moves" ADD CONSTRAINT "game_moves_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Custom constraints not expressible in Prisma schema syntax

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

CREATE UNIQUE INDEX "one_active_session_per_game"
ON "game_sessions" ("game_id")
WHERE "status" = 'ACTIVE';


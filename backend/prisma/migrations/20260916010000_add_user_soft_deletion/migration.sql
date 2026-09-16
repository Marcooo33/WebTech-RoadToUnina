-- Account deletion keeps completed games in public History while making the
-- account unusable. Application code anonymizes the identifying fields and
-- deletes IN_PROGRESS games in the same transaction that sets this timestamp.
ALTER TABLE "users" ADD COLUMN "deleted_at" TIMESTAMPTZ(3);

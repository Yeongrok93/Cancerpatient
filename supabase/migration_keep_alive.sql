-- Migration: Dedicated heartbeat table for Supabase keep-alive
-- Run this in Supabase SQL Editor
--
-- A plain SELECT ping is a read and Supabase's free-tier inactivity
-- detector does not reliably treat it as "activity". Writing a row
-- is a much stronger signal, so the keep-alive workflow upserts into
-- this table instead of just reading from survey_sessions.

CREATE TABLE IF NOT EXISTS keep_alive (
  id         SMALLINT PRIMARY KEY DEFAULT 1,
  pinged_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO keep_alive (id, pinged_at)
VALUES (1, NOW())
ON CONFLICT (id) DO NOTHING;

ALTER TABLE keep_alive ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='keep_alive' AND policyname='anon upsert keep_alive') THEN
    CREATE POLICY "anon upsert keep_alive" ON keep_alive FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='keep_alive' AND policyname='service keep_alive') THEN
    CREATE POLICY "service keep_alive" ON keep_alive FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

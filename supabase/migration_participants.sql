-- Migration: Add participants (research enrollment applications)
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS participants (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name            TEXT NOT NULL,
  record_or_birth TEXT NOT NULL,   -- 생년월일
  contact         TEXT NOT NULL,
  research_types  TEXT,            -- 설문조사, 면담 (comma-separated)
  consent_agreed  BOOLEAN NOT NULL DEFAULT false,
  applied_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  patient_code    TEXT             -- assigned later by researcher
);

CREATE INDEX IF NOT EXISTS idx_participants_applied ON participants (applied_at DESC);
CREATE INDEX IF NOT EXISTS idx_participants_code    ON participants (patient_code);

ALTER TABLE participants ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='participants' AND policyname='anon insert participants') THEN
    CREATE POLICY "anon insert participants" ON participants FOR INSERT TO anon WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='participants' AND policyname='anon select participants') THEN
    CREATE POLICY "anon select participants" ON participants FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='participants' AND policyname='service participants') THEN
    CREATE POLICY "service participants" ON participants FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

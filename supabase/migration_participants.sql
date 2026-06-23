-- Migration: Add participants (research enrollment applications)
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS participants (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name            TEXT NOT NULL,
  record_or_birth TEXT NOT NULL,   -- 병록번호 또는 생년월일
  contact         TEXT NOT NULL,
  consent_agreed  BOOLEAN NOT NULL DEFAULT false,
  applied_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  patient_code    TEXT             -- assigned later by researcher
);

CREATE INDEX IF NOT EXISTS idx_participants_applied ON participants (applied_at DESC);
CREATE INDEX IF NOT EXISTS idx_participants_code    ON participants (patient_code);

ALTER TABLE participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon insert participants" ON participants FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon select participants" ON participants FOR SELECT TO anon USING (true);
CREATE POLICY "service participants"     ON participants FOR ALL    TO service_role USING (true) WITH CHECK (true);

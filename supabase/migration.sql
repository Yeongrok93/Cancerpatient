-- Migration: Add multi-survey support
-- Run this in Supabase SQL Editor AFTER the initial schema.sql

-- 1. Add survey_type to existing sessions table
ALTER TABLE survey_sessions
  ADD COLUMN IF NOT EXISTS survey_type TEXT DEFAULT 'pro_ctcae'
  CHECK (survey_type IN ('pro_ctcae', 'qlq_c30', 'w0'));

-- 2. QLQ-C30 answers table
CREATE TABLE IF NOT EXISTS qlq_c30_answers (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id   UUID NOT NULL REFERENCES survey_sessions(id) ON DELETE CASCADE,
  question_no  INTEGER NOT NULL CHECK (question_no BETWEEN 1 AND 30),
  answer_value INTEGER NOT NULL,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (session_id, question_no)
);

CREATE INDEX IF NOT EXISTS idx_qlq_c30_session ON qlq_c30_answers (session_id);

-- 3. W0 (Demographics + IPAQ) answers table
CREATE TABLE IF NOT EXISTS w0_answers (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id     UUID NOT NULL REFERENCES survey_sessions(id) ON DELETE CASCADE,
  question_key   TEXT NOT NULL,
  answer_choice  INTEGER,
  answer_number  NUMERIC,
  answer_text    TEXT,
  created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (session_id, question_key)
);

CREATE INDEX IF NOT EXISTS idx_w0_answers_session ON w0_answers (session_id);

-- 4. RLS for new tables
ALTER TABLE qlq_c30_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE w0_answers       ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon insert qlq_c30"  ON qlq_c30_answers FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon select qlq_c30"  ON qlq_c30_answers FOR SELECT TO anon USING (true);
CREATE POLICY "anon update qlq_c30"  ON qlq_c30_answers FOR UPDATE TO anon USING (true);
CREATE POLICY "service qlq_c30"      ON qlq_c30_answers FOR ALL    TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "anon insert w0"  ON w0_answers FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon select w0"  ON w0_answers FOR SELECT TO anon USING (true);
CREATE POLICY "anon update w0"  ON w0_answers FOR UPDATE TO anon USING (true);
CREATE POLICY "service w0"      ON w0_answers FOR ALL    TO service_role USING (true) WITH CHECK (true);

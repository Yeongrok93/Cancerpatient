-- PRO-CTCAE Survey Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Survey sessions table
CREATE TABLE IF NOT EXISTS survey_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_code TEXT,                          -- optional patient identifier
  age INTEGER,
  gender TEXT CHECK (gender IN ('male', 'female', 'other', 'prefer_not')),
  cancer_type TEXT,
  treatment_type TEXT,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  is_complete BOOLEAN DEFAULT FALSE,
  ip_address TEXT
);

-- Survey answers table
CREATE TABLE IF NOT EXISTS survey_answers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES survey_sessions(id) ON DELETE CASCADE,
  item_id INTEGER NOT NULL,                   -- 1–80
  item_term_en TEXT NOT NULL,
  question_key TEXT NOT NULL,                 -- 'a', 'b', 'c'
  question_type TEXT NOT NULL CHECK (question_type IN ('frequency','severity','interference','presence')),
  answer_value INTEGER,                        -- 0–4 for scale questions
  answer_boolean BOOLEAN,                      -- for presence questions
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (session_id, item_id, question_key)
);

-- Index for fast session lookups
CREATE INDEX IF NOT EXISTS idx_survey_answers_session ON survey_answers (session_id);
CREATE INDEX IF NOT EXISTS idx_survey_sessions_patient ON survey_sessions (patient_code);
CREATE INDEX IF NOT EXISTS idx_survey_sessions_complete ON survey_sessions (is_complete);

-- View: summary of completed surveys
CREATE OR REPLACE VIEW completed_surveys AS
SELECT
  s.id,
  s.patient_code,
  s.age,
  s.gender,
  s.cancer_type,
  s.treatment_type,
  s.started_at,
  s.completed_at,
  COUNT(a.id) AS answer_count
FROM survey_sessions s
LEFT JOIN survey_answers a ON a.session_id = s.id
WHERE s.is_complete = TRUE
GROUP BY s.id;

-- Row Level Security
ALTER TABLE survey_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_answers ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (patients fill out survey without auth)
CREATE POLICY "Allow anonymous insert on sessions"
  ON survey_sessions FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anonymous insert on answers"
  ON survey_answers FOR INSERT TO anon WITH CHECK (true);

-- Allow session owner to read/update their own session (via session id in URL)
CREATE POLICY "Allow select own session"
  ON survey_sessions FOR SELECT TO anon
  USING (true);

CREATE POLICY "Allow update own session"
  ON survey_sessions FOR UPDATE TO anon
  USING (true);

CREATE POLICY "Allow select own answers"
  ON survey_answers FOR SELECT TO anon
  USING (true);

-- Admin can do everything (via service role key)
CREATE POLICY "Service role full access on sessions"
  ON survey_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on answers"
  ON survey_answers FOR ALL TO service_role USING (true) WITH CHECK (true);

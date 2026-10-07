-- PRO-CTCAE survey schema (Neon Postgres)
--
-- Consolidated from the former Supabase schema.sql + migration_*.sql, matched
-- against the live Supabase tables at cutover (2026-09-27). Supabase-only
-- pieces are gone: RLS policies (anon / service_role roles don't exist here —
-- every query now runs server-side), the keep_alive heartbeat table, and the
-- find_patient_code() SECURITY DEFINER function (now a plain query in
-- src/lib/actions.ts).
--
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS participants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  record_or_birth TEXT NOT NULL,            -- 생년월일
  contact         TEXT NOT NULL,
  research_types  TEXT,                     -- 설문조사, 면담 (comma-separated)
  consent_agreed  BOOLEAN NOT NULL DEFAULT FALSE,
  applied_at      TIMESTAMPTZ DEFAULT NOW(),
  patient_code    TEXT,                     -- assigned later by researcher
  sms_notified    BOOLEAN,                  -- registration SMS to researchers: true sent / false failed / null not attempted
  sms_error       TEXT
);

-- 연구참여시작 날짜 (added after initial schema; safe to re-run)
ALTER TABLE participants ADD COLUMN IF NOT EXISTS study_start_date DATE;

-- Per-patient survey link token (/s/<token>/<w0|pro|qlq>): 64 hex chars of randomness.
ALTER TABLE participants ADD COLUMN IF NOT EXISTS access_token TEXT
  DEFAULT (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''));
CREATE UNIQUE INDEX IF NOT EXISTS idx_participants_token ON participants (access_token);

CREATE INDEX IF NOT EXISTS idx_participants_applied ON participants (applied_at DESC);
CREATE INDEX IF NOT EXISTS idx_participants_code    ON participants (patient_code);

CREATE TABLE IF NOT EXISTS survey_sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_code        TEXT,
  survey_type         TEXT DEFAULT 'pro_ctcae' CHECK (survey_type IN ('pro_ctcae', 'qlq_c30', 'w0')),
  age                 INTEGER,
  gender              TEXT CHECK (gender IN ('male', 'female', 'other', 'prefer_not')),
  cancer_type         TEXT,
  treatment_type      TEXT,
  started_at          TIMESTAMPTZ DEFAULT NOW(),
  completed_at        TIMESTAMPTZ,
  is_complete         BOOLEAN DEFAULT FALSE,
  additional_comments TEXT,
  ip_address          TEXT
);

CREATE INDEX IF NOT EXISTS idx_survey_sessions_patient  ON survey_sessions (patient_code);
CREATE INDEX IF NOT EXISTS idx_survey_sessions_complete ON survey_sessions (is_complete);

-- PRO-CTCAE answers
CREATE TABLE IF NOT EXISTS survey_answers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     UUID NOT NULL REFERENCES survey_sessions(id) ON DELETE CASCADE,
  item_id        INTEGER NOT NULL,          -- 1-80
  item_term_en   TEXT NOT NULL,
  question_key   TEXT NOT NULL,             -- 'a', 'b', 'c'
  question_type  TEXT NOT NULL CHECK (question_type IN ('frequency', 'severity', 'interference', 'presence')),
  answer_value   INTEGER,                   -- 0-4 for scale questions
  answer_boolean BOOLEAN,                   -- presence questions
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (session_id, item_id, question_key)
);

CREATE INDEX IF NOT EXISTS idx_survey_answers_session ON survey_answers (session_id);

CREATE TABLE IF NOT EXISTS qlq_c30_answers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID NOT NULL REFERENCES survey_sessions(id) ON DELETE CASCADE,
  question_no  INTEGER NOT NULL CHECK (question_no BETWEEN 1 AND 30),
  answer_value INTEGER NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (session_id, question_no)
);

CREATE INDEX IF NOT EXISTS idx_qlq_c30_session ON qlq_c30_answers (session_id);

-- W0 (Demographics + ECOG + IPAQ + emergency screening)
CREATE TABLE IF NOT EXISTS w0_answers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL REFERENCES survey_sessions(id) ON DELETE CASCADE,
  question_key  TEXT NOT NULL,
  answer_choice INTEGER,
  answer_number NUMERIC,
  answer_text   TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (session_id, question_key)
);

CREATE INDEX IF NOT EXISTS idx_w0_answers_session ON w0_answers (session_id);

-- Patient -> care team inquiry messages (floating contact button)
CREATE TABLE IF NOT EXISTS patient_messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_code TEXT NOT NULL,
  session_id   UUID REFERENCES survey_sessions(id) ON DELETE SET NULL,
  message      TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  is_read      BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_patient_messages_code    ON patient_messages (patient_code);
CREATE INDEX IF NOT EXISTS idx_patient_messages_created ON patient_messages (created_at DESC);

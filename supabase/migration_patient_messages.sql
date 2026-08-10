-- Migration: Patient -> care team inquiry messages (floating contact button)
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS patient_messages (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_code TEXT NOT NULL,
  session_id   UUID REFERENCES survey_sessions(id) ON DELETE SET NULL,
  message      TEXT NOT NULL,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_read      BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_patient_messages_code ON patient_messages (patient_code);
CREATE INDEX IF NOT EXISTS idx_patient_messages_created ON patient_messages (created_at DESC);

ALTER TABLE patient_messages ENABLE ROW LEVEL SECURITY;

-- Same security posture as the other tables in this app: no separate admin
-- auth exists yet, so anon covers both the patient-facing FAB and /admin.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='patient_messages' AND policyname='anon insert patient_messages') THEN
    CREATE POLICY "anon insert patient_messages" ON patient_messages FOR INSERT TO anon WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='patient_messages' AND policyname='anon select patient_messages') THEN
    CREATE POLICY "anon select patient_messages" ON patient_messages FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='patient_messages' AND policyname='anon update patient_messages') THEN
    CREATE POLICY "anon update patient_messages" ON patient_messages FOR UPDATE TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='patient_messages' AND policyname='service patient_messages') THEN
    CREATE POLICY "service patient_messages" ON patient_messages FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

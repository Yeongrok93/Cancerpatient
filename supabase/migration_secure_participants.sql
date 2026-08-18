-- Security fix: participants.select was open to the anon role, meaning
-- anyone with the public anon key (embedded in the browser bundle) could
-- pull every patient's name + birth date + patient_code directly via the
-- REST API and use it to pass the "본인확인" identity check as any patient.
--
-- This drops that policy and replaces the one legitimate anonymous use
-- case (the identity-check on the home page, which looks a patient up by
-- name + birth date and routes to their patient_code) with a narrow
-- SECURITY DEFINER function that can only return one patient_code for an
-- exact name+birth match — it never returns a row or any other column.
--
-- Run this in Supabase SQL Editor.

DROP POLICY IF EXISTS "anon select participants" ON participants;

CREATE OR REPLACE FUNCTION find_patient_code(p_name text, p_birth text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT patient_code FROM participants
  WHERE trim(name) = trim(p_name)
    AND regexp_replace(record_or_birth, '\D', '', 'g') = regexp_replace(p_birth, '\D', '', 'g')
    AND patient_code IS NOT NULL
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION find_patient_code(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION find_patient_code(text, text) TO anon;

-- participants SELECT/UPDATE for the admin review workflow (the "참여신청"
-- tab, and assigning patient_code) now goes through /api/admin/participants,
-- a server-only route using the service_role key — never the anon key.

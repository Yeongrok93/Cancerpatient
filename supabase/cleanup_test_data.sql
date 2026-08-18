-- Cleanup: remove all patient-facing test/junk data except the seeded
-- virtual test patient TEST001. Run this in Supabase SQL Editor with the
-- project's own credentials (anon key cannot DELETE — no anon DELETE
-- policy exists on these tables, by design).
--
-- survey_sessions has ON DELETE CASCADE to survey_answers / qlq_c30_answers
-- / w0_answers, so deleting the sessions below also removes their answers.
-- patient_messages.session_id is ON DELETE SET NULL, so it's cleaned up
-- separately by patient_code.

DELETE FROM patient_messages
WHERE patient_code IS DISTINCT FROM 'TEST001';

DELETE FROM survey_sessions
WHERE patient_code IS DISTINCT FROM 'TEST001';

DELETE FROM participants
WHERE patient_code IS DISTINCT FROM 'TEST001';

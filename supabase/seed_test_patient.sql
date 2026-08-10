-- Seed: virtual test patient "김테스트" (78세 남성) with 6 weeks of PRO-CTCAE
-- data, for demoing the per-patient grade dashboard. Safe to re-run.
-- Run this in Supabase SQL Editor AFTER schema.sql + all migration_*.sql.

-- 1. Participant record (본인확인용 이름/생년월일/참여자번호)
INSERT INTO participants (name, record_or_birth, contact, research_types, consent_agreed, patient_code)
SELECT '김테스트', '19480101', '010-0000-0000', '설문조사', true, 'TEST001'
WHERE NOT EXISTS (SELECT 1 FROM participants WHERE patient_code = 'TEST001');

-- 2. Six weekly PRO-CTCAE sessions
INSERT INTO survey_sessions (id, patient_code, age, gender, cancer_type, treatment_type, survey_type, started_at, completed_at, is_complete)
VALUES
  ('aaaaaaaa-0000-4000-8000-000000000001', 'TEST001', 78, 'male', 'HER2 양성 위암', 'ADC 항암치료', 'pro_ctcae', '2026-06-01 09:00+09', '2026-06-01 09:15+09', true),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'TEST001', 78, 'male', 'HER2 양성 위암', 'ADC 항암치료', 'pro_ctcae', '2026-06-08 09:00+09', '2026-06-08 09:18+09', true),
  ('aaaaaaaa-0000-4000-8000-000000000003', 'TEST001', 78, 'male', 'HER2 양성 위암', 'ADC 항암치료', 'pro_ctcae', '2026-06-15 09:00+09', '2026-06-15 09:20+09', true),
  ('aaaaaaaa-0000-4000-8000-000000000004', 'TEST001', 78, 'male', 'HER2 양성 위암', 'ADC 항암치료', 'pro_ctcae', '2026-06-22 09:00+09', '2026-06-22 09:22+09', true),
  ('aaaaaaaa-0000-4000-8000-000000000005', 'TEST001', 78, 'male', 'HER2 양성 위암', 'ADC 항암치료', 'pro_ctcae', '2026-06-29 09:00+09', '2026-06-29 09:17+09', true),
  ('aaaaaaaa-0000-4000-8000-000000000006', 'TEST001', 78, 'male', 'HER2 양성 위암', 'ADC 항암치료', 'pro_ctcae', '2026-07-06 09:00+09', '2026-07-06 09:19+09', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Answers: ~15 representative items with escalating / resolving / flat patterns.
--    item_id refers to SURVEY_ITEMS in src/lib/questions.ts.
INSERT INTO survey_answers (session_id, item_id, item_term_en, question_key, question_type, answer_value)
VALUES
-- id3 Mouth/throat sores (severity+interference) — appears mid-treatment, resolves
('aaaaaaaa-0000-4000-8000-000000000001', 3, 'Mouth/throat sores', 'a', 'severity', 0), ('aaaaaaaa-0000-4000-8000-000000000001', 3, 'Mouth/throat sores', 'b', 'interference', 0),
('aaaaaaaa-0000-4000-8000-000000000002', 3, 'Mouth/throat sores', 'a', 'severity', 1), ('aaaaaaaa-0000-4000-8000-000000000002', 3, 'Mouth/throat sores', 'b', 'interference', 1),
('aaaaaaaa-0000-4000-8000-000000000003', 3, 'Mouth/throat sores', 'a', 'severity', 3), ('aaaaaaaa-0000-4000-8000-000000000003', 3, 'Mouth/throat sores', 'b', 'interference', 2),
('aaaaaaaa-0000-4000-8000-000000000004', 3, 'Mouth/throat sores', 'a', 'severity', 2), ('aaaaaaaa-0000-4000-8000-000000000004', 3, 'Mouth/throat sores', 'b', 'interference', 1),
('aaaaaaaa-0000-4000-8000-000000000005', 3, 'Mouth/throat sores', 'a', 'severity', 1), ('aaaaaaaa-0000-4000-8000-000000000005', 3, 'Mouth/throat sores', 'b', 'interference', 0),
('aaaaaaaa-0000-4000-8000-000000000006', 3, 'Mouth/throat sores', 'a', 'severity', 0), ('aaaaaaaa-0000-4000-8000-000000000006', 3, 'Mouth/throat sores', 'b', 'interference', 0),

-- id8 Decreased appetite (severity+interference) — mild fluctuation
('aaaaaaaa-0000-4000-8000-000000000001', 8, 'Decreased appetite', 'a', 'severity', 0), ('aaaaaaaa-0000-4000-8000-000000000001', 8, 'Decreased appetite', 'b', 'interference', 0),
('aaaaaaaa-0000-4000-8000-000000000002', 8, 'Decreased appetite', 'a', 'severity', 1), ('aaaaaaaa-0000-4000-8000-000000000002', 8, 'Decreased appetite', 'b', 'interference', 0),
('aaaaaaaa-0000-4000-8000-000000000003', 8, 'Decreased appetite', 'a', 'severity', 2), ('aaaaaaaa-0000-4000-8000-000000000003', 8, 'Decreased appetite', 'b', 'interference', 1),
('aaaaaaaa-0000-4000-8000-000000000004', 8, 'Decreased appetite', 'a', 'severity', 2), ('aaaaaaaa-0000-4000-8000-000000000004', 8, 'Decreased appetite', 'b', 'interference', 2),
('aaaaaaaa-0000-4000-8000-000000000005', 8, 'Decreased appetite', 'a', 'severity', 3), ('aaaaaaaa-0000-4000-8000-000000000005', 8, 'Decreased appetite', 'b', 'interference', 2),
('aaaaaaaa-0000-4000-8000-000000000006', 8, 'Decreased appetite', 'a', 'severity', 2), ('aaaaaaaa-0000-4000-8000-000000000006', 8, 'Decreased appetite', 'b', 'interference', 1),

-- id9 Nausea (frequency+severity) — spikes mid-treatment, improves with antiemetic
('aaaaaaaa-0000-4000-8000-000000000001', 9, 'Nausea', 'a', 'frequency', 0), ('aaaaaaaa-0000-4000-8000-000000000001', 9, 'Nausea', 'b', 'severity', 0),
('aaaaaaaa-0000-4000-8000-000000000002', 9, 'Nausea', 'a', 'frequency', 2), ('aaaaaaaa-0000-4000-8000-000000000002', 9, 'Nausea', 'b', 'severity', 2),
('aaaaaaaa-0000-4000-8000-000000000003', 9, 'Nausea', 'a', 'frequency', 3), ('aaaaaaaa-0000-4000-8000-000000000003', 9, 'Nausea', 'b', 'severity', 2),
('aaaaaaaa-0000-4000-8000-000000000004', 9, 'Nausea', 'a', 'frequency', 2), ('aaaaaaaa-0000-4000-8000-000000000004', 9, 'Nausea', 'b', 'severity', 1),
('aaaaaaaa-0000-4000-8000-000000000005', 9, 'Nausea', 'a', 'frequency', 1), ('aaaaaaaa-0000-4000-8000-000000000005', 9, 'Nausea', 'b', 'severity', 1),
('aaaaaaaa-0000-4000-8000-000000000006', 9, 'Nausea', 'a', 'frequency', 0), ('aaaaaaaa-0000-4000-8000-000000000006', 9, 'Nausea', 'b', 'severity', 0),

-- id15 Constipation (severity only) — mild, flat
('aaaaaaaa-0000-4000-8000-000000000001', 15, 'Constipation', 'a', 'severity', 0),
('aaaaaaaa-0000-4000-8000-000000000002', 15, 'Constipation', 'a', 'severity', 1),
('aaaaaaaa-0000-4000-8000-000000000003', 15, 'Constipation', 'a', 'severity', 1),
('aaaaaaaa-0000-4000-8000-000000000004', 15, 'Constipation', 'a', 'severity', 1),
('aaaaaaaa-0000-4000-8000-000000000005', 15, 'Constipation', 'a', 'severity', 2),
('aaaaaaaa-0000-4000-8000-000000000006', 15, 'Constipation', 'a', 'severity', 1),

-- id16 Diarrhea (frequency only) — fluctuates
('aaaaaaaa-0000-4000-8000-000000000001', 16, 'Diarrhea', 'a', 'frequency', 0),
('aaaaaaaa-0000-4000-8000-000000000002', 16, 'Diarrhea', 'a', 'frequency', 1),
('aaaaaaaa-0000-4000-8000-000000000003', 16, 'Diarrhea', 'a', 'frequency', 2),
('aaaaaaaa-0000-4000-8000-000000000004', 16, 'Diarrhea', 'a', 'frequency', 1),
('aaaaaaaa-0000-4000-8000-000000000005', 16, 'Diarrhea', 'a', 'frequency', 0),
('aaaaaaaa-0000-4000-8000-000000000006', 16, 'Diarrhea', 'a', 'frequency', 1),

-- id25 Skin dryness (severity only) — gradually increases
('aaaaaaaa-0000-4000-8000-000000000001', 25, 'Skin dryness', 'a', 'severity', 0),
('aaaaaaaa-0000-4000-8000-000000000002', 25, 'Skin dryness', 'a', 'severity', 1),
('aaaaaaaa-0000-4000-8000-000000000003', 25, 'Skin dryness', 'a', 'severity', 1),
('aaaaaaaa-0000-4000-8000-000000000004', 25, 'Skin dryness', 'a', 'severity', 2),
('aaaaaaaa-0000-4000-8000-000000000005', 25, 'Skin dryness', 'a', 'severity', 2),
('aaaaaaaa-0000-4000-8000-000000000006', 25, 'Skin dryness', 'a', 'severity', 2),

-- id27 Hair loss (severity only) — classic cumulative ADC toxicity, worsens steadily
('aaaaaaaa-0000-4000-8000-000000000001', 27, 'Hair loss', 'a', 'severity', 0),
('aaaaaaaa-0000-4000-8000-000000000002', 27, 'Hair loss', 'a', 'severity', 0),
('aaaaaaaa-0000-4000-8000-000000000003', 27, 'Hair loss', 'a', 'severity', 1),
('aaaaaaaa-0000-4000-8000-000000000004', 27, 'Hair loss', 'a', 'severity', 2),
('aaaaaaaa-0000-4000-8000-000000000005', 27, 'Hair loss', 'a', 'severity', 2),
('aaaaaaaa-0000-4000-8000-000000000006', 27, 'Hair loss', 'a', 'severity', 3),

-- id28 Itching (severity only) — fluctuates mild-moderate
('aaaaaaaa-0000-4000-8000-000000000001', 28, 'Itching', 'a', 'severity', 0),
('aaaaaaaa-0000-4000-8000-000000000002', 28, 'Itching', 'a', 'severity', 1),
('aaaaaaaa-0000-4000-8000-000000000003', 28, 'Itching', 'a', 'severity', 2),
('aaaaaaaa-0000-4000-8000-000000000004', 28, 'Itching', 'a', 'severity', 1),
('aaaaaaaa-0000-4000-8000-000000000005', 28, 'Itching', 'a', 'severity', 2),
('aaaaaaaa-0000-4000-8000-000000000006', 28, 'Itching', 'a', 'severity', 1),

-- id30 Hand-foot syndrome (severity only) — classic cumulative ADC toxicity, worsens steadily
('aaaaaaaa-0000-4000-8000-000000000001', 30, 'Hand-foot syndrome', 'a', 'severity', 0),
('aaaaaaaa-0000-4000-8000-000000000002', 30, 'Hand-foot syndrome', 'a', 'severity', 0),
('aaaaaaaa-0000-4000-8000-000000000003', 30, 'Hand-foot syndrome', 'a', 'severity', 1),
('aaaaaaaa-0000-4000-8000-000000000004', 30, 'Hand-foot syndrome', 'a', 'severity', 1),
('aaaaaaaa-0000-4000-8000-000000000005', 30, 'Hand-foot syndrome', 'a', 'severity', 2),
('aaaaaaaa-0000-4000-8000-000000000006', 30, 'Hand-foot syndrome', 'a', 'severity', 3),

-- id39 Numbness & tingling (severity+interference) — cumulative neuropathy, worsens steadily to grade 3
('aaaaaaaa-0000-4000-8000-000000000001', 39, 'Numbness & tingling', 'a', 'severity', 0), ('aaaaaaaa-0000-4000-8000-000000000001', 39, 'Numbness & tingling', 'b', 'interference', 0),
('aaaaaaaa-0000-4000-8000-000000000002', 39, 'Numbness & tingling', 'a', 'severity', 0), ('aaaaaaaa-0000-4000-8000-000000000002', 39, 'Numbness & tingling', 'b', 'interference', 0),
('aaaaaaaa-0000-4000-8000-000000000003', 39, 'Numbness & tingling', 'a', 'severity', 1), ('aaaaaaaa-0000-4000-8000-000000000003', 39, 'Numbness & tingling', 'b', 'interference', 0),
('aaaaaaaa-0000-4000-8000-000000000004', 39, 'Numbness & tingling', 'a', 'severity', 2), ('aaaaaaaa-0000-4000-8000-000000000004', 39, 'Numbness & tingling', 'b', 'interference', 1),
('aaaaaaaa-0000-4000-8000-000000000005', 39, 'Numbness & tingling', 'a', 'severity', 3), ('aaaaaaaa-0000-4000-8000-000000000005', 39, 'Numbness & tingling', 'b', 'interference', 2),
('aaaaaaaa-0000-4000-8000-000000000006', 39, 'Numbness & tingling', 'a', 'severity', 4), ('aaaaaaaa-0000-4000-8000-000000000006', 39, 'Numbness & tingling', 'b', 'interference', 3),

-- id40 Dizziness (severity+interference) — mild, flat
('aaaaaaaa-0000-4000-8000-000000000001', 40, 'Dizziness', 'a', 'severity', 0), ('aaaaaaaa-0000-4000-8000-000000000001', 40, 'Dizziness', 'b', 'interference', 0),
('aaaaaaaa-0000-4000-8000-000000000002', 40, 'Dizziness', 'a', 'severity', 1), ('aaaaaaaa-0000-4000-8000-000000000002', 40, 'Dizziness', 'b', 'interference', 0),
('aaaaaaaa-0000-4000-8000-000000000003', 40, 'Dizziness', 'a', 'severity', 1), ('aaaaaaaa-0000-4000-8000-000000000003', 40, 'Dizziness', 'b', 'interference', 1),
('aaaaaaaa-0000-4000-8000-000000000004', 40, 'Dizziness', 'a', 'severity', 1), ('aaaaaaaa-0000-4000-8000-000000000004', 40, 'Dizziness', 'b', 'interference', 1),
('aaaaaaaa-0000-4000-8000-000000000005', 40, 'Dizziness', 'a', 'severity', 1), ('aaaaaaaa-0000-4000-8000-000000000005', 40, 'Dizziness', 'b', 'interference', 0),
('aaaaaaaa-0000-4000-8000-000000000006', 40, 'Dizziness', 'a', 'severity', 0), ('aaaaaaaa-0000-4000-8000-000000000006', 40, 'Dizziness', 'b', 'interference', 0),

-- id48 General pain (frequency+severity+interference) — mild, steady
('aaaaaaaa-0000-4000-8000-000000000001', 48, 'General pain', 'a', 'frequency', 0), ('aaaaaaaa-0000-4000-8000-000000000001', 48, 'General pain', 'b', 'severity', 0), ('aaaaaaaa-0000-4000-8000-000000000001', 48, 'General pain', 'c', 'interference', 0),
('aaaaaaaa-0000-4000-8000-000000000002', 48, 'General pain', 'a', 'frequency', 1), ('aaaaaaaa-0000-4000-8000-000000000002', 48, 'General pain', 'b', 'severity', 1), ('aaaaaaaa-0000-4000-8000-000000000002', 48, 'General pain', 'c', 'interference', 0),
('aaaaaaaa-0000-4000-8000-000000000003', 48, 'General pain', 'a', 'frequency', 1), ('aaaaaaaa-0000-4000-8000-000000000003', 48, 'General pain', 'b', 'severity', 1), ('aaaaaaaa-0000-4000-8000-000000000003', 48, 'General pain', 'c', 'interference', 1),
('aaaaaaaa-0000-4000-8000-000000000004', 48, 'General pain', 'a', 'frequency', 2), ('aaaaaaaa-0000-4000-8000-000000000004', 48, 'General pain', 'b', 'severity', 1), ('aaaaaaaa-0000-4000-8000-000000000004', 48, 'General pain', 'c', 'interference', 1),
('aaaaaaaa-0000-4000-8000-000000000005', 48, 'General pain', 'a', 'frequency', 1), ('aaaaaaaa-0000-4000-8000-000000000005', 48, 'General pain', 'b', 'severity', 1), ('aaaaaaaa-0000-4000-8000-000000000005', 48, 'General pain', 'c', 'interference', 0),
('aaaaaaaa-0000-4000-8000-000000000006', 48, 'General pain', 'a', 'frequency', 1), ('aaaaaaaa-0000-4000-8000-000000000006', 48, 'General pain', 'b', 'severity', 1), ('aaaaaaaa-0000-4000-8000-000000000006', 48, 'General pain', 'c', 'interference', 0),

-- id52 Insomnia (severity+interference) — mild-moderate, steady
('aaaaaaaa-0000-4000-8000-000000000001', 52, 'Insomnia', 'a', 'severity', 0), ('aaaaaaaa-0000-4000-8000-000000000001', 52, 'Insomnia', 'b', 'interference', 0),
('aaaaaaaa-0000-4000-8000-000000000002', 52, 'Insomnia', 'a', 'severity', 1), ('aaaaaaaa-0000-4000-8000-000000000002', 52, 'Insomnia', 'b', 'interference', 1),
('aaaaaaaa-0000-4000-8000-000000000003', 52, 'Insomnia', 'a', 'severity', 2), ('aaaaaaaa-0000-4000-8000-000000000003', 52, 'Insomnia', 'b', 'interference', 1),
('aaaaaaaa-0000-4000-8000-000000000004', 52, 'Insomnia', 'a', 'severity', 2), ('aaaaaaaa-0000-4000-8000-000000000004', 52, 'Insomnia', 'b', 'interference', 2),
('aaaaaaaa-0000-4000-8000-000000000005', 52, 'Insomnia', 'a', 'severity', 2), ('aaaaaaaa-0000-4000-8000-000000000005', 52, 'Insomnia', 'b', 'interference', 1),
('aaaaaaaa-0000-4000-8000-000000000006', 52, 'Insomnia', 'a', 'severity', 1), ('aaaaaaaa-0000-4000-8000-000000000006', 52, 'Insomnia', 'b', 'interference', 1),

-- id53 Fatigue (severity+interference) — worsens then plateaus, peaks grade 3 mid-treatment
('aaaaaaaa-0000-4000-8000-000000000001', 53, 'Fatigue', 'a', 'severity', 0), ('aaaaaaaa-0000-4000-8000-000000000001', 53, 'Fatigue', 'b', 'interference', 0),
('aaaaaaaa-0000-4000-8000-000000000002', 53, 'Fatigue', 'a', 'severity', 1), ('aaaaaaaa-0000-4000-8000-000000000002', 53, 'Fatigue', 'b', 'interference', 1),
('aaaaaaaa-0000-4000-8000-000000000003', 53, 'Fatigue', 'a', 'severity', 2), ('aaaaaaaa-0000-4000-8000-000000000003', 53, 'Fatigue', 'b', 'interference', 2),
('aaaaaaaa-0000-4000-8000-000000000004', 53, 'Fatigue', 'a', 'severity', 3), ('aaaaaaaa-0000-4000-8000-000000000004', 53, 'Fatigue', 'b', 'interference', 3),
('aaaaaaaa-0000-4000-8000-000000000005', 53, 'Fatigue', 'a', 'severity', 3), ('aaaaaaaa-0000-4000-8000-000000000005', 53, 'Fatigue', 'b', 'interference', 2),
('aaaaaaaa-0000-4000-8000-000000000006', 53, 'Fatigue', 'a', 'severity', 2), ('aaaaaaaa-0000-4000-8000-000000000006', 53, 'Fatigue', 'b', 'interference', 2),

-- id54 Anxious (frequency+severity+interference) — moderate, steady
('aaaaaaaa-0000-4000-8000-000000000001', 54, 'Anxious', 'a', 'frequency', 0), ('aaaaaaaa-0000-4000-8000-000000000001', 54, 'Anxious', 'b', 'severity', 0), ('aaaaaaaa-0000-4000-8000-000000000001', 54, 'Anxious', 'c', 'interference', 0),
('aaaaaaaa-0000-4000-8000-000000000002', 54, 'Anxious', 'a', 'frequency', 1), ('aaaaaaaa-0000-4000-8000-000000000002', 54, 'Anxious', 'b', 'severity', 1), ('aaaaaaaa-0000-4000-8000-000000000002', 54, 'Anxious', 'c', 'interference', 0),
('aaaaaaaa-0000-4000-8000-000000000003', 54, 'Anxious', 'a', 'frequency', 2), ('aaaaaaaa-0000-4000-8000-000000000003', 54, 'Anxious', 'b', 'severity', 1), ('aaaaaaaa-0000-4000-8000-000000000003', 54, 'Anxious', 'c', 'interference', 1),
('aaaaaaaa-0000-4000-8000-000000000004', 54, 'Anxious', 'a', 'frequency', 2), ('aaaaaaaa-0000-4000-8000-000000000004', 54, 'Anxious', 'b', 'severity', 2), ('aaaaaaaa-0000-4000-8000-000000000004', 54, 'Anxious', 'c', 'interference', 1),
('aaaaaaaa-0000-4000-8000-000000000005', 54, 'Anxious', 'a', 'frequency', 1), ('aaaaaaaa-0000-4000-8000-000000000005', 54, 'Anxious', 'b', 'severity', 1), ('aaaaaaaa-0000-4000-8000-000000000005', 54, 'Anxious', 'c', 'interference', 0),
('aaaaaaaa-0000-4000-8000-000000000006', 54, 'Anxious', 'a', 'frequency', 1), ('aaaaaaaa-0000-4000-8000-000000000006', 54, 'Anxious', 'b', 'severity', 1), ('aaaaaaaa-0000-4000-8000-000000000006', 54, 'Anxious', 'c', 'interference', 0)

ON CONFLICT (session_id, item_id, question_key) DO NOTHING;

-- 4. One QLQ-C30 session (전체 30문항, 대체로 양호) so /select 화면도 데모 가능
INSERT INTO survey_sessions (id, patient_code, age, gender, survey_type, started_at, completed_at, is_complete)
VALUES ('aaaaaaaa-0000-4000-8000-00000000009a', 'TEST001', 78, 'male', 'qlq_c30', '2026-06-01 09:30+09', '2026-06-01 09:40+09', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO qlq_c30_answers (session_id, question_no, answer_value)
SELECT 'aaaaaaaa-0000-4000-8000-00000000009a', n,
  CASE WHEN n <= 28 THEN 2 ELSE 5 END  -- Q1-28: four-point scale (1-4), Q29-30: seven-point scale (1-7)
FROM generate_series(1, 30) AS n
ON CONFLICT (session_id, question_no) DO NOTHING;

-- 5. One W0 (baseline demographics) session
INSERT INTO survey_sessions (id, patient_code, age, gender, survey_type, started_at, completed_at, is_complete)
VALUES ('aaaaaaaa-0000-4000-8000-00000000009b', 'TEST001', 78, 'male', 'w0', '2026-06-01 09:45+09', '2026-06-01 09:50+09', true)
ON CONFLICT (id) DO NOTHING;

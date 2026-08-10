-- Fix: `participants.research_types` was added to schema.sql's CREATE TABLE
-- after the table already existed in production, so `CREATE TABLE IF NOT
-- EXISTS` silently skipped it and the column was never actually created.
-- This means /register has been failing on every real submission (the
-- INSERT includes research_types) since that change shipped.
-- Run this once in the Supabase SQL Editor.

ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS research_types TEXT;  -- 설문조사, 면담 (comma-separated)

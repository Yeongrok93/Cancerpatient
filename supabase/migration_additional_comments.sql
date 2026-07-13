-- Migration: Add optional free-text comment to PRO-CTCAE survey
-- Run this in Supabase SQL Editor AFTER the initial schema.sql

ALTER TABLE survey_sessions
  ADD COLUMN IF NOT EXISTS additional_comments TEXT;

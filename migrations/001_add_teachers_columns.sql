-- Migration: add commonly required columns to `teachers` table for the onboarding form
-- Run this in Supabase SQL editor or via psql/supabase CLI.

BEGIN;

ALTER TABLE IF EXISTS public.teachers
  ADD COLUMN IF NOT EXISTS area text,
  ADD COLUMN IF NOT EXISTS lga text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS subjects text[],
  ADD COLUMN IF NOT EXISTS min_class text,
  ADD COLUMN IF NOT EXISTS max_class text,
  ADD COLUMN IF NOT EXISTS exam_focus text[],
  ADD COLUMN IF NOT EXISTS availability text,
  ADD COLUMN IF NOT EXISTS lesson_type text,
  ADD COLUMN IF NOT EXISTS private_tutoring text,
  ADD COLUMN IF NOT EXISTS teaching_experience text,
  ADD COLUMN IF NOT EXISTS consent boolean DEFAULT false;

COMMIT;

-- 016: Cache one Today's prayer per viewer, pairing, and local date
--
-- DO NOT RUN from this PR or against production from the agent.
-- Caleb: apply this in the Supabase SQL editor after review (staging first).
--
-- What to run:
-- 1. Open the Supabase SQL editor for the SWR project (staging, then production).
-- 2. Paste and run this entire file (scripts/016-daily-prayers.sql).
-- 3. Confirm public.daily_prayers exists and the unique index
--    daily_prayers_user_pairing_day_uidx is present.
--
-- The app generates one AI prayer per user + pairing + local date, then reuses
-- that row on reload and Send. If this table is missing, the popup still opens
-- with the existing catalog prayer.

CREATE TABLE IF NOT EXISTS public.daily_prayers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pairing_id uuid NOT NULL REFERENCES public.pairings(id) ON DELETE CASCADE,
  partner_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  local_date date NOT NULL,
  body text NOT NULL,
  scripture_text text NOT NULL,
  scripture_ref text NOT NULL,
  source text NOT NULL,
  context_label text NOT NULL,
  context_topic text,
  mentions_partner boolean NOT NULL DEFAULT false,
  generated_by text NOT NULL DEFAULT 'ai' CHECK (generated_by IN ('ai', 'catalog')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS daily_prayers_user_pairing_day_uidx
  ON public.daily_prayers (user_id, pairing_id, local_date);

CREATE INDEX IF NOT EXISTS daily_prayers_user_day_idx
  ON public.daily_prayers (user_id, local_date DESC);

COMMENT ON TABLE public.daily_prayers IS
  'One cached Today''s prayer per viewer, pairing, and viewer-local date.';

ALTER TABLE public.daily_prayers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'daily_prayers'
      AND policyname = 'Users can view their daily prayers'
  ) THEN
    CREATE POLICY "Users can view their daily prayers"
      ON public.daily_prayers
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'daily_prayers'
      AND policyname = 'Users can insert their daily prayers'
  ) THEN
    CREATE POLICY "Users can insert their daily prayers"
      ON public.daily_prayers
      FOR INSERT
      WITH CHECK (
        auth.uid() = user_id
        AND pairing_id IN (
          SELECT id FROM public.pairings
          WHERE leader_id = auth.uid() OR learner_id = auth.uid()
        )
      );
  END IF;
END $$;

-- 015: One daily prayer send per sender, recipient, and local date
--
-- DO NOT RUN from this PR or against production from the agent.
-- Caleb: apply this in the Supabase SQL editor after review (staging first).
--
-- Closes the race on repeat Send. The app inserts here first and treats a
-- unique conflict as "Already sent today". If this table is missing, the app
-- falls back to the existing messages scan so deploys stay safe.

CREATE TABLE IF NOT EXISTS public.prayer_sends (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pairing_id uuid NOT NULL REFERENCES public.pairings(id) ON DELETE CASCADE,
  local_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS prayer_sends_sender_recipient_day_uidx
  ON public.prayer_sends (sender_id, recipient_id, local_date);

COMMENT ON TABLE public.prayer_sends IS
  'One Today''s prayer send per sender, recipient, and viewer-local date.';

ALTER TABLE public.prayer_sends ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'prayer_sends'
      AND policyname = 'Users can view their prayer sends'
  ) THEN
    CREATE POLICY "Users can view their prayer sends"
      ON public.prayer_sends
      FOR SELECT
      USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'prayer_sends'
      AND policyname = 'Users can insert their prayer sends'
  ) THEN
    CREATE POLICY "Users can insert their prayer sends"
      ON public.prayer_sends
      FOR INSERT
      WITH CHECK (
        auth.uid() = sender_id
        AND pairing_id IN (
          SELECT id FROM public.pairings
          WHERE leader_id = auth.uid() OR learner_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'prayer_sends'
      AND policyname = 'Users can delete their prayer sends'
  ) THEN
    CREATE POLICY "Users can delete their prayer sends"
      ON public.prayer_sends
      FOR DELETE
      USING (auth.uid() = sender_id);
  END IF;
END $$;

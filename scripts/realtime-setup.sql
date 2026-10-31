-- Aktifkan Realtime untuk tabel "Setoran" + izinkan anon membaca (untuk subscription realtime browser)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'Setoran'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public."Setoran";
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'Setoran' AND relrowsecurity = true
  ) THEN
    ALTER TABLE public."Setoran" ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'Setoran' AND policyname = 'anon realtime read'
  ) THEN
    CREATE POLICY "anon realtime read" ON public."Setoran" FOR SELECT TO anon USING (true);
  END IF;
END $$;

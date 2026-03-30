-- Fix: Add RLS policies for cierres_mision so staff PWA
-- can INSERT/UPDATE/SELECT records via client-side Supabase.
-- Both 'authenticated' and 'anon' roles need access because
-- createBrowserClient uses the anon key with session-based auth.

-- Authenticated role
CREATE POLICY "Allow authenticated insert" ON public.cierres_mision
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update" ON public.cierres_mision
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated select" ON public.cierres_mision
  FOR SELECT TO authenticated USING (true);

-- Anon role (needed because createBrowserClient uses anon key)
CREATE POLICY "Allow anon insert" ON public.cierres_mision
  FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update" ON public.cierres_mision
  FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon select" ON public.cierres_mision
  FOR SELECT TO anon USING (true);

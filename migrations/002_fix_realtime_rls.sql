-- ============================================================
-- PARCHE 002: Fix Realtime — Permitir SELECT público para que
-- el canal de Supabase Realtime (anon key) pueda empujar eventos.
-- ============================================================

-- crm_contacts: permitir lectura al anon key (Realtime lo necesita)
CREATE POLICY "Public read crm_contacts" ON public.crm_contacts
    FOR SELECT USING (true);

-- whatsapp_messages: permitir lectura al anon key (Realtime lo necesita)
CREATE POLICY "Public read whatsapp_messages" ON public.whatsapp_messages
    FOR SELECT USING (true);

-- NOTA: Las escrituras siguen protegidas — solo service_role puede INSERT/UPDATE/DELETE.
-- Esto es seguro porque el CRM es una herramienta interna de administración.

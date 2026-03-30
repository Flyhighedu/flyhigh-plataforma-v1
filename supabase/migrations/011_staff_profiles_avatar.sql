-- =====================================================
-- FlyHigh EDU — Staff Profiles Avatar Migration
-- Módulo: ID Studio
-- =====================================================

-- 1. Añadir columna JSONB para guardar el objeto de configuración del Avatar
ALTER TABLE public.staff_profiles 
ADD COLUMN IF NOT EXISTS avatar_config jsonb;

-- NOTA DE SEGURIDAD: 
-- En las migraciones anteriores (`001_staff_v1_tables.sql`) no se expuso el acceso de UPDATE 
-- sobre tu propio perfil (para evitar una escalada de privilegios seteándote como "admin").
-- En lugar de crear una política insegura "FOR UPDATE TO authenticated WITH CHECK(user_id = auth.uid())"
-- y lidiar con bloqueos de columas en RLS, el ID Studio guardará el Avatar usando 
-- un Endpoint seguro (Next.js server boundary) pasándole el token con un admin Bypass.

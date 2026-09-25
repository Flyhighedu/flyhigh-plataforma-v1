-- 1. Crear función auxiliar en el esquema public para obtener los objetos expirados.
-- Esto permite que la API de Next.js (PostgREST) consulte la metadata de storage.objects
-- de manera segura sin necesidad de exponer el esquema completo 'storage' al público.
CREATE OR REPLACE FUNCTION public.get_expired_storage_objects(bucket_name text, age_days int)
RETURNS TABLE(name text)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT name FROM storage.objects
    WHERE bucket_id = bucket_name
      AND created_at < NOW() - (age_days || ' days')::interval;
$$;

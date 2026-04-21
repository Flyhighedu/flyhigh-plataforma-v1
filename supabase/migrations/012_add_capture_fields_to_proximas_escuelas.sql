DO $$ 
BEGIN
    -- Agregar columna nombre_director si no existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proximas_escuelas' AND column_name='nombre_director') THEN
        ALTER TABLE proximas_escuelas ADD COLUMN nombre_director TEXT;
    END IF;

    -- Agregar columna numero_ninos si no existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proximas_escuelas' AND column_name='numero_ninos') THEN
        ALTER TABLE proximas_escuelas ADD COLUMN numero_ninos INTEGER;
    END IF;

    -- NOTA: "precio" se mapea a cuota_alumno (SSoT). No se crea columna separada.
END $$;

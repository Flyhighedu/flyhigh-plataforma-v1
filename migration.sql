-- Migración para actualizar la tabla de Puntos de Interés
-- Separar la autoevaluación en 2 preguntas basadas en los 2 datos clave

-- 1. Agregar las nuevas columnas
ALTER TABLE puntos_interes 
ADD COLUMN IF NOT EXISTS pregunta_estudio_1 TEXT,
ADD COLUMN IF NOT EXISTS pregunta_estudio_2 TEXT;

-- 2. Opcional: Migrar datos si tenías la 'pregunta_estudio' anterior (esto pondrá la pregunta vieja en la #1)
UPDATE puntos_interes 
SET pregunta_estudio_1 = pregunta_estudio 
WHERE pregunta_estudio IS NOT NULL AND pregunta_estudio_1 IS NULL;

-- 3. (Opcional) Eliminar la columna antigua, o dejarla mientras verificas
-- ALTER TABLE puntos_interes DROP COLUMN pregunta_estudio;

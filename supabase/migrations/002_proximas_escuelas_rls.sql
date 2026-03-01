-- Enable RLS
ALTER TABLE proximas_escuelas ENABLE ROW LEVEL SECURITY;

-- Policy for reading (SELECT)
-- Allow authenticated users to see schools
CREATE POLICY "staff_view_proximas_escuelas"
ON proximas_escuelas
FOR SELECT
TO authenticated
USING (true);

-- Policy for inserting (INSERT)
-- Allow authenticated users to create schools (needed for Demo mode)
CREATE POLICY "staff_insert_proximas_escuelas"
ON proximas_escuelas
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy for updating (UPDATE)
CREATE POLICY "staff_update_proximas_escuelas"
ON proximas_escuelas
FOR UPDATE
TO authenticated
USING (true);

-- Policy for deleting (DELETE)
-- Needed for Reset button
CREATE POLICY "staff_delete_proximas_escuelas"
ON proximas_escuelas
FOR DELETE
TO authenticated
USING (true);

-- Extend a pilot's private preparation. Do not update school coordinates.
alter table public.visit_narration_plans
    add column if not exists preparation_context jsonb not null default '{}'::jsonb
    check (jsonb_typeof(preparation_context) = 'object');
notify pgrst, 'reload schema';

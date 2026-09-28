-- A pilot's habit is private and never edits the official or personal catalog.
-- Per-visit intent remains in visit_narration_plans.items (JSON, model_version 2).
create table if not exists public.pilot_poi_preferences (
    user_id uuid not null references auth.users(id) on delete cascade,
    poi_id text not null check (length(poi_id) between 1 and 160),
    behavior text not null check (behavior in ('route', 'reference')),
    updated_at timestamptz not null default now(),
    primary key (user_id, poi_id)
);
alter table public.pilot_poi_preferences enable row level security;
drop policy if exists pilot_poi_preferences_read_own on public.pilot_poi_preferences;
create policy pilot_poi_preferences_read_own on public.pilot_poi_preferences for select to authenticated
    using (user_id = auth.uid() and exists (
        select 1 from public.staff_profiles p where p.user_id = auth.uid() and p.is_active and p.role in ('pilot', 'assistant')
    ));
revoke all on public.pilot_poi_preferences from anon, authenticated;
grant select on public.pilot_poi_preferences to authenticated;
grant all on public.pilot_poi_preferences to service_role;
notify pgrst, 'reload schema';

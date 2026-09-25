-- Preparation only: never writes journeys, flights or check-in state.
create table if not exists public.visit_narration_plans (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    visit_id integer not null references public.proximas_escuelas(id) on delete cascade,
    visit_date date not null,
    items jsonb not null default '[]'::jsonb,
    status text not null default 'draft' check (status in ('draft', 'ready')),
    revision integer not null default 1 check (revision > 0),
    confirmed_at timestamptz,
    updated_at timestamptz not null default now(),
    unique (user_id, visit_id),
    check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) <= 40),
    check (status <> 'ready' or (jsonb_array_length(items) > 0 and confirmed_at is not null))
);
alter table public.visit_narration_plans enable row level security;
drop policy if exists visit_narration_plans_read_own on public.visit_narration_plans;
create policy visit_narration_plans_read_own on public.visit_narration_plans
    for select to authenticated using (
        user_id = auth.uid() and exists (
            select 1 from public.staff_profiles p
            where p.user_id = auth.uid() and p.is_active and p.role in ('pilot', 'assistant')
        )
    );
-- Mutations go through the authenticated preparation API, which validates
-- ownership, current source content, visit accessibility and optimistic revision.
revoke all on public.visit_narration_plans from anon, authenticated;
grant select on public.visit_narration_plans to authenticated;
grant all on public.visit_narration_plans to service_role;
notify pgrst, 'reload schema';

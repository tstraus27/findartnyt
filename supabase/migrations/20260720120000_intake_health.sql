do $$ begin
  create type public.intake_run_status as enum ('healthy', 'warning', 'error', 'unknown');
exception when duplicate_object then null; end $$;

create table if not exists public.intake_runs (
  id uuid primary key default gen_random_uuid(),
  source_id text not null,
  status public.intake_run_status not null default 'unknown',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_ms integer,
  incoming_records integer not null default 0,
  creates integer not null default 0,
  updates integer not null default 0,
  possible_duplicates integer not null default 0,
  conflicts integer not null default 0,
  unchanged integer not null default 0,
  pages_fetched integer not null default 0,
  error_message text,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.intake_log_events (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.intake_runs(id) on delete set null,
  source_id text not null,
  status public.intake_run_status not null default 'unknown',
  event_type text not null,
  message text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists intake_runs_source_finished_idx
on public.intake_runs (source_id, finished_at desc);

create index if not exists intake_log_events_created_idx
on public.intake_log_events (created_at desc);

alter table public.intake_runs enable row level security;
alter table public.intake_log_events enable row level security;

drop policy if exists "admins read intake runs" on public.intake_runs;
create policy "admins read intake runs" on public.intake_runs
for select using (public.is_admin());

drop policy if exists "admins read intake logs" on public.intake_log_events;
create policy "admins read intake logs" on public.intake_log_events
for select using (public.is_admin());

create or replace view public.intake_source_health as
with latest as (
  select distinct on (source_id)
    *
  from public.intake_runs
  order by source_id, coalesce(finished_at, started_at) desc
),
rollup as (
  select
    runs.source_id,
    count(*)::integer as run_count,
    count(*) filter (where runs.status = 'healthy')::integer as success_count,
    count(*) filter (where runs.status = 'warning')::integer as warning_count,
    count(*) filter (where runs.status = 'error')::integer as failure_count,
    max(coalesce(runs.finished_at, runs.started_at)) filter (where runs.status in ('healthy', 'warning')) as last_success_at,
    max(coalesce(runs.finished_at, runs.started_at)) filter (where runs.status = 'error') as last_error_at,
    (array_agg(runs.error_message order by coalesce(runs.finished_at, runs.started_at) desc) filter (where runs.status = 'error'))[1] as last_error_message
  from public.intake_runs runs
  group by runs.source_id
),
review_rollup as (
  select
    staging_items.source_id,
    count(*) filter (where staging_items.review_status in ('pending', 'reviewer_approved', 'admin_approved'))::integer as pending_review,
    count(*) filter (where staging_items.review_status = 'needs_revision')::integer as needs_revision,
    count(*) filter (where staging_items.review_status = 'promoted')::integer as promoted
  from public.staging_items
  group by staging_items.source_id
)
select
  latest.source_id,
  latest.status,
  latest.started_at,
  latest.finished_at,
  latest.duration_ms,
  latest.incoming_records,
  latest.creates,
  latest.updates,
  latest.possible_duplicates,
  latest.conflicts,
  latest.unchanged,
  latest.pages_fetched,
  latest.error_message,
  latest.summary,
  to_jsonb(latest.*) as latest_run,
  coalesce(rollup.run_count, 0) as run_count,
  coalesce(rollup.success_count, 0) as success_count,
  coalesce(rollup.warning_count, 0) as warning_count,
  coalesce(rollup.failure_count, 0) as failure_count,
  rollup.last_success_at,
  rollup.last_error_at,
  rollup.last_error_message,
  coalesce(review_rollup.pending_review, 0) as pending_review,
  coalesce(review_rollup.needs_revision, 0) as needs_revision,
  coalesce(review_rollup.promoted, 0) as promoted
from latest
left join rollup on rollup.source_id = latest.source_id
left join review_rollup on review_rollup.source_id = latest.source_id;

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
    count(*) filter (where staging_items.review_status = 'pending')::integer as pending_review,
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

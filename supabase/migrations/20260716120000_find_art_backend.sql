-- Supabase projects provide gen_random_uuid() by default. Do not create extensions
-- here because the dashboard SQL Editor may run pasted migrations in a context
-- that rejects CREATE EXTENSION.

do $$ begin
  create type public.app_role as enum ('visitor', 'reviewer', 'admin', 'owner');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.exhibition_publication_status as enum ('draft', 'published', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.staging_review_status as enum (
    'pending',
    'reviewer_approved',
    'rejected',
    'needs_revision',
    'admin_approved',
    'promoted'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.review_decision_type as enum ('looks_good', 'reject', 'needs_revision', 'comment');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.featured_content_status as enum ('draft', 'published', 'archived');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text,
  role public.app_role not null default 'visitor',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  address text,
  neighborhood text,
  borough text,
  city text,
  latitude numeric,
  longitude numeric,
  source_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.exhibitions (
  id text primary key,
  title text not null,
  venue_id uuid references public.venues(id),
  venue_name text,
  start_date date,
  end_date date,
  date_text text,
  description text,
  image_url text,
  source_url text not null,
  exhibition_url text,
  source text,
  review_status text,
  publication_status public.exhibition_publication_status not null default 'published',
  promoted_from_staging_item_id text,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.staging_items (
  id text primary key,
  source_id text not null,
  proposal_type text not null,
  canonical_id text,
  review_status public.staging_review_status not null default 'pending',
  proposed jsonb not null default '{}'::jsonb,
  before jsonb,
  changed_fields text[] not null default array[]::text[],
  dedupe jsonb,
  conflict jsonb,
  source jsonb,
  extracted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.review_decisions (
  id uuid primary key default gen_random_uuid(),
  staging_item_id text not null references public.staging_items(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  decision public.review_decision_type not null,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles(id) on delete set null,
  action_type text not null,
  target_table text not null,
  target_id text not null,
  before jsonb,
  after jsonb,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.featured_content (
  id uuid primary key default gen_random_uuid(),
  status public.featured_content_status not null default 'draft',
  exhibition_id text references public.exhibitions(id) on delete set null,
  title text not null,
  dek text,
  body_markdown text,
  image_url text,
  cta_url text,
  published_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.saved_exhibitions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  exhibition_id text not null references public.exhibitions(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, exhibition_id)
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_profiles_updated_at on public.profiles;
create trigger touch_profiles_updated_at before update on public.profiles
for each row execute function public.touch_updated_at();

drop trigger if exists touch_venues_updated_at on public.venues;
create trigger touch_venues_updated_at before update on public.venues
for each row execute function public.touch_updated_at();

drop trigger if exists touch_exhibitions_updated_at on public.exhibitions;
create trigger touch_exhibitions_updated_at before update on public.exhibitions
for each row execute function public.touch_updated_at();

drop trigger if exists touch_staging_items_updated_at on public.staging_items;
create trigger touch_staging_items_updated_at before update on public.staging_items
for each row execute function public.touch_updated_at();

drop trigger if exists touch_featured_content_updated_at on public.featured_content;
create trigger touch_featured_content_updated_at before update on public.featured_content
for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
begin
  insert into public.profiles (user_id, display_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', new.email), 'visitor')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.current_profile_id()
returns uuid
stable
security definer
set search_path = public
language sql
as $$
  select id from public.profiles where user_id = auth.uid();
$$;

create or replace function public.current_role()
returns public.app_role
stable
security definer
set search_path = public
language sql
as $$
  select coalesce((select role from public.profiles where user_id = auth.uid()), 'visitor'::public.app_role);
$$;

create or replace function public.is_reviewer_or_admin()
returns boolean
stable
language sql
as $$
  select public.current_role() in ('reviewer', 'admin', 'owner');
$$;

create or replace function public.is_admin()
returns boolean
stable
language sql
as $$
  select public.current_role() in ('admin', 'owner');
$$;

alter table public.profiles enable row level security;
alter table public.venues enable row level security;
alter table public.exhibitions enable row level security;
alter table public.staging_items enable row level security;
alter table public.review_decisions enable row level security;
alter table public.admin_actions enable row level security;
alter table public.featured_content enable row level security;
alter table public.saved_exhibitions enable row level security;

drop policy if exists "profiles self read" on public.profiles;
create policy "profiles self read" on public.profiles
for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "admins manage profiles" on public.profiles;
create policy "admins manage profiles" on public.profiles
for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "public read venues" on public.venues;
create policy "public read venues" on public.venues for select using (true);

drop policy if exists "admins manage venues" on public.venues;
create policy "admins manage venues" on public.venues
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "public read published exhibitions" on public.exhibitions;
create policy "public read published exhibitions" on public.exhibitions
for select using (publication_status = 'published' or public.is_reviewer_or_admin());

drop policy if exists "admins manage exhibitions" on public.exhibitions;
create policy "admins manage exhibitions" on public.exhibitions
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "reviewers read staging" on public.staging_items;
create policy "reviewers read staging" on public.staging_items
for select using (public.is_reviewer_or_admin());

drop policy if exists "admins manage staging" on public.staging_items;
create policy "admins manage staging" on public.staging_items
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "reviewers insert decisions" on public.review_decisions;
create policy "reviewers insert decisions" on public.review_decisions
for insert with check (public.is_reviewer_or_admin() and reviewer_id = public.current_profile_id());

drop policy if exists "reviewers read decisions" on public.review_decisions;
create policy "reviewers read decisions" on public.review_decisions
for select using (public.is_reviewer_or_admin());

drop policy if exists "admins read actions" on public.admin_actions;
create policy "admins read actions" on public.admin_actions for select using (public.is_admin());

drop policy if exists "public read published featured" on public.featured_content;
create policy "public read published featured" on public.featured_content
for select using (status in ('published', 'archived') or public.is_admin());

drop policy if exists "admins manage featured" on public.featured_content;
create policy "admins manage featured" on public.featured_content
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "visitors manage own saves" on public.saved_exhibitions;
create policy "visitors manage own saves" on public.saved_exhibitions
for all using (user_id = public.current_profile_id()) with check (user_id = public.current_profile_id());

create or replace function public.submit_review_decision(
  staging_item_id text,
  decision public.review_decision_type,
  notes text default null
)
returns public.review_decisions
language plpgsql
security definer
set search_path = public
as $$
declare
  reviewer uuid := public.current_profile_id();
  inserted public.review_decisions;
begin
  if not public.is_reviewer_or_admin() then
    raise exception 'Only reviewers and admins can review staging items.';
  end if;
  if reviewer is null then
    raise exception 'No profile found for current user.';
  end if;

  insert into public.review_decisions (staging_item_id, reviewer_id, decision, notes)
  values (submit_review_decision.staging_item_id, reviewer, decision, notes)
  returning * into inserted;

  update public.staging_items
  set review_status = case
    when decision = 'looks_good' then 'reviewer_approved'::public.staging_review_status
    when decision = 'reject' then 'rejected'::public.staging_review_status
    when decision = 'needs_revision' then 'needs_revision'::public.staging_review_status
    else review_status
  end
  where id = submit_review_decision.staging_item_id;

  return inserted;
end;
$$;

create or replace function public.admin_update_staging_status(
  staging_item_id text,
  next_status public.staging_review_status,
  notes text default null
)
returns public.staging_items
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_profile uuid := public.current_profile_id();
  before_row jsonb;
  updated public.staging_items;
begin
  if not public.is_admin() then
    raise exception 'Only admins can update staging status.';
  end if;

  select to_jsonb(staging_items.*) into before_row from public.staging_items where id = staging_item_id;
  update public.staging_items set review_status = next_status where id = staging_item_id returning * into updated;

  insert into public.admin_actions (admin_id, action_type, target_table, target_id, before, after, notes)
  values (admin_profile, 'update_staging_status', 'staging_items', staging_item_id, before_row, to_jsonb(updated), notes);

  return updated;
end;
$$;

create or replace function public.admin_update_staging_proposed(
  staging_item_id text,
  proposed jsonb,
  notes text default null
)
returns public.staging_items
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_profile uuid := public.current_profile_id();
  before_row jsonb;
  updated public.staging_items;
begin
  if not public.is_admin() then
    raise exception 'Only admins can edit staged proposal data.';
  end if;

  select to_jsonb(staging_items.*) into before_row from public.staging_items where id = staging_item_id;
  update public.staging_items
  set proposed = admin_update_staging_proposed.proposed,
      review_status = case
        when review_status = 'promoted' then review_status
        else 'needs_revision'::public.staging_review_status
      end
  where id = staging_item_id
  returning * into updated;

  insert into public.admin_actions (admin_id, action_type, target_table, target_id, before, after, notes)
  values (admin_profile, 'edit_staging_proposal', 'staging_items', staging_item_id, before_row, to_jsonb(updated), notes);

  return updated;
end;
$$;

create or replace function public.admin_promote_staging_item(
  staging_item_id text,
  notes text default null
)
returns public.exhibitions
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_profile uuid := public.current_profile_id();
  item public.staging_items;
  proposed jsonb;
  venue_row public.venues;
  promoted public.exhibitions;
begin
  if not public.is_admin() then
    raise exception 'Only admins can promote staging items.';
  end if;

  select * into item from public.staging_items where id = staging_item_id for update;
  if item.id is null then
    raise exception 'Staging item not found.';
  end if;
  if item.proposal_type not in ('create', 'update') then
    raise exception 'Only create/update proposals can be promoted by this function.';
  end if;

  proposed := item.proposed;

  insert into public.venues (name, address, neighborhood, borough, city)
  values (
    proposed->>'venue',
    proposed->>'venueAddress',
    proposed->>'neighborhood',
    proposed->>'borough',
    proposed->>'city'
  )
  on conflict (name) do update set
    address = coalesce(excluded.address, public.venues.address),
    neighborhood = coalesce(excluded.neighborhood, public.venues.neighborhood),
    borough = coalesce(excluded.borough, public.venues.borough),
    city = coalesce(excluded.city, public.venues.city)
  returning * into venue_row;

  insert into public.exhibitions (
    id, title, venue_id, venue_name, start_date, end_date, date_text, description,
    image_url, source_url, exhibition_url, source, review_status, publication_status,
    promoted_from_staging_item_id, raw
  )
  values (
    proposed->>'id',
    proposed->>'title',
    venue_row.id,
    proposed->>'venue',
    nullif(proposed->>'startDate', '')::date,
    nullif(proposed->>'endDate', '')::date,
    proposed->>'dateText',
    proposed->>'description',
    proposed->>'imageUrl',
    coalesce(proposed->>'sourceUrl', item.source->>'url'),
    proposed->>'exhibitionUrl',
    proposed->>'source',
    'approved',
    'published',
    item.id,
    proposed
  )
  on conflict (id) do update set
    title = excluded.title,
    venue_id = excluded.venue_id,
    venue_name = excluded.venue_name,
    start_date = excluded.start_date,
    end_date = excluded.end_date,
    date_text = excluded.date_text,
    description = excluded.description,
    image_url = excluded.image_url,
    source_url = excluded.source_url,
    exhibition_url = excluded.exhibition_url,
    source = excluded.source,
    review_status = excluded.review_status,
    publication_status = excluded.publication_status,
    promoted_from_staging_item_id = excluded.promoted_from_staging_item_id,
    raw = excluded.raw
  returning * into promoted;

  update public.staging_items set review_status = 'promoted' where id = item.id;

  insert into public.admin_actions (admin_id, action_type, target_table, target_id, before, after, notes)
  values (admin_profile, 'promote', 'staging_items', item.id, to_jsonb(item), to_jsonb(promoted), notes);

  return promoted;
end;
$$;

create or replace function public.admin_publish_featured_content(
  content_id uuid,
  notes text default null
)
returns public.featured_content
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_profile uuid := public.current_profile_id();
  before_row jsonb;
  published public.featured_content;
begin
  if not public.is_admin() then
    raise exception 'Only admins can publish featured content.';
  end if;

  select to_jsonb(featured_content.*) into before_row from public.featured_content where id = content_id;
  update public.featured_content set status = 'archived' where status = 'published' and id <> content_id;
  update public.featured_content
  set status = 'published', published_at = now(), updated_by = admin_profile
  where id = content_id
  returning * into published;

  insert into public.admin_actions (admin_id, action_type, target_table, target_id, before, after, notes)
  values (admin_profile, 'publish_featured_content', 'featured_content', content_id::text, before_row, to_jsonb(published), notes);

  return published;
end;
$$;

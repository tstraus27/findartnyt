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
  promoted_date_text text;
begin
  if not public.is_admin() then
    raise exception 'Only admins can promote staged items.';
  end if;

  select * into item from public.staging_items where id = staging_item_id for update;
  if item.id is null then
    raise exception 'Staging item not found: %', staging_item_id;
  end if;

  proposed := item.proposed;
  if nullif(proposed->>'startDate', '') is not null and nullif(proposed->>'endDate', '') is not null then
    promoted_date_text := (proposed->>'startDate') || ' - ' || (proposed->>'endDate');
  else
    promoted_date_text := proposed->>'dateText';
  end if;

  insert into public.venues (name, address, neighborhood, borough, city)
  values (
    proposed->>'venue',
    proposed->>'venueAddress',
    proposed->>'neighborhood',
    proposed->>'borough',
    coalesce(proposed->>'city', 'New York')
  )
  on conflict (name) do update
  set address = coalesce(excluded.address, public.venues.address),
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
    promoted_date_text,
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
  on conflict (id) do update
  set title = excluded.title,
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
    raw = excluded.raw,
    updated_at = now()
  returning * into promoted;

  update public.staging_items set review_status = 'promoted' where id = item.id;

  insert into public.admin_actions (admin_id, action_type, target_table, target_id, before, after, notes)
  values (admin_profile, 'promote', 'staging_items', item.id, to_jsonb(item), to_jsonb(promoted), notes);

  return promoted;
end;
$$;

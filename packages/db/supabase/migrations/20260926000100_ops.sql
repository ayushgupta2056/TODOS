-- Rate limiting (works on Cloudflare Workers, where in-memory limits don't hold) and
-- privacy/ops helpers. All service-role only.

create table public.rate_limits (
  key           text not null,
  window_start  timestamptz not null,
  hits          integer not null default 0,
  primary key (key, window_start)
);
alter table public.rate_limits enable row level security;

-- Returns true if the call is allowed (and counts it).
create or replace function public.hit_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits integer;
begin
  insert into public.rate_limits (key, window_start, hits) values (p_key, v_window, 1)
  on conflict (key, window_start) do update set hits = public.rate_limits.hits + 1
  returning hits into v_hits;
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;
  return v_hits <= p_limit;
end $$;

-- Delete an event: hide it and drop every face embedding immediately, then let the worker
-- purge files and rows (delete_event job). Called after the server has checked ownership.
create or replace function public.request_event_deletion(p_event_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  update public.events set status = 'deleting' where id = p_event_id;
  update public.faces set cluster_id = null where event_id = p_event_id;
  delete from public.clusters where event_id = p_event_id;
  delete from public.faces where event_id = p_event_id;
  update public.guest_sessions set matched_photo_ids = null where event_id = p_event_id;
  insert into public.jobs (type, payload, dedupe_key)
  values ('delete_event', jsonb_build_object('event_id', p_event_id::text, 'reason', p_reason),
          'delete:' || p_event_id::text)
  on conflict do nothing;
end $$;

-- Studio storage used (originals + derivatives are approximated by original bytes * 1.25).
create or replace function public.studio_storage_bytes(p_studio_id uuid)
returns bigint language sql stable security definer set search_path = ''
as $$ select coalesce(sum(bytes), 0)::bigint * 5 / 4 from public.photos where studio_id = p_studio_id $$;

revoke all on function public.hit_rate_limit(text, integer, integer) from public, anon, authenticated;
revoke all on function public.request_event_deletion(uuid, text) from public, anon, authenticated;
revoke all on function public.studio_storage_bytes(uuid) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, integer, integer) to service_role;
grant execute on function public.request_event_deletion(uuid, text) to service_role;
grant execute on function public.studio_storage_bytes(uuid) to service_role;

-- Glimpse: full schema for a NEW hosted Supabase project. Generated; do not edit.
-- Run once in Dashboard -> SQL Editor. Re-running on an existing project will fail (tables exist).

-- ===== 20260926000000_init.sql =====
-- Glimpse schema v1
-- Rules: every face query is scoped by event_id; guests never touch tables directly (server
-- routes use the service role); studios see only their own rows via RLS.

create extension if not exists vector with schema extensions;

-- ---------------------------------------------------------------------------------------------
-- Plans
-- ---------------------------------------------------------------------------------------------
create type public.plan_tier as enum ('trial', 'starter', 'pro', 'studio');

create table public.plans (
  id                 public.plan_tier primary key,
  name               text not null,
  price_inr_monthly  integer not null,
  photos_per_month   integer not null,
  storage_gb         integer not null,
  active_events      integer,             -- null = unlimited
  custom_branding    boolean not null,
  sort               integer not null
);

insert into public.plans values
  ('trial',   'Free trial', 0,    500,    2,    1,    false, 0),
  ('starter', 'Starter',    999,  5000,   50,   3,    false, 1),
  ('pro',     'Pro',        2499, 25000,  250,  10,   true,  2),
  ('studio',  'Studio',     5999, 100000, 1000, null, true,  3);

-- ---------------------------------------------------------------------------------------------
-- Studios (photographer accounts)
-- ---------------------------------------------------------------------------------------------
create table public.studios (
  id                        uuid primary key default gen_random_uuid(),
  owner_id                  uuid not null unique references auth.users (id) on delete cascade,
  name                      text not null check (char_length(name) between 1 and 80),
  plan                      public.plan_tier not null default 'trial',
  plan_status               text not null default 'active'
                              check (plan_status in ('active', 'past_due', 'cancelled')),
  plan_renews_at            timestamptz,
  brand_logo_key            text,
  brand_color               text not null default '#FF8A3D' check (brand_color ~ '^#[0-9A-Fa-f]{6}$'),
  razorpay_customer_id      text,
  razorpay_subscription_id  text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create or replace function public.my_studio_ids()
returns setof uuid
language sql stable security definer set search_path = ''
as $$ select id from public.studios where owner_id = auth.uid() $$;

-- ---------------------------------------------------------------------------------------------
-- Events
-- ---------------------------------------------------------------------------------------------
create table public.events (
  id                uuid primary key default gen_random_uuid(),
  studio_id         uuid not null references public.studios (id) on delete cascade,
  slug              text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,62}$'),
  name              text not null check (char_length(name) between 1 and 120),
  event_date        date,
  cover_key         text,
  visibility        text not null default 'public' check (visibility in ('public', 'pin')),
  pin_hash          text,
  allow_download    boolean not null default true,
  watermark         boolean not null default false,
  show_all_gallery  boolean not null default false,
  expires_at        timestamptz,
  status            text not null default 'live' check (status in ('live', 'archived', 'deleting')),
  photo_count       integer not null default 0,
  processed_count   integer not null default 0,
  failed_count      integer not null default 0,
  face_count        integer not null default 0,
  people_count      integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (visibility = 'public' or pin_hash is not null)
);
create index events_studio_idx on public.events (studio_id, created_at desc);
create index events_expiry_idx on public.events (expires_at) where expires_at is not null;

-- ---------------------------------------------------------------------------------------------
-- Photos
-- ---------------------------------------------------------------------------------------------
create table public.photos (
  id               uuid primary key default gen_random_uuid(),
  event_id         uuid not null references public.events (id) on delete cascade,
  studio_id        uuid not null references public.studios (id) on delete cascade,
  r2_key_original  text not null,
  r2_key_web       text,
  r2_key_web_wm    text,
  r2_key_thumb     text,
  original_name    text,
  content_type     text,
  width            integer,
  height           integer,
  bytes            bigint not null default 0,
  sha256           text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  taken_at         timestamptz,
  blurhash         text,
  face_count       integer not null default 0,
  status           text not null default 'uploaded'
                     check (status in ('uploaded', 'processing', 'done', 'failed', 'no_faces')),
  error            text,
  created_at       timestamptz not null default now(),
  processed_at     timestamptz,
  unique (event_id, sha256)
);
create index photos_event_status_idx on public.photos (event_id, status);
create index photos_event_taken_idx on public.photos (event_id, taken_at);
create index photos_studio_idx on public.photos (studio_id);

-- ---------------------------------------------------------------------------------------------
-- Faces + clusters
-- ---------------------------------------------------------------------------------------------
create table public.clusters (
  id                      uuid primary key default gen_random_uuid(),
  event_id                uuid not null references public.events (id) on delete cascade,
  representative_face_id  uuid,
  size                    integer not null,
  centroid                extensions.vector(128) not null,
  engine_version          text not null,
  created_at              timestamptz not null default now()
);
create index clusters_event_idx on public.clusters (event_id);

create table public.faces (
  id              uuid primary key default gen_random_uuid(),
  photo_id        uuid not null references public.photos (id) on delete cascade,
  event_id        uuid not null references public.events (id) on delete cascade,
  bbox            real[] not null check (array_length(bbox, 1) = 4),
  landmarks       real[] not null check (array_length(landmarks, 1) = 10),
  det_score       real not null,
  blur_score      real not null,
  quality         text not null check (quality in ('ok', 'small', 'blurry')),
  embedding       extensions.vector(128),   -- null for filtered faces
  cluster_id      uuid references public.clusters (id) on delete set null,
  engine_version  text not null,
  created_at      timestamptz not null default now(),
  check ((quality = 'ok') = (embedding is not null))
);
create index faces_event_idx on public.faces (event_id);
create index faces_photo_idx on public.faces (photo_id);
create index faces_cluster_idx on public.faces (cluster_id);
create index faces_embedding_hnsw on public.faces
  using hnsw (embedding extensions.vector_cosine_ops);

alter table public.clusters
  add constraint clusters_representative_fk
  foreign key (representative_face_id) references public.faces (id) on delete set null;

-- ---------------------------------------------------------------------------------------------
-- Queue (Postgres-only; claimed with FOR UPDATE SKIP LOCKED)
-- ---------------------------------------------------------------------------------------------
create table public.jobs (
  id            bigint generated always as identity primary key,
  type          text not null check (type in ('process_photo', 'cluster_event', 'delete_event',
                                               'rewatermark_event')),
  payload       jsonb not null default '{}',
  status        text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed')),
  attempts      integer not null default 0,
  max_attempts  integer not null default 5,
  run_after     timestamptz not null default now(),
  locked_at     timestamptz,
  locked_by     text,
  last_error    text,
  dedupe_key    text,
  created_at    timestamptz not null default now(),
  finished_at   timestamptz
);
create index jobs_claim_idx on public.jobs (run_after, id) where status = 'queued';
create index jobs_running_idx on public.jobs (locked_at) where status = 'running';
create unique index jobs_dedupe_idx on public.jobs (dedupe_key) where status = 'queued';

-- ---------------------------------------------------------------------------------------------
-- Guests, usage, privacy, audit
-- ---------------------------------------------------------------------------------------------
create table public.guest_sessions (
  id                 uuid primary key default gen_random_uuid(),
  event_id           uuid not null references public.events (id) on delete cascade,
  consent_at         timestamptz not null,
  consent_version    text not null,
  ip_hash            text,
  matched_count      integer,
  -- The list of matched photos is kept briefly so the guest can download a ZIP, then wiped.
  -- No selfie and no embedding is ever stored.
  matched_photo_ids  uuid[],
  matches_expire_at  timestamptz,
  searched_at        timestamptz,
  created_at         timestamptz not null default now()
);
create index guest_sessions_event_idx on public.guest_sessions (event_id);
create index guest_sessions_expiry_idx on public.guest_sessions (matches_expire_at)
  where matched_photo_ids is not null;

create table public.usage (
  studio_id         uuid not null references public.studios (id) on delete cascade,
  month             date not null,
  photos_uploaded   integer not null default 0,
  photos_processed  integer not null default 0,
  primary key (studio_id, month)
);

create table public.privacy_requests (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid references public.events (id) on delete set null,
  event_slug  text,
  email       text not null,
  message     text,
  status      text not null default 'open' check (status in ('open', 'done', 'rejected')),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.audit_log (
  id          bigint generated always as identity primary key,
  studio_id   uuid references public.studios (id) on delete set null,
  event_id    uuid,
  actor       text not null,
  action      text not null,
  detail      jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
create index audit_log_studio_idx on public.audit_log (studio_id, created_at desc);

-- ---------------------------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger studios_touch before update on public.studios
  for each row execute function public.touch_updated_at();
create trigger events_touch before update on public.events
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------------------------
alter table public.plans             enable row level security;
alter table public.studios           enable row level security;
alter table public.events            enable row level security;
alter table public.photos            enable row level security;
alter table public.faces             enable row level security;
alter table public.clusters          enable row level security;
alter table public.jobs              enable row level security;
alter table public.guest_sessions    enable row level security;
alter table public.usage             enable row level security;
alter table public.privacy_requests  enable row level security;
alter table public.audit_log         enable row level security;

create policy plans_read on public.plans for select to anon, authenticated using (true);

create policy studios_select on public.studios for select to authenticated
  using (owner_id = (select auth.uid()));
create policy studios_insert on public.studios for insert to authenticated
  with check (owner_id = (select auth.uid()) and plan = 'trial');
-- Plan/billing columns are changed only by the server (service role); see column grants below.
create policy studios_update on public.studios for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create policy events_owner on public.events for all to authenticated
  using (studio_id in (select public.my_studio_ids()))
  with check (studio_id in (select public.my_studio_ids()));

create policy photos_select on public.photos for select to authenticated
  using (studio_id in (select public.my_studio_ids()));
create policy photos_delete on public.photos for delete to authenticated
  using (studio_id in (select public.my_studio_ids()));

create policy faces_select on public.faces for select to authenticated
  using (event_id in (select id from public.events where studio_id in (select public.my_studio_ids())));
create policy clusters_select on public.clusters for select to authenticated
  using (event_id in (select id from public.events where studio_id in (select public.my_studio_ids())));

create policy usage_select on public.usage for select to authenticated
  using (studio_id in (select public.my_studio_ids()));
create policy audit_select on public.audit_log for select to authenticated
  using (studio_id in (select public.my_studio_ids()));
-- jobs, guest_sessions, privacy_requests: no policies => service role only.

-- Studios may edit their name/branding but never their plan or billing ids.
revoke update on public.studios from authenticated;
grant update (name, brand_logo_key, brand_color) on public.studios to authenticated;
-- Counters on events are maintained by the worker only.
revoke update on public.events from authenticated;
grant update (name, event_date, cover_key, visibility, pin_hash, allow_download, watermark,
              show_all_gallery, expires_at, status) on public.events to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Server-side functions (service role only)
-- ---------------------------------------------------------------------------------------------

-- Register an uploaded original and enqueue processing. Idempotent on (event_id, sha256).
create or replace function public.register_photo(
  p_event_id uuid, p_key text, p_name text, p_content_type text, p_bytes bigint, p_sha256 text
) returns table (photo_id uuid, created boolean)
language plpgsql security definer set search_path = ''
as $$
declare
  v_studio uuid;
  v_id uuid;
begin
  select studio_id into v_studio from public.events where id = p_event_id and status = 'live';
  if v_studio is null then
    raise exception 'event not found or not live';
  end if;
  insert into public.photos (event_id, studio_id, r2_key_original, original_name, content_type, bytes, sha256)
  values (p_event_id, v_studio, p_key, p_name, p_content_type, p_bytes, p_sha256)
  on conflict (event_id, sha256) do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from public.photos where event_id = p_event_id and sha256 = p_sha256;
    return query select v_id, false;
    return;
  end if;
  insert into public.jobs (type, payload) values ('process_photo', jsonb_build_object('photo_id', v_id));
  update public.events set photo_count = photo_count + 1 where id = p_event_id;
  insert into public.usage (studio_id, month, photos_uploaded)
  values (v_studio, date_trunc('month', now())::date, 1)
  on conflict (studio_id, month) do update set photos_uploaded = public.usage.photos_uploaded + 1;
  return query select v_id, true;
end $$;

-- Recompute an event's live counters (called by the worker after each batch).
create or replace function public.refresh_event_stats(p_event_id uuid)
returns void language sql security definer set search_path = ''
as $$
  update public.events e set
    photo_count     = s.total,
    processed_count = s.processed,
    failed_count    = s.failed,
    face_count      = (select count(*) from public.faces f where f.event_id = p_event_id and f.quality = 'ok'),
    people_count    = (select count(*) from public.clusters c where c.event_id = p_event_id)
  from (
    select count(*) as total,
           count(*) filter (where status in ('done', 'no_faces', 'failed')) as processed,
           count(*) filter (where status = 'failed') as failed
    from public.photos where event_id = p_event_id
  ) s
  where e.id = p_event_id
$$;

-- Event-scoped face search. Exact cosine within one event (no approximate misses), then
-- cluster expansion for clusters whose centroid passes the stricter threshold.
create or replace function public.search_event_faces(
  p_event_id uuid,
  p_embedding extensions.vector(128),
  p_engine_version text,
  p_threshold real,
  p_cluster_threshold real,
  p_limit integer default 5000
) returns table (photo_id uuid, score real, via_cluster boolean, taken_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  with direct as (
    select f.photo_id, max(1 - (f.embedding operator(extensions.<=>) p_embedding))::real as score
    from public.faces f
    where f.event_id = p_event_id
      and f.engine_version = p_engine_version
      and f.embedding is not null
      and (f.embedding operator(extensions.<=>) p_embedding) <= 1 - p_threshold
    group by f.photo_id
  ),
  strong as (
    select c.id, (1 - (c.centroid operator(extensions.<=>) p_embedding))::real as score
    from public.clusters c
    where c.event_id = p_event_id
      and c.engine_version = p_engine_version
      and (c.centroid operator(extensions.<=>) p_embedding) <= 1 - p_cluster_threshold
  ),
  via as (
    select f.photo_id, max(s.score) as score
    from public.faces f join strong s on s.id = f.cluster_id
    where f.event_id = p_event_id
    group by f.photo_id
  ),
  merged as (
    select d.photo_id, d.score, false as via_cluster from direct d
    union all
    select v.photo_id, v.score, true from via v
    where not exists (select 1 from direct d where d.photo_id = v.photo_id)
  )
  select m.photo_id, m.score, m.via_cluster, p.taken_at
  from merged m join public.photos p on p.id = m.photo_id
  where p.event_id = p_event_id and p.status = 'done'
  order by round(m.score::numeric, 3) desc, p.taken_at asc nulls last, m.photo_id
  limit p_limit
$$;

revoke all on function public.register_photo(uuid, text, text, text, bigint, text) from public, anon, authenticated;
revoke all on function public.refresh_event_stats(uuid) from public, anon, authenticated;
revoke all on function public.search_event_faces(uuid, extensions.vector, text, real, real, integer) from public, anon, authenticated;
grant execute on function public.register_photo(uuid, text, text, text, bigint, text) to service_role;
grant execute on function public.refresh_event_stats(uuid) to service_role;
grant execute on function public.search_event_faces(uuid, extensions.vector, text, real, real, integer) to service_role;

-- ---------------------------------------------------------------------------------------------
-- Realtime: the dashboard listens to its own events' counter updates (RLS applies).
-- ---------------------------------------------------------------------------------------------
alter publication supabase_realtime add table public.events;

-- ===== 20260926000100_ops.sql =====
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

-- ===== storage bucket (private; 50 MB per file on the free plan) =====
insert into storage.buckets (id, name, public, file_size_limit)
values ('glimpse', 'glimpse', false, 52428800)
on conflict (id) do nothing;

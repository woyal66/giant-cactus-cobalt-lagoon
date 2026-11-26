# Online track library (Supabase)

Skippers share a track from Navigation → My tracks → Share. Others search it by place or
comment, preview it on the chart and save it to their phone for offline use. The app talks to
a Supabase project (free tier: 500 MB database, plenty for tens of thousands of tracks).

No sign-in. Each shared track has a random secret stored only on the phone that shared it;
that phone alone can remove it. Three reports hide a track until you look at it.

## Set up (once, about 10 minutes)

1. Make a free account at supabase.com and create a project (region: Sydney).
2. Open **SQL Editor → New query**, paste everything in the box below, and press **Run**.
3. Open **Project Settings → API**. Copy the **Project URL** and the **anon public** key.
4. In GitHub: **Settings → Secrets and variables → Actions → Variables**, add
   `VITE_TRACK_LIBRARY_URL` (the Project URL) and `VITE_TRACK_LIBRARY_KEY` (the anon key).
   The anon key is public by design; the rules below are what protect the data.
5. Run the Android release workflow (and "Publish website and depth tiles" for the web app).

```sql
create extension if not exists pgcrypto;

create table public.tracks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 60),
  location text not null default '' check (char_length(location) <= 80),
  comment text not null default '' check (char_length(comment) <= 280),
  pts jsonb not null,
  point_count int not null,
  lat double precision not null,
  lng double precision not null,
  length_m int not null default 0,
  secret_hash text not null,
  reports int not null default 0,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index tracks_pos on public.tracks (lat, lng);

alter table public.tracks enable row level security;
-- Anyone may read visible tracks; nobody may write the table directly.
create policy "read visible" on public.tracks for select using (not hidden);
revoke insert, update, delete on public.tracks from anon, authenticated;
-- The secret's hash is never readable.
revoke select (secret_hash) on public.tracks from anon, authenticated;

create or replace function public.share_track(
  p_title text, p_location text, p_comment text, p_pts jsonb, p_length_m int, p_secret text
) returns uuid language plpgsql security definer set search_path = public as $$
declare n int; new_id uuid;
begin
  n := jsonb_array_length(p_pts);
  if n < 2 or n > 2000 then raise exception 'bad point count'; end if;
  if char_length(p_secret) < 24 then raise exception 'bad secret'; end if;
  insert into tracks (title, location, comment, pts, point_count, lat, lng, length_m, secret_hash)
  values (left(p_title, 60), left(coalesce(p_location, ''), 80), left(coalesce(p_comment, ''), 280),
          p_pts, n, (p_pts->0->>0)::float8, (p_pts->0->>1)::float8, greatest(0, p_length_m),
          encode(digest(p_secret, 'sha256'), 'hex'))
  returning id into new_id;
  return new_id;
end $$;

create or replace function public.remove_track(p_id uuid, p_secret text)
returns void language sql security definer set search_path = public as $$
  delete from tracks where id = p_id and secret_hash = encode(digest(p_secret, 'sha256'), 'hex');
$$;

create or replace function public.report_track(p_id uuid)
returns void language sql security definer set search_path = public as $$
  update tracks set reports = reports + 1, hidden = (reports + 1 >= 3) where id = p_id;
$$;

grant execute on function public.share_track, public.remove_track, public.report_track to anon;
```

## Shared anchorages (same project)

Run this too (SQL Editor → New query → Run). It adds the anchor symbols other skippers share.

```sql
create table public.anchorages (
  id uuid primary key default gen_random_uuid(),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  depth_m real check (depth_m is null or (depth_m > 0 and depth_m < 200)),
  bottom text not null default 'unknown' check (bottom in ('sand','mud','weed','coral rubble','rock','unknown')),
  holding text not null default 'fair' check (holding in ('good','fair','poor')),
  shelter int not null default 0 check (shelter between 0 and 255),
  comment text not null default '' check (char_length(comment) <= 280),
  secret_hash text not null,
  reports int not null default 0,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index anchorages_pos on public.anchorages (lat, lng);

alter table public.anchorages enable row level security;
create policy "read visible" on public.anchorages for select using (not hidden);
revoke insert, update, delete on public.anchorages from anon, authenticated;
revoke select (secret_hash) on public.anchorages from anon, authenticated;

create or replace function public.share_anchorage(
  p_lat float8, p_lng float8, p_depth_m real, p_bottom text, p_holding text, p_shelter int, p_comment text, p_secret text
) returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if char_length(p_secret) < 24 then raise exception 'bad secret'; end if;
  insert into anchorages (lat, lng, depth_m, bottom, holding, shelter, comment, secret_hash)
  values (p_lat, p_lng, p_depth_m, p_bottom, p_holding, p_shelter, left(coalesce(p_comment, ''), 280),
          encode(digest(p_secret, 'sha256'), 'hex'))
  returning id into new_id;
  return new_id;
end $$;

create or replace function public.remove_anchorage(p_id uuid, p_secret text)
returns void language sql security definer set search_path = public as $$
  delete from anchorages where id = p_id and secret_hash = encode(digest(p_secret, 'sha256'), 'hex');
$$;

create or replace function public.report_anchorage(p_id uuid)
returns void language sql security definer set search_path = public as $$
  update anchorages set reports = reports + 1, hidden = (reports + 1 >= 3) where id = p_id;
$$;

grant execute on function public.share_anchorage, public.remove_anchorage, public.report_anchorage to anon;
```

## Looking after it

- **Reported tracks and anchorages:** Table Editor → `tracks` (or `anchorages`), filter `hidden = true`. Delete the row, or set
  `hidden` to false and `reports` to 0 to put it back.
- **Spam:** Supabase has request limits per project; if someone floods it, turn on
  Authentication → Rate limits or pause the `share_track` grant.
- Library tracks are other people's recordings. The app labels them as unchecked and
  never follows one without the skipper choosing it.

-- RunZ Challenge · schéma Supabase (Postgres)
-- À exécuter une fois dans Supabase > SQL Editor.
-- L'app accède à la base uniquement côté serveur avec la clé service_role :
-- RLS est activé sans policy, donc aucun accès direct depuis un navigateur.

create table if not exists settings (
  id                 int primary key default 1 check (id = 1),
  challenge_name     text    not null default 'RunZ Challenge',
  start_date         date    not null default '2026-11-02',
  end_date           date    not null default '2026-12-06',
  daily_cap_km       numeric not null default 15,
  sprint_multiplier  numeric not null default 2,      -- dernier jour : km x2 (1 = désactivé)
  sport_types        text[]  not null default array['Walk','Run','TrailRun','Hike','VirtualRun','Wheelchair']
);
insert into settings (id) values (1) on conflict do nothing;

create table if not exists teams (
  id      serial primary key,
  name    text not null,
  color   text not null,          -- hex
  emoji   text not null default '',
  active  boolean not null default true
);
insert into teams (name, color, emoji, active)
select * from (values
  ('Rouges', '#E5484D', '🔴', true),
  ('Bleus',  '#3E63DD', '🔵', true),
  ('Verts',  '#30A46C', '🟢', true),
  ('Jaunes', '#FBBF24', '🟡', false)
) as v(name, color, emoji, active)
where not exists (select 1 from teams);

create table if not exists participants (
  id                 uuid primary key default gen_random_uuid(),
  display_name       text not null,
  team_id            int references teams(id) on delete set null,
  invite_token       text unique not null default replace(gen_random_uuid()::text, '-', ''),
  strava_athlete_id  bigint unique,
  access_token       text,
  refresh_token      text,
  token_expires_at   bigint,          -- epoch seconds
  scope              text,
  last_sync_at       timestamptz,
  created_at         timestamptz not null default now()
);

create table if not exists activities (
  id                  uuid primary key default gen_random_uuid(),
  participant_id      uuid not null references participants(id) on delete cascade,
  source              text not null check (source in ('strava','manual')),
  strava_activity_id  bigint unique,
  name                text,
  sport_type          text not null,
  start_date_local    timestamp not null,   -- heure locale de l'activité (sans fuseau)
  distance_m          numeric not null,
  moving_time_s       int,
  elevation_gain_m    numeric,
  note                text,
  created_at          timestamptz not null default now()
);
create index if not exists activities_participant_idx on activities(participant_id);

-- Fenêtres de multiplicateur (Flash HourZ, Lève-tôt, ...) en heure locale
create table if not exists boosts (
  id          serial primary key,
  name        text not null,
  starts_at   timestamp not null,
  ends_at     timestamp not null,
  multiplier  numeric not null default 2,
  created_at  timestamptz not null default now()
);

-- Bonus en km attribués par l'admin (photo couleur, sortie commune, ParrainZ...)
create table if not exists bonuses (
  id              serial primary key,
  team_id         int not null references teams(id) on delete cascade,
  participant_id  uuid references participants(id) on delete set null,
  km              numeric not null,
  reason          text not null,
  awarded_on      date not null default current_date,
  created_at      timestamptz not null default now()
);

alter table settings     enable row level security;
alter table teams        enable row level security;
alter table participants enable row level security;
alter table activities   enable row level security;
alter table boosts       enable row level security;
alter table bonuses      enable row level security;

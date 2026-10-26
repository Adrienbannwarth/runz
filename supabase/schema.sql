-- RunZ Challenge · schéma Supabase (Postgres)
-- À exécuter une fois dans Supabase > SQL Editor.
-- L'app accède à la base uniquement côté serveur avec la clé service_role :
-- RLS est activé sans policy, donc aucun accès direct depuis un navigateur.

create table if not exists settings (
  id                 int primary key default 1 check (id = 1),
  challenge_name     text    not null default 'RunZ Challenge',
  start_date         date    not null default '2026-10-27',
  end_date           date    not null default '2026-11-27',
  daily_cap_km       numeric not null default 10,
  cap_mode           text    not null default 'alert' check (cap_mode in ('alert','cap')),      -- alert = comme l'Excel
  ranking_mode       text    not null default 'total' check (ranking_mode in ('total','average')),
  sprint_multiplier  numeric not null default 1,      -- obsolète : le Sprint final est un boost
  sport_types        text[]  not null default array['Walk','Run','TrailRun','Hike','VirtualRun']
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
  ('Team Rouge',  '#9A1325', '🔴', true),
  ('Team Bleu',   '#3847C4', '🔵', true),
  ('Team Vert',   '#78AF5F', '🟢', true),
  ('Team Orange', '#FA8F18', '🟠', true)
) as v(name, color, emoji, active)
where not exists (select 1 from teams);

create table if not exists participants (
  id                 uuid primary key default gen_random_uuid(),
  display_name       text not null,
  team_id            int references teams(id) on delete set null,
  invite_token       text unique not null default replace(gen_random_uuid()::text, '-', ''),
  strava_athlete_id  bigint unique,
  strava_athlete_last bigint,         -- dernier compte Strava lié (retrouvé à la reconnexion)
  access_token       text,
  refresh_token      text,
  token_expires_at   bigint,          -- epoch seconds
  scope              text,
  strava_app         text not null default 'a',  -- app Strava qui a émis les tokens (a, b...)
  last_sync_at       timestamptz,
  is_admin           boolean not null default false,  -- accès à l'administration via Mon espace
  is_captain         boolean not null default false,
  pole               text,
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
  strava_manual       boolean not null default false,  -- activité saisie à la main dans Strava
  trainer             boolean not null default false,  -- tapis / home trainer
  has_track           boolean,                         -- un tracé GPS existe (le tracé n'est pas stocké)
  validated_boosts    int[] not null default '{}',     -- boosts « à valider » accordés par un admin
  created_at          timestamptz not null default now()
);
create index if not exists activities_participant_idx on activities(participant_id);

-- Boosts multiplicateurs (onglet Boost de l'Excel) : période du starts_at au ends_at (jours inclus) + créneau
create table if not exists boosts (
  id          serial primary key,
  name        text not null,
  starts_at   timestamp not null,
  ends_at     timestamp not null,
  multiplier  numeric not null default 2,
  slot        text not null default 'Tous' check (slot in ('Tous','Avant 8h','12h-14h','19h-22h')),
  manual      boolean not null default false,  -- true = ne s'applique qu'aux activités validées par un admin
  from_time   time,                            -- horaire perso quotidien (prioritaire sur slot), ex. 18:30
  to_time     time,                            -- ex. 22:00 (exclu)
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

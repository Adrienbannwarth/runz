-- Saisons : RunZ (1) terminée, BingoZ (2) en préparation. Les activités Strava restent communes à toutes les saisons.
create table if not exists seasons (
  id int primary key,                 -- numéro de saison
  name text not null,                 -- RunZ, BingoZ…
  kind text not null,                 -- type de jeu : runz | bingoz
  starts_on date,
  ends_on date,
  status text not null default 'draft' -- draft (en préparation) | live | done
);
alter table seasons enable row level security; -- accès uniquement via la clé service (serveur)

insert into seasons (id, name, kind, starts_on, ends_on, status) values
  (1, 'RunZ', 'runz', '2026-10-27', '2026-11-27', 'done'),
  (2, 'BingoZ', 'bingoz', null, null, 'draft')
on conflict (id) do nothing;

-- Saison affichée sur la page d'accueil
alter table settings add column if not exists current_season int not null default 1;

-- Équipes propres à chaque saison (les équipes existantes sont celles de RunZ)
alter table teams add column if not exists season int not null default 1;

-- Composition des équipes à partir de la saison 2 (RunZ garde participants.team_id)
create table if not exists season_members (
  season int not null references seasons(id) on delete cascade,
  participant_id uuid not null references participants(id) on delete cascade,
  team_id int not null references teams(id) on delete cascade,
  primary key (season, participant_id)
);
alter table season_members enable row level security;

-- Aperçu des saisons en préparation (/bingoz) : réservé aux comptes cochés ici
alter table participants add column if not exists can_preview boolean not null default false;
update participants set can_preview = true where display_name = 'Adrien Bannwarth';

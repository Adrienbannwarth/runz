-- Boost « Photo couleur » (#COULEURZ) : bonus automatique + vote façon appli de rencontre
alter table boosts add column if not exists bonus_km numeric;       -- km pour l'équipe par personne avec une photo
alter table boosts add column if not exists team_bonus_km numeric;  -- km en plus si tous les membres de l'équipe ont une photo
alter table activities add column if not exists photo_url text;     -- photo principale Strava (activités #COULEURZ seulement)
alter table activities add column if not exists photo_caption text; -- description Strava (activités #COULEURZ seulement)

create table if not exists photo_votes (
  voter_id uuid not null references participants(id) on delete cascade,
  activity_id uuid not null references activities(id) on delete cascade,
  liked boolean not null,
  created_at timestamptz not null default now(),
  primary key (voter_id, activity_id)
);
alter table photo_votes enable row level security; -- accès uniquement via la clé service (serveur)

-- Réglage du boost (dates et vote modifiables ensuite dans l'admin › Boosts ou ici)
update boosts set tag = '#COULEURZ', bonus_km = 25, team_bonus_km = 50,
  bonus_note = '+25 km par personne avec sa photo #COULEURZ · +50 km si toute l''équipe joue',
  vote_from = '2026-11-16', vote_to = '2026-11-20'
where name = 'Photo couleur';

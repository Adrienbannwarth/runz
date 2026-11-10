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

-- Boost photo : week-end du 21-22/11, vote du 23/11 (14h) au 27/11 (déjà appliqué en prod le 10/11)
insert into boosts (name, starts_at, ends_at, multiplier, slot, tag, bonus_km, team_bonus_km, bonus_note, vote_from, vote_to)
select 'Photo couleur', '2026-11-21T00:00:00', '2026-11-22T23:59:59', 1, 'Tous', '#COULEURZ', 25, 50,
  '+25 km par personne avec sa photo #COULEURZ · +50 km si toute l''équipe joue', '2026-11-23', '2026-11-27'
where not exists (select 1 from boosts where name = 'Photo couleur');

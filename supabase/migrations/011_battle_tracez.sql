-- Jeu des formes #TRACEZ : boost à tag (une forme validée par personne), tracé conservé seulement pour
-- les activités taguées, et vote en duels (« Battle TraceZ »).
alter table boosts add column if not exists tag text;
alter table boosts add column if not exists vote_from date;
alter table boosts add column if not exists vote_to date;
alter table activities add column if not exists polyline text;
create table if not exists votes (
  id          serial primary key,
  voter_id    uuid not null references participants(id) on delete cascade,
  a           uuid not null references activities(id) on delete cascade,
  b           uuid not null references activities(id) on delete cascade,
  winner      uuid not null references activities(id) on delete cascade,
  created_at  timestamptz not null default now()
);
create unique index if not exists votes_pair_unique on votes (voter_id, least(a, b), greatest(a, b));
alter table votes enable row level security;
update boosts set tag = '#TRACEZ', vote_from = '2026-11-09', vote_to = '2026-11-13', manual = true where name = 'Tracé GPS';

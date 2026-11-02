-- Battle TraceZ, mode test admins : tracés récupérés pour les admins (jamais dans le vrai vote) et votes marqués « test ».
alter table activities add column if not exists test_polyline text;
alter table votes add column if not exists test boolean not null default false;

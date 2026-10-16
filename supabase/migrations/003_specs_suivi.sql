-- Alignement sur RunZ-Suivi.xlsx (16/10/2026) : dates, plafond, mode de classement, créneaux de boost, capitaine/pôle.
alter table settings add column if not exists cap_mode text not null default 'alert' check (cap_mode in ('alert','cap'));
alter table settings add column if not exists ranking_mode text not null default 'total' check (ranking_mode in ('total','average'));
alter table participants add column if not exists is_captain boolean not null default false;
alter table participants add column if not exists pole text;
alter table boosts add column if not exists slot text not null default 'Tous' check (slot in ('Tous','Avant 8h','12h-14h','19h-22h'));

update settings set start_date = '2026-10-27', end_date = '2026-11-27', daily_cap_km = 10, cap_mode = 'alert',
  ranking_mode = 'total', sprint_multiplier = 1, sport_types = array['Walk','Run','TrailRun','Hike','VirtualRun'] where id = 1;

insert into boosts (name, starts_at, ends_at, multiplier, slot)
select * from (values
  ('Flash HourZ ×2',       timestamp '2026-11-02 00:00', timestamp '2026-11-06 23:59:59', 2, '19h-22h'),
  ('On vient à pied Days', timestamp '2026-11-09 00:00', timestamp '2026-11-11 23:59:59', 3, 'Tous'),
  ('Tracé GPS',            timestamp '2026-11-16 00:00', timestamp '2026-11-20 23:59:59', 5, 'Tous'),
  ('Sprint final',         timestamp '2026-11-27 00:00', timestamp '2026-11-27 23:59:59', 2, 'Tous')
) as v(name, starts_at, ends_at, multiplier, slot)
where not exists (select 1 from boosts b where b.name = v.name);

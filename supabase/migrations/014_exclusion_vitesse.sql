-- Exclusion manuelle d'une activité (triche, erreur) et validation des vitesses suspectes.
-- Ces colonnes ne sont jamais écrites par la synchro Strava : elles survivent aux mises à jour.
alter table activities add column if not exists excluded boolean not null default false;
alter table activities add column if not exists speed_ok boolean not null default false;

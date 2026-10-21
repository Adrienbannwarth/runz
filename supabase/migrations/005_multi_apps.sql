-- Répartition des athlètes sur plusieurs apps Strava (capacité de 10 par app).
alter table participants add column if not exists strava_app text not null default 'a';

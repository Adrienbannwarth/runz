-- Boost avec horaire quotidien perso (ex. 18h30-22h), en plus des créneaux fixes.
alter table boosts add column if not exists from_time time;
alter table boosts add column if not exists to_time time;

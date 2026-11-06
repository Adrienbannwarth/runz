-- Rewind : photo de profil Strava du participant (null = pas encore récupérée, '' = pas de photo)
alter table participants add column if not exists avatar_url text;

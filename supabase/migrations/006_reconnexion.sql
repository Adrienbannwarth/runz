-- Reconnexion après « Retirer l'accès Strava » : on garde l'identifiant Strava pour retrouver le même profil
-- (équipe, admin, capitaine) au lieu de créer un nouveau participant. Déjà appliqué en prod le 21/10.
alter table participants add column if not exists strava_athlete_last bigint;

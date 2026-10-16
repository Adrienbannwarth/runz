-- Contrôle anti-triche : activités Strava saisies à la main ou sans tracé GPS.
-- Elles comptent, mais sont signalées aux admins. Le tracé n'est jamais stocké, seulement sa présence.
alter table activities add column if not exists strava_manual boolean not null default false;
alter table activities add column if not exists trainer boolean not null default false;
alter table activities add column if not exists has_track boolean;
-- Après migration : Admin › Participants › « Resynchroniser tous les comptes Strava » pour remplir ces champs.

-- Rôle admin porté par le participant (Christelle et Adrien)
alter table participants add column if not exists is_admin boolean not null default false;
-- Exemple : update participants set is_admin = true where display_name in ('Adrien B.', 'Chris J.');

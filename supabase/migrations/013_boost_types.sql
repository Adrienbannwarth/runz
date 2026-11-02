-- Boost réservé à certains types d'activité : On vient à pied Days (jeu. 5/11) ×3 sur la marche et la rando seulement.
alter table boosts add column if not exists sport_types text[];
update boosts set sport_types = array['Walk','Hike'] where name = 'On vient à pied Days';

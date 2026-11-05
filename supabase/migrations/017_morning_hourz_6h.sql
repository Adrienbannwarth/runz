-- Morning HourZ (10-13 nov., ×2) : créneau 6h → 9h30 au lieu de 1h → 9h30. Déjà appliqué en prod via l'éditeur SQL Supabase.
update boosts set from_time = '06:00' where name = 'Morning HourZ';

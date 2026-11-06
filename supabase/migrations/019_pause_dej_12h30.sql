-- Pause Dej (17-19 nov., ×1,5) : créneau 12h30-14h au lieu de 12h-14h. Déjà appliqué en prod via l'éditeur SQL Supabase.
update boosts set from_time = '12:30', to_time = '14:00' where name = 'Pause Dej';

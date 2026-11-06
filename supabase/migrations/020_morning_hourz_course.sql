-- Morning HourZ (10-13 nov., 6h-9h30, ×2) : réservé à la course et au trail. Déjà appliqué en prod via l'éditeur SQL Supabase.
update boosts set sport_types = array['Run','TrailRun'] where name = 'Morning HourZ';

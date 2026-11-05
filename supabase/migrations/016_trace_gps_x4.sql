-- Tracé GPS (week-end des 7-8 nov.) : ×4 au lieu de ×5. Déjà appliqué en prod via l'éditeur SQL Supabase.
update boosts set multiplier = 4 where tag = '#TRACEZ';

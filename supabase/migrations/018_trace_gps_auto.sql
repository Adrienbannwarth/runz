-- Tracé GPS : ×4 automatique sur la forme « #TRACEZ (nom) » (une par personne, contrôles anti-fraude). Déjà appliqué en prod.
update boosts set manual = false where tag = '#TRACEZ';

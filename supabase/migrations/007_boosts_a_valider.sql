-- Boosts « à valider » : le multiplicateur ne s'applique qu'aux activités validées par un admin
-- (onglet Validations). Tracé GPS ×5 et On vient à pied Days ×3 passent en validation.
alter table boosts add column if not exists manual boolean not null default false;
alter table activities add column if not exists validated_boosts int[] not null default '{}';
update boosts set manual = true where name ilike 'Tracé GPS%' or name ilike 'On vient à pied%';

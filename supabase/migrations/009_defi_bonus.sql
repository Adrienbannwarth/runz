-- Défis bonus affichés avec les boosts mais sans multiplicateur (ex. Photo couleur : +10 km par photo validée,
-- saisis à la main dans l'onglet Bonus).
alter table boosts add column if not exists bonus_note text;
insert into boosts (name, starts_at, ends_at, multiplier, slot, bonus_note)
select 'Photo couleur', '2026-11-13T00:00:00', '2026-11-15T23:59:59', 1, 'Tous', '+10 km par photo validée'
where not exists (select 1 from boosts where name = 'Photo couleur');

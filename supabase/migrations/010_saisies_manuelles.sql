-- Saisies manuelles Strava (sans tracé) : à partir de settings.manual_strava_from, elles ne comptent que si
-- un admin les valide (activities.manual_ok, onglet Validations). Règle appliquée dès le lundi 2/11 (le week-end du 31/10-1/11 compte encore).
alter table settings add column if not exists manual_strava_from date;
alter table activities add column if not exists manual_ok boolean not null default false;
update settings set manual_strava_from = '2026-11-02' where id = 1;

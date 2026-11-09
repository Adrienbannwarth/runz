-- Battle TraceZ : un admin peut retirer une forme du vote (l'activité et son ×4 comptent toujours)
alter table activities add column if not exists vote_excluded boolean not null default false;

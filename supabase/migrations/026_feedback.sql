-- Avis de fin de saison (formulaire /avis) : une réponse par participant connecté (modifiable), anonymes acceptées.
create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid unique references participants(id) on delete set null,
  season int not null default 1,
  rating int check (rating between 1 and 5),  -- note globale
  liked text[] not null default '{}',         -- ce qui a plu (choix)
  disliked text[] not null default '{}',      -- ce qui a moins plu (choix)
  rhythm text,                                -- rythme préféré pour la suite
  next_season text,                           -- partant pour une saison plus diversifiée : oui / peut-être / non
  sports text[] not null default '{}',        -- sports à ajouter
  challenge text,                             -- le défi qu'il aimerait relever
  comment text,                               -- un dernier mot
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table feedback enable row level security; -- accès uniquement via la clé service (serveur)

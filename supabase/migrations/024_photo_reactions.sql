-- Photo couleur : réactions (🫶 🎨 😂 🤯) à la place du oui / non ; null = « Passer »
alter table photo_votes add column if not exists reaction text;

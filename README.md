# RunZ · plateforme des challenges sportifs du CSE Colorz

Chaque participant connecte son compte Strava : ses sorties remontent toutes seules et les classements se calculent automatiquement. Le site accueille une **saison** par challenge : RunZ (saison 1), puis BingoZ (saison 2), etc.

- **En ligne** : https://runz-colorz.vercel.app
- **Stack** : Next.js 16, Supabase (Postgres), Vercel, API Strava. Animations : Framer Motion.

## Les pages

| URL | Qui la voit | Ce qu'on y trouve |
|---|---|---|
| `/` | Tout le monde | La saison en cours. Aujourd'hui : l'écran de fin RunZ (chiffres, compte à rebours), puis classement final + Rewind à partir du lundi 30/11 à 18h |
| `/?suite=1` | Admins | L'ancien accueil RunZ (équipes, boosts, votes), derrière l'écran de fin |
| `/rewind` | Admins, puis tout le monde le 30/11 à 18h | Le récap de sa saison en stories, avec export de ses tracés |
| `/saisons` | Tout le monde | L'historique : une carte par saison (les saisons en préparation n'apparaissent que pour toi) |
| `/saisons/1` | Tout le monde | Le récap RunZ, une fois que la saison 2 a remplacé RunZ sur l'accueil |
| `/bingoz` | **Adrien seul** (404 pour les autres) | L'aperçu du BingoZ en préparation (`/bingos` y renvoie aussi) |
| `/avis` | Tout le monde | Le formulaire « Donnez votre avis » de fin de saison (réponses dans Admin › Avis) |
| `/me` | Participant connecté | Ses activités, ses km comptés, resynchro, déconnexion |
| `/join/<jeton>` | Participant invité | Son lien personnel pour relier Strava à sa fiche et son équipe |
| `/admin` | Organisateurs | Participants, activités, saisie manuelle, bonus, boosts, validations, MVP, récap zlack, réglages |
| `/confidentialite` | Tout le monde | Données utilisées, qui voit quoi, suppression |

## Saison 1 · RunZ (27/10 → 27/11/2026, terminée)

- **Sports comptés** : marche, course, trail, rando, tapis. Plafond de 10 km réels par jour et par personne.
- **Boosts** : Flash HourZ ×2, On vient à pied ×3, Tracé GPS ×4 (#TRACEZ), Morning HourZ ×2, Pause Dej ×1,5, Photo couleur (#COULEURZ, +25 km par personne, +50 si toute l'équipe), Sprint final ×2.
- **Votes** : Battle TraceZ (duels de formes) et réactions Photo couleur ; les MVP sont choisis par l'organisation.
- **Anti-triche** : saisies manuelles Strava, vitesses suspectes et courses à allure de marche passent en validation admin.
- **Fin de saison** : écran de clôture pour les membres, résultats et Rewind ouverts le lundi 30/11 à 18h (`RESULTS_AT` dans `lib/rewind.ts`).

## Saison 2 · BingoZ (en préparation)

Grille 7 × 7 par équipe : 48 défis sportifs + un défi imposé au centre. Les cases se cochent toutes seules à partir des sorties Strava, les défis photo (#BINGOZ), tracés et Hyrox sont validés par un admin. Cadrage complet : doc « BingoZ-saison2-cadrage-tech » du projet. Les défis sont dans `lib/bingo-defis.ts` (« ? » = défi pas encore choisi).

**Lancer une nouvelle saison** : passer `settings.current_season` à 2 ; l'accueil affiche alors le BingoZ et RunZ part dans `/saisons/1`.

## Comment ça marche

- **Strava** : import complet à la connexion, webhook pour les créations, modifications et suppressions, cron quotidien en filet de sécurité. On garde le type, la date, la distance, la durée, le dénivelé et le nom ; les tracés seulement pour #TRACEZ, les photos seulement pour #COULEURZ.
- **Calcul** : `lib/scoring.ts` (points, boosts, plafond), `lib/photo-core.ts`, `lib/battle-core.ts`, `lib/rewind.ts`. Tout est testé dans `tests/`.
- **Saisons** : `lib/seasons.ts`, tables `seasons` et `season_members`.

## Travailler sur le projet

On travaille directement en prod (pas de base locale) :

1. Modifier le code, puis `npm test` (calculs) et `npx tsc --noEmit` (types).
2. `git push` sur `main` : Vercel déploie tout seul.
3. Un changement de base = un fichier dans `supabase/migrations/` (numéroté), à exécuter dans le SQL Editor de Supabase. Dernière migration appliquée : `026_feedback.sql`.

| Service | Où |
|---|---|
| Code | github.com/Adrienbannwarth/runz, branche `main` |
| Hébergement | Vercel, projet `runz-colorz` |
| Base | Supabase, projet `dpzanzllzbcjzrbcckpq` |
| Strava | app « Colorz » (+ 2e app de Christelle pour la capacité) |

Les variables d'environnement sont listées dans `.env.example` ; les valeurs sont dans Vercel et dans `.env.vercel.local` (jamais commité). Webhook Strava : `./scripts/strava-webhook.sh`.

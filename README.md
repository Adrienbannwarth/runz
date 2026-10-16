# RunZ · plateforme du challenge

Plateforme web du RunZ Challenge (CSE Colorz) : chaque participant connecte son compte Strava, ses marches et courses remontent automatiquement, et le classement par équipe se calcule tout seul.

**Stack** : Next.js 16 (App Router, server actions), Supabase (Postgres), déploiement Vercel.

## Ce que fait la V1

| Page | Pour qui | Contenu |
|---|---|---|
| `/` | Tout le monde | Classement des équipes (moyenne km/pers., bonus inclus), boost en cours, boosts à venir, bouton « Se connecter avec Strava » |
| `/join/<jeton>` | Participant invité | Lien personnel qui rattache le compte Strava à la bonne fiche et à la bonne équipe |
| `/me` | Participant connecté | Ses activités avec les km comptés (plafond, boost), resynchro, déconnexion, effacement de ses données |
| `/admin` | Organisateurs (mot de passe) | Participants et équipes, saisie manuelle (captures d'écran), bonus, boosts horaires, stats MVP, récap du soir à coller dans `~runz`, réglages |
| `/confidentialite` | Tout le monde | Données utilisées, qui voit quoi, suppression |

**Synchronisation Strava**
- Import complet à la connexion (activités de la période du challenge).
- Webhook Strava : création, modification et suppression d'activité, révocation de l'accès (les données sont alors effacées).
- Filet de sécurité : cron quotidien (`vercel.json`, 23 h / minuit heure de Paris) et boutons de resynchro.
- Stocké : type, date/heure locale, distance, durée, dénivelé, nom. **Jamais** de tracé GPS.

**Règles de calcul** (`lib/scoring.ts`, testées dans `tests/scoring.test.ts`), alignées sur `RunZ-Suivi.xlsx` (SharePoint BOF › Général) :
1. Activités comptées (réglables) : marche, course, trail, randonnée, tapis. Vélo exclu.
2. Période : du 27/10 au 27/11/2026, dates incluses.
3. Créneau déduit de l'heure de départ : Avant 8h, 12h-14h, 19h-22h ou Autre.
4. Boosts multiplicateurs, par période et par créneau, comme l'onglet Boost : Flash HourZ ×2 (02 au 06/11, 19h-22h), On vient à pied Days ×3 (09 au 11/11), Tracé GPS ×5 (16 au 20/11), Sprint final ×2 (27/11). S'il y a plusieurs boosts, le plus fort s'applique.
5. Plafond de 10 km/jour/personne en mode **alerte**, comme l'Excel : les km comptent, la journée est signalée dans l'admin et dans Mon espace. Un mode « coupe automatique » existe dans les réglages.
6. Équipe : total = km réels + km gagnés via multiplicateurs + km bonus. Classement au **total** (réglable : moyenne par personne).
7. Prix MVP : Machine à KilomètreZ (km réels), Métronome (jours actifs), Lève-tôt d'or (km avant 8 h), Pause Déj' (km 12h-14h), Mollets d'acier (D+). Les prix votés se règlent sur zlack : Paparazzi RunZ, Capitaine Courage, Picasso du GPS.

## Déploiement en place (16/10/2026)

| Élément | Valeur |
|---|---|
| Repo | github.com/Adrienbannwarth/runz (branche `main`, déploiement auto à chaque push) |
| Vercel | projet `runz-colorz` → https://runz-colorz.vercel.app |
| Supabase | org « Runz », projet `dpzanzllzbcjzrbcckpq` (eu-west-1), schéma appliqué |
| Strava | app « Colorz », Client ID 256066, callback domain `runz-colorz.vercel.app` (localhost reste autorisé par Strava pour le dev) |
| Capacité Strava | 10 athlètes (1 connecté) → review à demander, voir REVIEW-STRAVA.md |

Les variables d'environnement sont préparées dans `.env.vercel.local`, ignoré par git. Les secrets de session, de cron et du webhook, ainsi que le mot de passe admin, y sont déjà générés.

**Étapes restantes**
1. Compléter `SUPABASE_SERVICE_ROLE_KEY` et `STRAVA_CLIENT_SECRET` dans `.env.vercel.local`.
2. Vercel → runz-colorz → Settings → Environment Variables : coller le contenu du fichier (Production + Preview).
3. Deployments → dernier déploiement → « Redeploy ».
4. Créer le webhook : `./scripts/strava-webhook.sh`, puis `./scripts/strava-webhook.sh status` pour vérifier.
5. Ouvrir https://runz-colorz.vercel.app/admin avec `ADMIN_PASSWORD` et ajouter les participants.

## Mise en route (≈ 30 min)

### 1. Supabase
1. Créer un projet sur supabase.com (région Europe).
2. SQL Editor → coller et exécuter `supabase/schema.sql`. Le script crée les tables, les 4 équipes et les réglages : du 27/10 au 27/11/2026, plafond 10 km. Sur une base existante, exécuter plutôt les scripts de `supabase/migrations/` dans l'ordre.
3. Project Settings → API : noter l'URL et la clé `service_role`.

### 2. Vercel
1. Pousser ce dossier sur un repo GitHub, puis l'importer dans Vercel.
2. Renseigner les variables d'environnement listées dans `.env.example`. Pour `SESSION_SECRET`, `CRON_SECRET` et `ADMIN_PASSWORD`, générer des valeurs avec `openssl rand -hex 32`. `APP_URL` est l'URL finale, par exemple `https://runz-colorz.vercel.app`.
3. Déployer.

### 3. Application Strava (strava.com/settings/api)
- **Authorization Callback Domain** : le domaine seul, sans https, par exemple `runz-colorz.vercel.app`. En local : `localhost`.
- Website : l'URL de l'app.
- Récupérer le Client ID et le Client Secret, les mettre dans Vercel, puis redéployer.

### 4. Webhook Strava (une seule fois, après le déploiement)
Le plus simple : `./scripts/strava-webhook.sh`. Il lit les valeurs dans `.env.vercel.local`. Équivalent manuel :
```bash
curl -X POST https://www.strava.com/api/v3/push_subscriptions \
  -F client_id=$STRAVA_CLIENT_ID -F client_secret=$STRAVA_CLIENT_SECRET \
  -F callback_url=https://runz-colorz.vercel.app/api/strava/webhook \
  -F verify_token=runz-webhook
# → {"id": 123456}  : mettre cette valeur dans STRAVA_SUBSCRIPTION_ID (facultatif)
```
Pour vérifier : `curl -G https://www.strava.com/api/v3/push_subscriptions -d client_id=... -d client_secret=...`

### 5. Préparer le challenge
1. `/admin` → Participants : coller la liste des noms par équipe (un par ligne).
2. Envoyer à chacun son lien `/join/…` par DM zlack.
3. Les participants sans Strava, ou au-delà de la limite d'athlètes Strava, envoient leurs captures d'écran. Les km sont saisis dans l'onglet Saisie manuelle.

## En local
```bash
npm install
cp .env.example .env.local   # remplir
npm run dev                  # http://localhost:3000
npm test                     # tests du calcul des points
```

## À faire avant de soumettre à Strava
- Remplacer le bouton orange par le bouton officiel « Connect with Strava ». Remplacer aussi le texte « POWERED BY STRAVA » (`app/layout.tsx`) par le logo officiel. Les deux se trouvent sur developers.strava.com/guidelines.
- Voir `REVIEW-STRAVA.md`.

## Pistes V2
- Génération automatique de l'image du récap (reprendre `runz-recap-generateur.html`) et post direct dans `~runz`.
- Boosts calculables automatiquement : « Tous au compteur » (chaque membre ≥ 1 km dans la semaine), Régularité.
- Validation par l'admin des activités Strava saisies à la main sur Strava (sans GPS).

# Demande d'augmentation de la limite d'athlètes Strava

## Ce qu'il faut savoir avant de soumettre
- Une nouvelle app Strava démarre à 1 athlète. Elle passe à **10 sans review**. Au-delà, il faut une review via le formulaire de Strava.
- **Délai non garanti.** Selon les retours sur le forum développeurs, la réponse arrive entre quelques jours et plusieurs mois. Il est impossible de suivre l'avancement.
- Avec 18 inscrits et un coup d'envoi le 27/10, il ne faut **pas dépendre de la review**. Les 10 premiers connectent Strava. Les autres passent par la saisie manuelle (captures d'écran) jusqu'à l'approbation. La plateforme gère les deux cas.
- **Point sensible.** Les conditions de l'API Strava, dans leur version de fin 2024, limitent l'affichage des données d'un athlète à d'autres utilisateurs. La plateforme a été conçue pour rester du bon côté de cette règle :
  - le classement public n'affiche que des agrégats par équipe ;
  - chacun ne voit en détail que ses propres activités ;
  - les chiffres individuels (MVP) sont réservés aux organisateurs.

  Ce choix est à expliquer clairement dans la demande.

## Checklist (critères de review publiés par Strava)
- [ ] **Branding** : bouton officiel « Connect with Strava », logo « Powered by Strava », liens « Voir sur Strava » sur chaque activité (déjà en place).
- [ ] **Confidentialité** : page `/confidentialite` en ligne. Effacement en un clic dans Mon espace. Données effacées automatiquement quand l'athlète révoque l'accès depuis Strava (webhook).
- [ ] **Accord API à jour** : accepté dans les réglages de l'app.
- [ ] **Rate limits** : environ 20 athlètes. Webhook plus un cron par jour, donc très loin des 200 requêtes / 15 min.
- [ ] **Support** : une adresse de contact (CSE ou toi) dans la page confidentialité.
- [ ] App déployée et accessible à une URL publique. Callback domain et webhook configurés.
- [ ] Captures d'écran prêtes : classement, Mon espace, écran d'autorisation.

## Où soumettre
strava.com/settings/api → lien vers le formulaire de review / developer program. Questions : developers@strava.com.

## Texte proposé pour le formulaire (EN)

> **App name:** RunZ Challenge
> **Description:** RunZ is a non-commercial, internal wellness challenge organised by the works council (CSE) of Colorz, a French digital agency. About 18–25 employees, split into colour teams, walk or run as much as they can over one month (27 Oct – 27 Nov 2026). Participation is voluntary.
>
> **How Strava data is used:** After OAuth (scope `activity:read_all`), we import only the activities within the challenge dates and store only sport type, local start time, distance, moving time, elevation gain and activity name. No GPS streams, polylines, locations or health data are requested or stored. Activities are kept in sync through the webhook API, and a daily sync covers missed events.
>
> **What is displayed:** The public page only shows aggregated team totals and per-person team averages. Each athlete sees the detail of their own activities only, with a "View on Strava" link. Organisers see per-person totals solely to validate bonuses and award prizes. Strava data is never shown individually to other participants. It is never sold or shared, and never used to train AI models.
>
> **Data deletion:** Athletes can disconnect and erase their data in one click, and we handle `authorized=false` webhook events to delete data when access is revoked from Strava. All data is deleted at most 30 days after the challenge ends.
>
> **Requested capacity:** 25 athletes (expected 15–20 participants plus a margin for late sign-ups).
> **Expected API usage:** under 300 requests per day.
> **Contact:** adrien.bannwarth@colorz.fr

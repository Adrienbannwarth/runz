#!/usr/bin/env bash
# Crée (ou affiche) l'abonnement webhook Strava de l'app RunZ.
# Usage : ./scripts/strava-webhook.sh [status] [2]
#   ./scripts/strava-webhook.sh            -> crée l'abonnement de l'app 1
#   ./scripts/strava-webhook.sh status     -> affiche l'abonnement de l'app 1
#   ./scripts/strava-webhook.sh "" 2       -> crée l'abonnement de l'app 2 (STRAVA_CLIENT_ID_2)
#   ./scripts/strava-webhook.sh status 2   -> affiche l'abonnement de l'app 2
# Lit STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET / STRAVA_WEBHOOK_VERIFY_TOKEN / APP_URL dans .env.vercel.local
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; source .env.vercel.local; set +a
if [ "${2:-}" = "2" ]; then STRAVA_CLIENT_ID="$STRAVA_CLIENT_ID_2"; STRAVA_CLIENT_SECRET="$STRAVA_CLIENT_SECRET_2"; fi
: "${STRAVA_CLIENT_SECRET:?STRAVA_CLIENT_SECRET vide dans .env.vercel.local}"
API=https://www.strava.com/api/v3/push_subscriptions
if [ "${1:-}" = "status" ]; then
  curl -sG "$API" -d client_id="$STRAVA_CLIENT_ID" -d client_secret="$STRAVA_CLIENT_SECRET"; echo
else
  curl -s -X POST "$API" \
    -F client_id="$STRAVA_CLIENT_ID" -F client_secret="$STRAVA_CLIENT_SECRET" \
    -F callback_url="$APP_URL/api/strava/webhook" -F verify_token="$STRAVA_WEBHOOK_VERIFY_TOKEN"; echo
  echo "→ Copier l'id renvoyé dans STRAVA_SUBSCRIPTION_ID (Vercel), facultatif."
fi

#!/bin/bash
# Saves the live Stripe key for StallOrg subscriptions in Supabase, without
# showing it on screen or keeping it anywhere else. Run from the project folder:
#   bash scripts/set-stripe-billing-key.sh
# Then paste the rk_live_ key when asked (nothing shows while you paste).

printf "Lim inn Stripe-nøkkelen (rk_live_...) og trykk Enter: "
read -rs KEY
echo

# Spaces and line breaks from copying aren't part of the key.
KEY="$(printf '%s' "$KEY" | tr -d '[:space:]')"

# Stripe's key list shows a shortened key (rk_live_51…ab12); only the full key works.
if [[ "$KEY" == *"…"* || "$KEY" == *"..."* || "$KEY" == *"•"* || ${#KEY} -lt 60 ]] && [ -n "$KEY" ]; then
  echo "Dette ser ut som den forkortede nøkkelen fra listen i Stripe (${#KEY} tegn). Den hele nøkkelen er rundt 100 tegn. Ingenting er lagret."
  unset KEY
  exit 1
fi

case "$KEY" in
  rk_live_*|sk_live_*)
    if supabase secrets set STRIPE_BILLING_SECRET_KEY="$KEY"; then
      echo "Lagret (${#KEY} tegn)."
    else
      echo "Supabase sa nei, se meldingen over. Ingenting er lagret."
    fi
    ;;
  "")
    echo "Ingenting ble limt inn, så ingenting er lagret."
    ;;
  *)
    echo "Det ser ikke ut som en live-nøkkel (den skal starte med rk_live_), så ingenting er lagret."
    ;;
esac

unset KEY

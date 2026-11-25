#!/bin/bash
# Saves the signing secret of the live Stripe webhook for StallOrg subscriptions
# (stripe-billing-webhook) in Supabase, without showing it. Run from the project
# folder:
#   bash scripts/set-stripe-billing-webhook-secret.sh
# Then paste the whsec_ secret when asked (nothing shows while you paste).

printf "Lim inn signing secret (whsec_...) og trykk Enter: "
read -rs SECRET
echo

case "$SECRET" in
  whsec_*)
    if supabase secrets set STRIPE_BILLING_WEBHOOK_SECRET="$SECRET"; then
      echo "Lagret."
    else
      echo "Supabase sa nei, se meldingen over. Ingenting er lagret."
    fi
    ;;
  "")
    echo "Ingenting ble limt inn, så ingenting er lagret."
    ;;
  *)
    echo "Det ser ikke ut som en signing secret (den skal starte med whsec_), så ingenting er lagret."
    ;;
esac

unset SECRET

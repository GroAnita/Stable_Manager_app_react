// Connectivity check for the Stripe integration, nothing more: confirms
// STRIPE_SECRET_KEY is set and valid by making one read-only Stripe call.
// No checkout/subscription/charge logic lives here yet — that's future
// work once GroAnita is ready to actually start collecting payment (see
// project_stripe_billing_todo memory). Safe to leave --no-verify-jwt since
// it returns no stable-specific or financial data, just a yes/no.

import Stripe from 'npm:stripe@18'

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')

Deno.serve(async () => {
  if (!STRIPE_SECRET_KEY) {
    return Response.json(
      { connected: false, error: 'STRIPE_SECRET_KEY is not set' },
      { status: 500 },
    )
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY)

  try {
    const balance = await stripe.balance.retrieve()
    return Response.json({
      connected: true,
      livemode: balance.livemode,
    })
  } catch (err) {
    return Response.json(
      { connected: false, error: (err as Error).message },
      { status: 502 },
    )
  }
})

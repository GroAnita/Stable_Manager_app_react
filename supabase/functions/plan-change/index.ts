// Tells boarders with automatic payment about a planned or cancelled switch to a plan
// without card payments. The plan itself is saved by the database first, so a failed
// email doesn't undo it.
//
// Auth model: the caller's JWT identifies them, and they must be the stable owner.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmail } from '../_shared/sendEmail.ts'
import { buildPlanChangeEmail } from './planChangeEmail.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonResponse({ error: 'Missing authorization header' }, 401)
    }
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const callerClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const {
      data: { user: caller },
      error: callerError,
    } = await callerClient.auth.getUser()
    if (callerError || !caller) {
      return jsonResponse({ error: 'Invalid session' }, 401)
    }

    const admin = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('role, stable_id')
      .eq('id', caller.id)
      .single()
    if (profileError) throw profileError
    if (profile.role !== 'stable_owner' || !profile.stable_id) {
      return jsonResponse({ error: 'Only the stable owner can do this' }, 403)
    }

    const { data: account, error: accountError } = await admin
      .from('stable_payment_accounts')
      .select(
        'scheduled_plan_on, plan_change_status, stable:stables(name, email)',
      )
      .eq('stable_id', profile.stable_id)
      .maybeSingle()
    if (accountError) throw accountError
    // deno-lint-ignore no-explicit-any
    const row = account as any
    const cancelled = row?.plan_change_status !== 'scheduled'

    const { data: agreements, error: agreementsError } = await admin
      .from('card_agreements')
      .select('contract:contracts(owner:owners(email), horse:horses(name))')
      .eq('stable_id', profile.stable_id)
      .is('withdrawn_at', null)
      .not('activated_at', 'is', null)
    if (agreementsError) throw agreementsError

    let failed = 0
    // deno-lint-ignore no-explicit-any
    for (const agreement of (agreements ?? []) as any[]) {
      const email = buildPlanChangeEmail({
        stableName: row?.stable?.name ?? 'Stallen',
        horseName: agreement.contract?.horse?.name ?? null,
        switchDate: row?.scheduled_plan_on ?? null,
        cancelled,
      })
      const sent = await sendEmail({
        to: agreement.contract?.owner?.email ?? null,
        stableName: row?.stable?.name ?? '',
        replyTo: row?.stable?.email ?? null,
        subject: email.subject,
        text: email.text,
      })
      if (!sent) failed += 1
    }
    return jsonResponse({ sent: (agreements ?? []).length - failed, failed })
  } catch (error) {
    console.error('plan-change failed:', error)
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Unexpected error' },
      500,
    )
  }
})

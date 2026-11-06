// Sends the confirmation of a notice to both the boarder and the stable. The notice
// itself is recorded by the give_contract_notice database function, so a failed
// email never undoes it, and the stable can send it again.
//
// Auth model: the caller's JWT identifies them, and they must be the contract's
// boarder or staff at its stable.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmail } from '../_shared/sendEmail.ts'
import { buildNoticeEmail } from './noticeEmail.ts'

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

    const { contractId } = await req.json()
    if (typeof contractId !== 'string') {
      return jsonResponse({ error: 'Missing contract' }, 400)
    }

    const admin = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const { data: contractRow, error: contractError } = await admin
      .from('contracts')
      .select(
        `id, stable_id, end_date, notice_given_at, notice_given_by_role,
         owner:owners(user_id, full_name, email),
         horse:horses(name),
         stable:stables(name, email, phone)`,
      )
      .eq('id', contractId)
      .maybeSingle()
    if (contractError) throw contractError
    // deno-lint-ignore no-explicit-any
    const contract = contractRow as any

    const { data: profile } = await admin
      .from('profiles')
      .select('role, stable_id')
      .eq('id', caller.id)
      .maybeSingle()
    const isStaff =
      ['stable_owner', 'stable_employee'].includes(profile?.role ?? '') &&
      profile?.stable_id === contract?.stable_id
    if (!contract || (contract.owner?.user_id !== caller.id && !isStaff)) {
      return jsonResponse({ error: 'Contract not found' }, 404)
    }
    if (!contract.notice_given_at || !contract.end_date) {
      return jsonResponse({ error: 'No notice on this contract' }, 409)
    }

    const { data: unpaid, error: unpaidError } = await admin
      .from('payments')
      .select('amount, credited_amount')
      .eq('contract_id', contractId)
      .neq('status', 'paid')
    if (unpaidError) throw unpaidError
    const open = (unpaid ?? [])
      .map(
        (payment) =>
          Math.round(
            (Number(payment.amount) - Number(payment.credited_amount)) * 100,
          ) / 100,
      )
      .filter((amount) => amount > 0)

    const { data: agreement } = await admin
      .from('card_agreements')
      .select('id')
      .eq('contract_id', contractId)
      .is('withdrawn_at', null)
      .not('activated_at', 'is', null)
      .maybeSingle()

    const email = buildNoticeEmail({
      stableName: contract.stable?.name ?? 'Stallen',
      ownerName: contract.owner?.full_name ?? null,
      horseName: contract.horse?.name ?? null,
      endDate: contract.end_date,
      givenBy: contract.notice_given_by_role ?? 'stable',
      givenOn: contract.notice_given_at,
      openInvoiceCount: open.length,
      openAmount: open.reduce((sum, amount) => sum + amount, 0),
      cardAgreementActive: agreement !== null,
      stableEmail: contract.stable?.email ?? null,
      stablePhone: contract.stable?.phone ?? null,
    })

    const toBoarder = await sendEmail({
      to: contract.owner?.email ?? null,
      stableName: contract.stable?.name ?? '',
      replyTo: contract.stable?.email ?? null,
      subject: email.subject,
      text: email.text,
    })
    const toStable = await sendEmail({
      to: contract.stable?.email ?? null,
      stableName: contract.stable?.name ?? '',
      replyTo: contract.owner?.email ?? null,
      subject: email.subject,
      text: email.text,
    })
    return jsonResponse({ sent: toBoarder && toStable })
  } catch (error) {
    console.error('contract-notice failed:', error)
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Unexpected error' },
      500,
    )
  }
})

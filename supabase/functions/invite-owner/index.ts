// Creates (or re-invites) a horse owner's login and links it to their owner
// record. Must run server-side: creating another person's account requires
// the service role key, which must never reach the client bundle.
//
// Auth model: the caller's own JWT (forwarded from the app) is verified
// against the anon-key client to identify who's asking. That id is then
// passed to the link_horse_owner_account() Postgres function, which
// independently re-checks that the caller is actually stable staff and that
// the target owner belongs to their stable — the Edge Function doesn't trust
// itself as the only line of defense.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { ownerId, email, fullName, redirectTo } = await req.json()
    if (!ownerId || !email) {
      return jsonResponse({ error: 'ownerId and email are required' }, 400)
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonResponse({ error: 'Missing authorization header' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user: caller },
      error: callerError,
    } = await callerClient.auth.getUser()
    if (callerError || !caller) return jsonResponse({ error: 'Invalid session' }, 401)

    const admin = createClient(supabaseUrl, serviceRoleKey)

    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName || '' },
      redirectTo: typeof redirectTo === 'string' ? redirectTo : undefined,
    })
    if (inviteError) return jsonResponse({ error: inviteError.message }, 400)

    const { error: linkError } = await admin.rpc('link_horse_owner_account', {
      p_inviter_id: caller.id,
      p_owner_id: ownerId,
      p_user_id: invited.user.id,
    })
    if (linkError) return jsonResponse({ error: linkError.message }, 400)

    return jsonResponse({ success: true, userId: invited.user.id })
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unexpected error' }, 500)
  }
})

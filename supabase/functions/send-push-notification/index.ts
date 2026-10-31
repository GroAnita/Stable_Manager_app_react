// Sends an APNs push for a notifications row to every registered device of
// its owner. Triggered by a DB trigger on insert into public.notifications
// (see migration 20261030000000_push_notifications.sql) — never called by
// the client directly. Auth is a shared secret header, not a user JWT, so
// this function is deployed with --no-verify-jwt.

const PUSH_SECRET = Deno.env.get('PUSH_TRIGGER_SECRET')
const APNS_KEY_ID = Deno.env.get('APNS_KEY_ID')
const APNS_TEAM_ID = Deno.env.get('APNS_TEAM_ID')
const APNS_PRIVATE_KEY = Deno.env.get('APNS_PRIVATE_KEY') // contents of the .p8 file
const APNS_BUNDLE_ID = 'no.nestundigital.stalldrift'
// A device token is only valid against the APNs environment it was
// registered under (sandbox for a local Xcode debug build, production for
// TestFlight/App Store), and we don't track which per token. Try
// production first — the common case once this ships — and fall back to
// sandbox only on the specific "wrong environment" error.
const APNS_HOST_PRODUCTION = 'https://api.push.apple.com'
const APNS_HOST_SANDBOX = 'https://api.sandbox.push.apple.com'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

type NotificationRow = {
  id: string
  owner_id: string | null
  title: string
  message: string | null
}

function base64url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function signApnsJwt(): Promise<string> {
  const pem = APNS_PRIVATE_KEY!.replace(/-----(BEGIN|END) PRIVATE KEY-----|\s/g, '')
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0))
  const key = await crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )
  const header = base64url(
    new TextEncoder().encode(JSON.stringify({ alg: 'ES256', kid: APNS_KEY_ID })),
  )
  const payload = base64url(
    new TextEncoder().encode(
      JSON.stringify({ iss: APNS_TEAM_ID, iat: Math.floor(Date.now() / 1000) }),
    ),
  )
  const signingInput = `${header}.${payload}`
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(signingInput),
  )
  return `${signingInput}.${base64url(new Uint8Array(signature))}`
}

async function fetchDeviceTokens(
  ownerId: string,
): Promise<{ id: string; token: string }[]> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/push_tokens?owner_id=eq.${ownerId}&select=id,token`,
    {
      headers: {
        apikey: SERVICE_ROLE_KEY,
        authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
    },
  )
  if (!res.ok) return []
  return res.json()
}

async function deleteStaleTokens(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  await fetch(`${SUPABASE_URL}/rest/v1/push_tokens?id=in.(${ids.join(',')})`, {
    method: 'DELETE',
    headers: {
      apikey: SERVICE_ROLE_KEY,
      authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
  })
}

async function postToApns(
  host: string,
  token: string,
  jwt: string,
  notification: NotificationRow,
): Promise<{ status: number; body: string }> {
  const res = await fetch(`${host}/3/device/${token}`, {
    method: 'POST',
    headers: {
      authorization: `bearer ${jwt}`,
      'apns-topic': APNS_BUNDLE_ID,
      'apns-push-type': 'alert',
      'apns-priority': '10',
    },
    body: JSON.stringify({
      aps: {
        alert: { title: notification.title, body: notification.message ?? '' },
        sound: 'default',
      },
      notification_id: notification.id,
    }),
  })
  return { status: res.status, body: await res.text() }
}

Deno.serve(async (req) => {
  if (!PUSH_SECRET || req.headers.get('X-Push-Secret') !== PUSH_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }
  if (!APNS_KEY_ID || !APNS_TEAM_ID || !APNS_PRIVATE_KEY) {
    // APNs credentials not configured yet — nothing to do.
    return new Response('ok')
  }

  const notification = (await req.json()) as NotificationRow
  if (!notification.owner_id) return new Response('ok')

  const tokens = await fetchDeviceTokens(notification.owner_id)
  if (tokens.length === 0) return new Response('ok')

  const jwt = await signApnsJwt()
  const staleTokenIds: string[] = []

  const results = await Promise.all(
    tokens.map(async (row) => {
      let result = await postToApns(APNS_HOST_PRODUCTION, row.token, jwt, notification)
      if (result.status === 400 && result.body.includes('BadDeviceToken')) {
        result = await postToApns(APNS_HOST_SANDBOX, row.token, jwt, notification)
      }
      if (result.status === 400 || result.status === 410) {
        staleTokenIds.push(row.id)
      }
      return result
    }),
  )

  await deleteStaleTokens(staleTokenIds)

  return new Response(JSON.stringify({ results }), {
    headers: { 'Content-Type': 'application/json' },
  })
})

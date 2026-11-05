// Sends one plain-text email through Resend, to INVOICE_EMAIL_TEST_TO unless
// INVOICE_EMAIL_ALLOW_REAL is 'true'. It reports the outcome rather than throwing,
// because a failed email must not undo the action it's about.
export async function sendEmail(input: {
  to: string | null
  stableName: string
  replyTo: string | null
  subject: string
  text: string
}): Promise<boolean> {
  const resendKey = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('INVOICE_EMAIL_FROM')
  const allowReal = Deno.env.get('INVOICE_EMAIL_ALLOW_REAL') === 'true'
  const to = allowReal ? input.to : Deno.env.get('INVOICE_EMAIL_TEST_TO')
  if (!resendKey || !from || !to) return false

  const name = input.stableName.replace(/["\\<>\r\n]/g, '').trim()
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: name ? `"${name} via Stalldrift" <${from}>` : from,
        to: [to],
        ...(input.replyTo ? { reply_to: input.replyTo } : {}),
        subject: input.subject,
        text: input.text,
      }),
    })
    if (!response.ok) console.error('email failed:', await response.text())
    return response.ok
  } catch (error) {
    console.error('email failed:', error)
    return false
  }
}

export const SUPPORT_EMAIL = 'support@nestundigital.no'

// support@nestundigital.no is shared across several Nestun Digital apps, so
// the subject carries a fixed [StallDrift] tag — kept in English regardless
// of UI language — that support can filter or label on. The context block
// below is for the same reason: a consistent, support-side format rather
// than translated prose.
export function supportMailto({
  stableName,
  accountEmail,
  role,
  platform,
}: {
  stableName?: string | null
  accountEmail?: string | null
  role?: string | null
  platform: 'web' | 'ios'
}): string {
  const subject = '[StallDrift] Support request'
  const body = [
    '',
    '',
    '---',
    `Stable: ${stableName ?? '—'}`,
    `Account: ${accountEmail ?? '—'}`,
    `Role: ${role ?? '—'}`,
    `Platform: ${platform === 'ios' ? 'iOS app' : 'Web'}`,
  ].join('\n')
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

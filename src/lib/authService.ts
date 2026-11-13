import { Capacitor, registerPlugin } from '@capacitor/core'
import { Browser } from '@capacitor/browser'
import { webOrigin } from './platform'
import { supabase } from './supabaseClient'

const NATIVE_OAUTH_REDIRECT = 'no.nestundigital.stalldrift://auth-callback'

export async function signIn({
  email,
  password,
}: {
  email: string
  password: string
}) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  })
  if (error) throw error
  return data
}

export async function signUp({
  email,
  password,
  fullName,
}: {
  email: string
  password: string
  fullName: string
}) {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { full_name: fullName } },
  })
  if (error) throw error
  return data
}

// Supabase doesn't reveal that an email is taken: it answers as if the sign-up worked,
// but sets no password, and the only sign is a user with no identities.
export function signUpFoundExistingAccount(data: {
  user: { identities?: unknown[] | null } | null
}): boolean {
  return data.user?.identities?.length === 0
}

export function isWrongLoginError(error: unknown): boolean {
  return /invalid login credentials/i.test(String((error as Error)?.message))
}

export async function signInWithGoogle() {
  if (Capacitor.isNativePlatform()) {
    // Google refuses to sign in from an embedded WebView, so get the
    // OAuth URL from Supabase without auto-navigating and open it in the
    // system browser instead. Supabase redirects back to our custom URL
    // scheme once Google hands off, which main.tsx listens for.
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: NATIVE_OAUTH_REDIRECT,
        skipBrowserRedirect: true,
      },
    })
    if (error) throw error
    if (data.url) await Browser.open({ url: data.url })
    return
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/auth` },
  })
  if (error) throw error
}

// Apple's own sign-in sheet in the iPhone app, from MainViewController.swift.
type AppleSignInResult = {
  identityToken: string
  givenName?: string
  familyName?: string
}
const AppleSignIn = registerPlugin<{
  signIn(options: { nonce: string }): Promise<AppleSignInResult>
}>('AppleSignIn')

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(text),
  )
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}

export function isAppleSignInCancelled(error: unknown): boolean {
  return (error as { code?: string })?.code === 'CANCELLED'
}

export async function signInWithApple() {
  if (Capacitor.isNativePlatform()) {
    // Apple gets the hashed nonce and Supabase the raw one, so a token can't
    // be replayed in another sign-in.
    const bytes = crypto.getRandomValues(new Uint8Array(32))
    const nonce = Array.from(bytes, (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('')
    const result = await AppleSignIn.signIn({ nonce: await sha256Hex(nonce) })
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: result.identityToken,
      nonce,
    })
    if (error) throw error

    // Apple gives the name only the first time, and after the user is made,
    // so the profile is filled in here when it's still empty.
    const fullName = [result.givenName, result.familyName]
      .filter(Boolean)
      .join(' ')
      .trim()
    if (fullName && data.user) {
      await supabase.auth.updateUser({ data: { full_name: fullName } })
      await supabase
        .from('profiles')
        .update({ full_name: fullName })
        .eq('id', data.user.id)
        .eq('full_name', '')
    }
    return
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'apple',
    options: { redirectTo: `${window.location.origin}/auth` },
  })
  if (error) throw error
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function requestPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${webOrigin()}/reset-password`,
  })
  if (error) throw error
}

export async function updatePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
}

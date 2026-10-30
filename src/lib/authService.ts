import { Capacitor } from '@capacitor/core'
import { Browser } from '@capacitor/browser'
import { webOrigin } from './platform'
import { supabase } from './supabaseClient'

const NATIVE_OAUTH_REDIRECT = 'com.stalldrift.app://auth-callback'

export async function signIn({
  email,
  password,
}: {
  email: string
  password: string
}) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
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
    email,
    password,
    options: { data: { full_name: fullName } },
  })
  if (error) throw error
  return data
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

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function requestPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${webOrigin()}/reset-password`,
  })
  if (error) throw error
}

export async function updatePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
}

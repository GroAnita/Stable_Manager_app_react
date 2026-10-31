import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import { getMyOwnerRecord } from '../features/owners/api'
import { supabase } from './supabaseClient'

// Only horse owners get push today — the notifications table this is
// built on only generates owner-facing events (feeding rota reminders,
// shift swaps). Safe to call repeatedly; re-registering is a no-op on the
// OS side and upserts the same token row.
export async function registerForPushNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return

  const owner = await getMyOwnerRecord()
  if (!owner) return

  const current = await PushNotifications.checkPermissions()
  let granted = current.receive === 'granted'
  if (current.receive === 'prompt') {
    const requested = await PushNotifications.requestPermissions()
    granted = requested.receive === 'granted'
  }
  if (!granted) return

  PushNotifications.addListener('registration', async (token) => {
    const { error } = await supabase.from('push_tokens').upsert(
      { owner_id: owner.id, platform: 'ios', token: token.value },
      { onConflict: 'owner_id,token' },
    )
    if (error) console.error('Failed to register push token:', error.message)
  })

  PushNotifications.addListener('registrationError', (err) => {
    console.error('Push registration error:', err.error)
  })

  await PushNotifications.register()
}

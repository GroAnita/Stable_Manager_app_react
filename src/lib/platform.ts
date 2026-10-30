import { Capacitor } from '@capacitor/core'

// window.location.origin resolves to the app's internal Capacitor scheme on
// native platforms, which isn't reachable from outside the app (e.g. a
// password-reset link tapped in Mail, or an invite link shared elsewhere).
// Fall back to the deployed web app for any link meant to be opened outside
// the app itself.
const PRODUCTION_WEB_ORIGIN = 'https://stable-manager-app-react.vercel.app'

export function webOrigin(): string {
  return Capacitor.isNativePlatform()
    ? PRODUCTION_WEB_ORIGIN
    : window.location.origin
}

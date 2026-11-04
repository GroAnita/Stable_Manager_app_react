import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { App as CapacitorApp } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { Capacitor } from '@capacitor/core'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import './index.css'
import { ConsentBanner } from './components/ConsentBanner'
import { AuthProvider } from './lib/AuthContext'
import { initClarity } from './lib/clarity'
import { disableNumberInputStepping } from './lib/numberInputs'
import { PreferencesProvider } from './lib/PreferencesContext'
import { router } from './router'
import { supabase } from './lib/supabaseClient'

initClarity()
disableNumberInputStepping()

// A deploy can ship new, differently-hashed JS chunks while a tab is still
// open on the old build. Navigating to a lazy-loaded route then tries to
// fetch a chunk that no longer exists, which Vite surfaces as this event —
// reload once to pick up the current build instead of showing an error.
const RELOAD_FLAG = 'stalldrift-chunk-reload'
window.addEventListener('vite:preloadError', () => {
  if (sessionStorage.getItem(RELOAD_FLAG)) return
  sessionStorage.setItem(RELOAD_FLAG, '1')
  window.location.reload()
})
window.addEventListener('load', () => sessionStorage.removeItem(RELOAD_FLAG))

if (Capacitor.isNativePlatform()) {
  CapacitorApp.addListener('appUrlOpen', ({ url }) => {
    if (!url.startsWith('no.nestundigital.stalldrift://auth-callback')) return
    Browser.close()
    supabase.auth.exchangeCodeForSession(url).then(({ error }) => {
      if (error) console.error('Google sign-in failed:', error.message)
    })
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PreferencesProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
      <ConsentBanner />
      <SpeedInsights />
      <Analytics />
    </PreferencesProvider>
  </StrictMode>,
)

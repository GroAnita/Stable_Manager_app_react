import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { App as CapacitorApp } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { Capacitor } from '@capacitor/core'
import './index.css'
import { AuthProvider } from './lib/AuthContext'
import { PreferencesProvider } from './lib/PreferencesContext'
import { router } from './router'
import { supabase } from './lib/supabaseClient'

if (Capacitor.isNativePlatform()) {
  CapacitorApp.addListener('appUrlOpen', ({ url }) => {
    if (!url.startsWith('com.stalldrift.app://auth-callback')) return
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
    </PreferencesProvider>
  </StrictMode>,
)

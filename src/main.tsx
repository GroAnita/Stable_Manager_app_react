import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import './index.css'
import { AuthProvider } from './lib/AuthContext'
import { PreferencesProvider } from './lib/PreferencesContext'
import { router } from './router'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PreferencesProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </PreferencesProvider>
  </StrictMode>,
)

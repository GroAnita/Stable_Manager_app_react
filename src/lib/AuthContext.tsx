import { isAuthApiError, type Session } from '@supabase/supabase-js'
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { getMyProfile, type Profile } from '../features/settings/api'
import { registerForPushNotifications } from './push'
import { supabase } from './supabaseClient'

type AuthContextValue = {
  session: Session | null
  loading: boolean
  profile: Profile | null
  profileLoading: boolean
  refreshProfile: () => Promise<void>
}

// The server no longer accepts this login: the user was deleted or blocked, for
// example after deleting the account. Being offline doesn't count.
function loginIsGone(error: unknown): boolean {
  return isAuthApiError(error) && [401, 403, 404].includes(error.status)
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileForUserId, setProfileForUserId] = useState<string | null>(null)
  const profileLoading =
    session !== null && profileForUserId !== session.user.id

  async function refreshProfile() {
    if (!session) return
    try {
      const data = await getMyProfile()
      setProfile(data)
    } catch {
      setProfile(null)
    } finally {
      setProfileForUserId(session.user.id)
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return
    let cancelled = false
    getMyProfile()
      .then((data) => {
        if (!cancelled) setProfile(data)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setProfile(null)
        // Otherwise the app would send them to create a new stable.
        if (loginIsGone(error)) void supabase.auth.signOut({ scope: 'local' })
      })
      .finally(() => {
        if (!cancelled) setProfileForUserId(session.user.id)
      })
    return () => {
      cancelled = true
    }
  }, [session])

  useEffect(() => {
    if (profile?.role !== 'horse_owner') return
    registerForPushNotifications().catch((err: Error) =>
      console.error('Push registration failed:', err.message),
    )
  }, [profile])

  return (
    <AuthContext.Provider
      value={{ session, loading, profile, profileLoading, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

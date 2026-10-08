import type { Session } from '@supabase/supabase-js'
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { getMyProfile, type Profile } from '../features/settings/api'
import { supabase } from './supabaseClient'

type AuthContextValue = {
  session: Session | null
  loading: boolean
  profile: Profile | null
  profileLoading: boolean
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileForUserId, setProfileForUserId] = useState<string | null>(
    null,
  )
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
      .catch(() => {
        if (!cancelled) setProfile(null)
      })
      .finally(() => {
        if (!cancelled) setProfileForUserId(session.user.id)
      })
    return () => {
      cancelled = true
    }
  }, [session])

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

import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import type { ReactNode } from 'react'

export function RequireAuth({
  children,
  requireStable = true,
}: {
  children: ReactNode
  requireStable?: boolean
}) {
  const { session, loading, profile, profileLoading } = useAuth()

  if (loading) return <p>Loading…</p>
  if (!session) return <Navigate to="/auth" replace />
  if (requireStable) {
    if (profileLoading) return <p>Loading…</p>
    if (!profile?.stable_id) {
      const pendingToken = sessionStorage.getItem('pendingInviteToken')
      return (
        <Navigate
          to={pendingToken ? `/invite/${pendingToken}` : '/onboarding'}
          replace
        />
      )
    }
  }
  return children
}

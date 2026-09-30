import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Icon, type IconName } from '../components/Icon'
import { signOut } from '../lib/authService'
import { useAuth } from '../lib/AuthContext'
import { usePreferences } from '../lib/PreferencesContext'

const navItems: { key: string; to: string; icon: IconName | 'horse' }[] = [
  { key: 'dashboard', to: '/dashboard', icon: 'home' },
  { key: 'horses', to: '/horses', icon: 'horse' },
  { key: 'owners', to: '/owners', icon: 'users' },
  { key: 'stalls', to: '/stalls', icon: 'grid' },
  { key: 'contracts', to: '/contracts', icon: 'fileText' },
  { key: 'payments', to: '/payments', icon: 'dollar' },
  { key: 'calendar', to: '/calendar', icon: 'calendar' },
  { key: 'tasks', to: '/tasks', icon: 'checkSquare' },
  { key: 'reports', to: '/reports', icon: 'chart' },
  { key: 'priceList', to: '/price-list', icon: 'priceList' },
  { key: 'settings', to: '/settings', icon: 'settings' },
]

export default function AppLayout() {
  const { session } = useAuth()
  const { t } = usePreferences()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  async function handleSignOut() {
    await signOut()
    navigate('/auth', { replace: true })
  }

  return (
    <div className="min-h-screen lg:flex">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 shrink-0 flex-col gap-6 overflow-y-auto border-r border-white/70 bg-cream px-5 py-6 transition-transform duration-300 lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-forest">Stable Manager</h1>
          <button
            type="button"
            className="rounded-full p-2 text-ink/60 hover:bg-white lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <Icon name="x" className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-ink/70 hover:bg-white hover:text-forest ${
                  isActive ? 'bg-white text-forest shadow-soft' : ''
                }`
              }
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/70 text-forest">
                <Icon name={item.icon} className="h-5 w-5" />
              </span>
              <span>{t(`nav.${item.key}`)}</span>
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-white/70 pt-4">
          <p className="mb-2 truncate px-1 text-xs text-ink/60">
            {session?.user.email}
          </p>
          <button
            type="button"
            className="btn-primary w-full"
            onClick={handleSignOut}
          >
            {t('nav.signOut')}
          </button>
        </div>
      </aside>
      <div className="flex min-h-screen flex-1 flex-col lg:min-w-0">
        <header className="flex items-center gap-3 border-b border-white/70 bg-cream/90 px-4 py-5 backdrop-blur md:px-6">
          <button
            type="button"
            className="rounded-2xl border border-slate-200 bg-white p-2.5 text-ink/70 lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Icon name="menu" className="h-5 w-5" />
          </button>
          <p className="text-xs font-medium tracking-[0.25em] text-ink/40 uppercase">
            {t('nav.overview')}
          </p>
        </header>
        <main className="flex-1 overflow-x-hidden px-4 py-6 md:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

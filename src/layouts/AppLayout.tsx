import { Suspense, useState } from 'react'
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Icon, type IconName } from '../components/Icon'
import { signOut } from '../lib/authService'
import { useAuth } from '../lib/AuthContext'
import { usePreferences } from '../lib/PreferencesContext'

type NavItem = { key: string; to: string; icon: IconName | 'horse' }

const dashboardItem: NavItem = { key: 'dashboard', to: '/dashboard', icon: 'home' }

const navGroups: { labelKey: string; items: NavItem[] }[] = [
  {
    labelKey: 'nav.groupStableOperations',
    items: [
      { key: 'horses', to: '/horses', icon: 'horse' },
      { key: 'owners', to: '/owners', icon: 'users' },
      { key: 'stalls', to: '/stalls', icon: 'grid' },
      { key: 'calendar', to: '/calendar', icon: 'calendar' },
      { key: 'tasks', to: '/tasks', icon: 'checkSquare' },
    ],
  },
  {
    labelKey: 'nav.groupBusiness',
    items: [
      { key: 'contracts', to: '/contracts', icon: 'fileText' },
      { key: 'payments', to: '/payments', icon: 'dollar' },
      { key: 'priceList', to: '/price-list', icon: 'priceList' },
      { key: 'inventory', to: '/inventory', icon: 'box' },
      { key: 'reports', to: '/reports', icon: 'chart' },
    ],
  },
]

const settingsItem: NavItem = { key: 'settings', to: '/settings', icon: 'settings' }

const ownerNavItems: NavItem[] = [
  { key: 'dashboard', to: '/owner-dashboard', icon: 'home' },
  { key: 'myHorse', to: '/my-horse', icon: 'horse' },
  { key: 'myContract', to: '/my-contract', icon: 'fileText' },
  { key: 'calendar', to: '/calendar', icon: 'calendar' },
]

const ownerProfileItem: NavItem = {
  key: 'myProfile',
  to: '/my-profile',
  icon: 'settings',
}

const OWNER_ALLOWED_PATHS = [
  '/owner-dashboard',
  '/my-horse',
  '/my-contract',
  '/my-profile',
  '/calendar',
]

function SidebarLink({ item, onClick }: { item: NavItem; onClick: () => void }) {
  const { t } = usePreferences()
  return (
    <NavLink
      to={item.to}
      onClick={onClick}
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
  )
}

export default function AppLayout() {
  const { session, profile } = useAuth()
  const { t } = usePreferences()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const isOwner = profile?.role === 'horse_owner'

  async function handleSignOut() {
    await signOut()
    navigate('/auth', { replace: true })
  }

  if (isOwner && !OWNER_ALLOWED_PATHS.includes(location.pathname)) {
    return <Navigate to="/owner-dashboard" replace />
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
        <nav className="flex flex-1 flex-col gap-4 overflow-y-auto">
          {isOwner ? (
            <div className="flex flex-col gap-1">
              {ownerNavItems.map((item) => (
                <SidebarLink
                  key={item.to}
                  item={item}
                  onClick={() => setSidebarOpen(false)}
                />
              ))}
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-1">
                <SidebarLink
                  item={dashboardItem}
                  onClick={() => setSidebarOpen(false)}
                />
              </div>
              {navGroups.map((group) => (
                <div key={group.labelKey} className="flex flex-col gap-1">
                  <p className="px-4 text-xs font-semibold tracking-wide text-ink/40 uppercase">
                    {t(group.labelKey)}
                  </p>
                  {group.items.map((item) => (
                    <SidebarLink
                      key={item.to}
                      item={item}
                      onClick={() => setSidebarOpen(false)}
                    />
                  ))}
                </div>
              ))}
            </>
          )}
        </nav>
        <div className="border-t border-white/70 pt-4">
          <SidebarLink
            item={isOwner ? ownerProfileItem : settingsItem}
            onClick={() => setSidebarOpen(false)}
          />
          <p className="mt-3 mb-2 truncate px-1 text-xs text-ink/60">
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
          <Suspense
            fallback={
              <p className="text-sm text-slate-500">{t('common.loading')}</p>
            }
          >
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  )
}

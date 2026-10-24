import { Suspense, useState } from 'react'
import {
  Navigate,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import logoDark from '../assets/stalldrift-logo-dark.svg'
import logoLight from '../assets/stalldrift-logo-light.svg'
import { Icon, type IconName } from '../components/Icon'
import { NotificationBell } from '../components/NotificationBell'
import { OnboardingChecklist } from '../components/OnboardingChecklist'
import { signOut } from '../lib/authService'
import { useAuth } from '../lib/AuthContext'
import { usePreferences } from '../lib/PreferencesContext'
import 'flag-icons/css/flag-icons.min.css'

type NavItem = { key: string; to: string; icon: IconName | 'horse' }

const dashboardItem: NavItem = {
  key: 'dashboard',
  to: '/dashboard',
  icon: 'home',
}

const navGroups: { labelKey: string; items: NavItem[] }[] = [
  {
    labelKey: 'nav.groupStableOperations',
    items: [
      { key: 'horses', to: '/horses', icon: 'horse' },
      { key: 'owners', to: '/owners', icon: 'users' },
      { key: 'stalls', to: '/stalls', icon: 'grid' },
      { key: 'paddocks', to: '/paddocks', icon: 'map' },
      { key: 'calendar', to: '/calendar', icon: 'calendar' },
      { key: 'tasks', to: '/tasks', icon: 'checkSquare' },
      { key: 'feedingRota', to: '/feeding-rota', icon: 'feedBag' },
      { key: 'noticeBoard', to: '/notice-board', icon: 'bell' },
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

const settingsItem: NavItem = {
  key: 'settings',
  to: '/settings',
  icon: 'settings',
}

const ownerNavItems: NavItem[] = [
  { key: 'dashboard', to: '/owner-dashboard', icon: 'home' },
  { key: 'myHorse', to: '/my-horse', icon: 'horse' },
  { key: 'myContract', to: '/my-contract', icon: 'fileText' },
  { key: 'calendar', to: '/calendar', icon: 'calendar' },
  { key: 'myFeedingRota', to: '/my-feeding-rota', icon: 'feedBag' },
  { key: 'noticeBoard', to: '/notice-board', icon: 'bell' },
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
  '/my-feeding-rota',
  '/notice-board',
]

function SidebarLink({
  item,
  onClick,
}: {
  item: NavItem
  onClick: () => void
}) {
  const { t } = usePreferences()
  return (
    <NavLink
      to={item.to}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-ink/70 hover:bg-card hover:text-forest ${
          isActive ? 'bg-card text-forest shadow-soft' : ''
        }`
      }
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/70 text-primary">
        <Icon name={item.icon} className="h-5 w-5" />
      </span>
      <span>{t(`nav.${item.key}`)}</span>
    </NavLink>
  )
}

export default function AppLayout() {
  const { session, profile } = useAuth()
  const { t, language, setLanguage, setCurrency } = usePreferences()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const isOwner = profile?.role === 'horse_owner'

  function selectEnglish() {
    setLanguage('en')
    setCurrency('EUR')
  }

  function selectNorwegian() {
    setLanguage('no')
    setCurrency('NOK')
  }

  async function handleSignOut() {
    await signOut()
    navigate('/auth', { replace: true })
  }

  if (isOwner && !OWNER_ALLOWED_PATHS.includes(location.pathname)) {
    return <Navigate to="/owner-dashboard" replace />
  }

  return (
    <div className="min-h-screen lg:flex">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-xl focus:bg-forest focus:px-4 focus:py-2.5 focus:text-sm focus:font-medium focus:text-white focus:shadow-soft"
      >
        {t('nav.skipToContent')}
      </a>
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 shrink-0 flex-col gap-6 overflow-y-auto border-r border-white/70 bg-cream px-5 py-6 transition-transform duration-300 lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between lg:justify-center">
          <h1>
            <img
              src={logoLight}
              alt={t('common.appName')}
              className="logo-for-light h-11 w-auto"
            />
            <img
              src={logoDark}
              alt={t('common.appName')}
              className="logo-for-dark h-11 w-auto"
            />
          </h1>
          <button
            type="button"
            aria-label={t('nav.closeMenu')}
            className="rounded-full p-2 text-ink/60 hover:bg-card lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <Icon name="x" className="h-5 w-5" />
          </button>
        </div>
        <nav
          aria-label={t('nav.mainNavigation')}
          className="flex flex-1 flex-col gap-4 overflow-y-auto"
        >
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
        <header className="flex flex-col gap-3 border-b border-white/70 bg-cream/90 px-4 py-4 backdrop-blur lg:flex-row lg:items-center lg:py-5 lg:px-6">
          <div className="order-1 flex items-center justify-center gap-3 lg:order-2 lg:flex-1">
            {profile?.stable?.name && (
              <>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-forest/10 text-sm font-semibold text-forest">
                  {profile.stable.logo_url ? (
                    <img
                      src={profile.stable.logo_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    profile.stable.name.charAt(0).toUpperCase()
                  )}
                </div>
                <p className="text-2xl font-semibold text-forest lg:text-4xl">
                  {profile.stable.name}
                </p>
              </>
            )}
          </div>
          <div className="order-2 flex items-center justify-between gap-3 lg:contents">
            <div className="order-1 flex items-center gap-3">
              <button
                type="button"
                aria-label={t('nav.openMenu')}
                className="rounded-2xl border border-slate-200 bg-card p-2.5 text-ink/70 lg:hidden"
                onClick={() => setSidebarOpen(true)}
              >
                <Icon name="menu" className="h-5 w-5" />
              </button>
              <p className="text-xs font-medium tracking-[0.25em] text-ink/40 uppercase">
                {profile?.role ? t(`role.${profile.role}`) : t('nav.overview')}
              </p>
            </div>
            <div className="order-3 flex items-center gap-2 lg:ml-auto">
              <NotificationBell />
              <button
                type="button"
                aria-label="English"
                onClick={selectEnglish}
                className={
                  language === 'en' ? '' : 'opacity-50 hover:opacity-100'
                }
              >
                <span className="fi fi-gb"></span>
              </button>
              <button
                type="button"
                aria-label="Norsk"
                onClick={selectNorwegian}
                className={
                  language === 'no' ? '' : 'opacity-50 hover:opacity-100'
                }
              >
                <span className="fi fi-no"></span>
              </button>
            </div>
          </div>
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 overflow-x-hidden px-4 py-6 md:px-6"
        >
          <Suspense
            fallback={
              <p className="text-sm text-slate-500">{t('common.loading')}</p>
            }
          >
            <Outlet />
          </Suspense>
        </main>
      </div>
      {profile?.role === 'stable_owner' && profile.stable_id && (
        <OnboardingChecklist stableId={profile.stable_id} />
      )}
    </div>
  )
}

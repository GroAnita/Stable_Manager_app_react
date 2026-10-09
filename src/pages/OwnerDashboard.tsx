import { Link } from 'react-router-dom'
import { AnnouncementBoard } from '../components/AnnouncementBoard'
import { Icon, type IconName } from '../components/Icon'
import { usePreferences } from '../lib/PreferencesContext'

const quickLinks: { labelKey: string; to: string; icon: IconName | 'horse' }[] = [
  { labelKey: 'ownerDashboard.myHorse', to: '/my-horse', icon: 'horse' },
  { labelKey: 'ownerDashboard.myContract', to: '/my-contract', icon: 'fileText' },
  { labelKey: 'ownerDashboard.calendar', to: '/calendar', icon: 'calendar' },
  { labelKey: 'ownerDashboard.myProfile', to: '/my-profile', icon: 'settings' },
]

export default function OwnerDashboard() {
  const { t } = usePreferences()

  return (
    <div className="page-shell">
      <section className="page-header">
        <div>
          <p className="text-sm tracking-[0.25em] text-slate-400 uppercase">
            {t('nav.overview')}
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">
            {t('ownerDashboard.title')}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {t('ownerDashboard.subtitle')}
          </p>
        </div>
      </section>

      <AnnouncementBoard canManage={false} />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {quickLinks.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="panel flex items-center gap-3 p-4 transition hover:shadow-soft"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-forest/10 text-forest">
              <Icon name={link.icon} className="h-5 w-5" />
            </span>
            <span className="font-medium text-slate-800">
              {t(link.labelKey)}
            </span>
          </Link>
        ))}
      </section>
    </div>
  )
}

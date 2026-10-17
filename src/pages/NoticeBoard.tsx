import { AnnouncementBoard } from '../components/AnnouncementBoard'
import { useAuth } from '../lib/AuthContext'
import { usePreferences } from '../lib/PreferencesContext'

export default function NoticeBoard() {
  const { t } = usePreferences()
  const { profile } = useAuth()
  const canManage = profile?.role !== 'horse_owner'

  return (
    <div className="page-shell">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">
          {t('announcements.title')}
        </h1>
      </div>
      <AnnouncementBoard canManage={canManage} />
    </div>
  )
}

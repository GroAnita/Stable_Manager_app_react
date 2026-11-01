import { useState } from 'react'
import { CoursesPanel } from './lessons/CoursesPanel'
import { SchedulePanel } from './lessons/SchedulePanel'
import { SchoolHorsesPanel } from './lessons/SchoolHorsesPanel'
import { usePreferences } from '../lib/PreferencesContext'

type LessonsSection = 'schedule' | 'courses' | 'schoolHorses'

const SECTIONS: { key: LessonsSection; labelKey: string }[] = [
  { key: 'schedule', labelKey: 'lessons.navSchedule' },
  { key: 'courses', labelKey: 'lessons.navCourses' },
  { key: 'schoolHorses', labelKey: 'lessons.navSchoolHorses' },
]

export default function Lessons() {
  const { t } = usePreferences()
  const [section, setSection] = useState<LessonsSection>('schedule')

  return (
    <div className="page-shell">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">
          {t('lessons.title')}
        </h1>
        <p className="mt-2 text-sm text-slate-500">{t('lessons.subtitle')}</p>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <nav className="flex shrink-0 flex-col gap-1 lg:w-56">
          {SECTIONS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setSection(item.key)}
              className={`rounded-2xl px-3 py-2.5 text-left text-sm font-medium ${
                section === item.key
                  ? 'bg-forest/10 text-forest'
                  : 'text-ink/70 hover:bg-card'
              }`}
            >
              {t(item.labelKey)}
            </button>
          ))}
        </nav>

        <div className="min-w-0 flex-1">
          {section === 'schedule' && <SchedulePanel />}
          {section === 'courses' && <CoursesPanel />}
          {section === 'schoolHorses' && <SchoolHorsesPanel />}
        </div>
      </div>
    </div>
  )
}

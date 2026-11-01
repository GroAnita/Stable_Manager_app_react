import { useState } from 'react'
import { BookLessonPanel } from './myLessons/BookLessonPanel'
import { CoursesEnrolPanel } from './myLessons/CoursesEnrolPanel'
import { MyBookingsPanel } from './myLessons/MyBookingsPanel'
import { MyFamilyPanel } from './myLessons/MyFamilyPanel'
import { usePreferences } from '../lib/PreferencesContext'

type MyLessonsSection = 'myBookings' | 'bookLesson' | 'courses' | 'myFamily'

const SECTIONS: { key: MyLessonsSection; labelKey: string }[] = [
  { key: 'myBookings', labelKey: 'myLessons.navMyBookings' },
  { key: 'bookLesson', labelKey: 'myLessons.navBookLesson' },
  { key: 'courses', labelKey: 'myLessons.navCourses' },
  { key: 'myFamily', labelKey: 'myLessons.navMyFamily' },
]

export default function MyLessons() {
  const { t } = usePreferences()
  const [section, setSection] = useState<MyLessonsSection>('myBookings')

  return (
    <div className="page-shell">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">
          {t('myLessons.title')}
        </h1>
        <p className="mt-2 text-sm text-slate-500">{t('myLessons.subtitle')}</p>
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
          {section === 'myBookings' && <MyBookingsPanel />}
          {section === 'bookLesson' && <BookLessonPanel />}
          {section === 'courses' && <CoursesEnrolPanel />}
          {section === 'myFamily' && <MyFamilyPanel />}
        </div>
      </div>
    </div>
  )
}

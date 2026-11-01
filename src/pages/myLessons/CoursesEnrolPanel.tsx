import { useEffect, useState } from 'react'
import { EmptyState } from '../../components/EmptyState'
import {
  listMyHorses,
  listSchoolHorses,
  type SchoolHorseOption,
} from '../../features/horses/api'
import {
  enrolInCourse,
  listCourses,
  listMyEnrolments,
  withdrawFromCourse,
  type Course,
  type Enrolment,
} from '../../features/lessons/api'
import { getMyOwnerRecord } from '../../features/owners/api'
import { listRiders, type Rider } from '../../features/riders/api'
import { usePreferences } from '../../lib/PreferencesContext'

const SELF = '__self__'

export function CoursesEnrolPanel() {
  const { t, formatDate } = usePreferences()
  const [ownerId, setOwnerId] = useState<string | null>(null)
  const [riders, setRiders] = useState<Rider[]>([])
  const [horses, setHorses] = useState<{ id: string; name: string }[]>([])
  const [schoolHorses, setSchoolHorses] = useState<SchoolHorseOption[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [enrolments, setEnrolments] = useState<Enrolment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [riderByCourse, setRiderByCourse] = useState<Record<string, string>>({})
  const [horseByCourse, setHorseByCourse] = useState<Record<string, string>>({})
  const [busyCourseId, setBusyCourseId] = useState<string | null>(null)
  const [busyEnrolmentId, setBusyEnrolmentId] = useState<string | null>(null)

  function load() {
    setLoading(true)
    Promise.all([
      getMyOwnerRecord(),
      listMyHorses(),
      listSchoolHorses(),
      listCourses(),
      listMyEnrolments(),
    ])
      .then(([owner, myHorses, mySchoolHorses, allCourses, myEnrolments]) => {
        setOwnerId(owner?.id ?? null)
        setHorses(myHorses.map((h) => ({ id: h.id, name: h.name })))
        setSchoolHorses(mySchoolHorses)
        setCourses(
          allCourses.filter(
            (c) => c.status === 'active' && c.booking_mode !== 'dropin_only',
          ),
        )
        setEnrolments(myEnrolments)
        return owner ? listRiders(owner.id) : []
      })
      .then(setRiders)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  async function handleEnrol(courseId: string) {
    if (!ownerId) return
    const riderChoice = riderByCourse[courseId] ?? SELF
    const horseChoice = horseByCourse[courseId]
    setActionError(null)
    setBusyCourseId(courseId)
    try {
      await enrolInCourse({
        courseId,
        ownerId,
        riderId: riderChoice === SELF ? null : riderChoice,
        horseId: horseChoice || null,
      })
      load()
    } catch (err) {
      setActionError((err as Error).message)
    } finally {
      setBusyCourseId(null)
    }
  }

  async function handleWithdraw(enrolmentId: string) {
    setActionError(null)
    setBusyEnrolmentId(enrolmentId)
    try {
      await withdrawFromCourse(enrolmentId)
      load()
    } catch (err) {
      setActionError((err as Error).message)
    } finally {
      setBusyEnrolmentId(null)
    }
  }

  const activeEnrolments = enrolments.filter((e) => e.status === 'active')

  return (
    <div className="space-y-6">
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {actionError && (
        <p role="alert" className="text-sm text-red-600">
          {actionError}
        </p>
      )}
      {loading && <p className="text-sm text-slate-500">{t('lessons.loading')}</p>}

      {!loading && activeEnrolments.length > 0 && (
        <div>
          <h2 className="section-title">{t('coursesEnrol.myEnrolmentsTitle')}</h2>
          <div className="mt-3 panel space-y-3 p-5">
            {activeEnrolments.map((enrolment) => (
              <div
                key={enrolment.id}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-slate-700">
                  {enrolment.course?.title ?? '—'}
                </span>
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={busyEnrolmentId === enrolment.id}
                  onClick={() => handleWithdraw(enrolment.id)}
                >
                  {t('coursesEnrol.withdraw')}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="section-title">{t('coursesEnrol.availableCoursesTitle')}</h2>
        {!loading && courses.length === 0 && (
          <EmptyState
            title={t('coursesEnrol.noCoursesTitle')}
            message={t('coursesEnrol.noCoursesMessage')}
          />
        )}
        {courses.length > 0 && (
          <div className="mt-3 space-y-3">
            {courses.map((course) => (
              <div key={course.id} className="panel p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="font-medium text-slate-900">{course.title}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {[course.level, course.instructor_name].filter(Boolean).join(' · ')}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {formatDate(course.term_start_date)} – {formatDate(course.term_end_date)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {riders.length > 0 && (
                      <select
                        className="field"
                        value={riderByCourse[course.id] ?? SELF}
                        onChange={(e) =>
                          setRiderByCourse((prev) => ({
                            ...prev,
                            [course.id]: e.target.value,
                          }))
                        }
                      >
                        <option value={SELF}>{t('bookLesson.myself')}</option>
                        {riders.map((rider) => (
                          <option key={rider.id} value={rider.id}>
                            {rider.full_name}
                          </option>
                        ))}
                      </select>
                    )}
                    <select
                      className="field"
                      value={horseByCourse[course.id] ?? ''}
                      onChange={(e) =>
                        setHorseByCourse((prev) => ({
                          ...prev,
                          [course.id]: e.target.value,
                        }))
                      }
                    >
                      <option value="">{t('bookLesson.noHorsePreference')}</option>
                      {horses.map((horse) => (
                        <option key={horse.id} value={horse.id}>
                          {horse.name}
                        </option>
                      ))}
                      {schoolHorses.map((horse) => (
                        <option key={horse.id} value={horse.id}>
                          {horse.name} ({t('bookLesson.schoolHorseTag')})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={busyCourseId === course.id}
                      onClick={() => handleEnrol(course.id)}
                    >
                      {t('coursesEnrol.enrol')}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

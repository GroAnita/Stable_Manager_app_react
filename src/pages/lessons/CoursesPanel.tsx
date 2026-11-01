import { useEffect, useState, type FormEvent } from 'react'
import { EmptyState } from '../../components/EmptyState'
import { Icon } from '../../components/Icon'
import { Modal } from '../../components/Modal'
import {
  createCourse,
  generateSessionsForCourse,
  listCourses,
  listEnrolmentsForCourse,
  listSessionsForCourse,
  updateCourse,
  withdrawFromCourse,
  type Course,
  type CourseBookingMode,
  type CourseEnrolment,
  type LessonSessionWithBookings,
} from '../../features/lessons/api'
import { getCurrentStableId } from '../../lib/stableContext'
import { usePreferences } from '../../lib/PreferencesContext'

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const
const BOOKING_MODES: CourseBookingMode[] = ['mixed', 'term_only', 'dropin_only']

type CourseFormState = {
  title: string
  level: string
  instructor_name: string
  location: string
  capacity: string
  price: string
  weekday: string
  start_time: string
  end_time: string
  term_start_date: string
  term_end_date: string
  booking_mode: CourseBookingMode
  spare_release_days_before: string
}

function emptyForm(): CourseFormState {
  return {
    title: '',
    level: '',
    instructor_name: '',
    location: '',
    capacity: '6',
    price: '',
    weekday: '2',
    start_time: '17:00',
    end_time: '18:00',
    term_start_date: '',
    term_end_date: '',
    booking_mode: 'mixed',
    spare_release_days_before: '7',
  }
}

function toCourseForm(course: Course): CourseFormState {
  return {
    title: course.title,
    level: course.level ?? '',
    instructor_name: course.instructor_name ?? '',
    location: course.location ?? '',
    capacity: String(course.capacity),
    price: course.price != null ? String(course.price) : '',
    weekday: String(course.weekday),
    start_time: course.start_time.slice(0, 5),
    end_time: course.end_time.slice(0, 5),
    term_start_date: course.term_start_date,
    term_end_date: course.term_end_date,
    booking_mode: course.booking_mode,
    spare_release_days_before: String(course.spare_release_days_before),
  }
}

function formToCourseInput(form: CourseFormState) {
  return {
    title: form.title,
    level: form.level || null,
    instructor_name: form.instructor_name || null,
    location: form.location || null,
    capacity: Number(form.capacity) || 1,
    price: form.price ? Number(form.price) : null,
    weekday: Number(form.weekday),
    start_time: form.start_time,
    end_time: form.end_time,
    term_start_date: form.term_start_date,
    term_end_date: form.term_end_date,
    booking_mode: form.booking_mode,
    spare_release_days_before: Number(form.spare_release_days_before) || 0,
  }
}

function CourseFormFields({
  form,
  onChange,
}: {
  form: CourseFormState
  onChange: <K extends keyof CourseFormState>(key: K, value: CourseFormState[K]) => void
}) {
  const { t } = usePreferences()
  return (
    <>
      <label>
        <span className="field-label">{t('lessons.lessonTitle')}</span>
        <input
          required
          className="field"
          value={form.title}
          onChange={(e) => onChange('title', e.target.value)}
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <span className="field-label">{t('lessons.level')}</span>
          <input
            className="field"
            value={form.level}
            onChange={(e) => onChange('level', e.target.value)}
          />
        </label>
        <label>
          <span className="field-label">{t('lessons.instructor')}</span>
          <input
            className="field"
            value={form.instructor_name}
            onChange={(e) => onChange('instructor_name', e.target.value)}
          />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <span className="field-label">{t('lessons.weekdayLabel')}</span>
          <select
            className="field"
            value={form.weekday}
            onChange={(e) => onChange('weekday', e.target.value)}
          >
            {WEEKDAYS.map((day) => (
              <option key={day} value={day}>
                {t(`lessons.weekday.${day}`)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="field-label">{t('lessons.capacity')}</span>
          <input
            required
            type="number"
            min={1}
            className="field"
            value={form.capacity}
            onChange={(e) => onChange('capacity', e.target.value)}
          />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <span className="field-label">{t('lessons.startsAt')}</span>
          <input
            required
            type="time"
            className="field"
            value={form.start_time}
            onChange={(e) => onChange('start_time', e.target.value)}
          />
        </label>
        <label>
          <span className="field-label">{t('lessons.endsAt')}</span>
          <input
            required
            type="time"
            className="field"
            value={form.end_time}
            onChange={(e) => onChange('end_time', e.target.value)}
          />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <span className="field-label">{t('lessons.termStart')}</span>
          <input
            required
            type="date"
            className="field"
            value={form.term_start_date}
            onChange={(e) => onChange('term_start_date', e.target.value)}
          />
        </label>
        <label>
          <span className="field-label">{t('lessons.termEnd')}</span>
          <input
            required
            type="date"
            className="field"
            value={form.term_end_date}
            onChange={(e) => onChange('term_end_date', e.target.value)}
          />
        </label>
      </div>
      <label>
        <span className="field-label">{t('lessons.bookingModeLabel')}</span>
        <select
          className="field"
          value={form.booking_mode}
          onChange={(e) => onChange('booking_mode', e.target.value as CourseBookingMode)}
        >
          {BOOKING_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {t(`lessons.bookingMode.${mode}`)}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-400">{t('lessons.bookingModeHint')}</p>
      </label>
      {form.booking_mode === 'mixed' && (
        <label>
          <span className="field-label">{t('lessons.spareReleaseDays')}</span>
          <input
            type="number"
            min={0}
            className="field"
            value={form.spare_release_days_before}
            onChange={(e) => onChange('spare_release_days_before', e.target.value)}
          />
          <p className="mt-1 text-xs text-slate-400">
            {t('lessons.spareReleaseDaysHint')}
          </p>
        </label>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <span className="field-label">{t('lessons.location')}</span>
          <input
            className="field"
            value={form.location}
            onChange={(e) => onChange('location', e.target.value)}
          />
        </label>
        <label>
          <span className="field-label">{t('lessons.price')}</span>
          <input
            type="number"
            min={0}
            step="0.01"
            className="field"
            value={form.price}
            onChange={(e) => onChange('price', e.target.value)}
          />
        </label>
      </div>
    </>
  )
}

export function CoursesPanel() {
  const { t, formatDate } = usePreferences()
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState<CourseFormState>(emptyForm)
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  function load() {
    setLoading(true)
    listCourses()
      .then(setCourses)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  function openAdd() {
    setAddForm(emptyForm())
    setAddError(null)
    setAddOpen(true)
  }

  async function handleAddSubmit(event: FormEvent) {
    event.preventDefault()
    setAddSaving(true)
    setAddError(null)
    try {
      const stableId = await getCurrentStableId()
      if (!stableId) throw new Error(t('lessons.noStableFound'))
      const created = await createCourse({
        stable_id: stableId,
        ...formToCourseInput(addForm),
      })
      setCourses((prev) => [created, ...prev])
      setAddOpen(false)
      setSelectedId(created.id)
    } catch (err) {
      setAddError((err as Error).message)
    } finally {
      setAddSaving(false)
    }
  }

  function handleCourseUpdated(updated: Course) {
    setCourses((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
  }

  const selected = courses.find((c) => c.id === selectedId) ?? null

  if (selected) {
    return (
      <CourseDetailView
        course={selected}
        onBack={() => setSelectedId(null)}
        onCourseUpdated={handleCourseUpdated}
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <button type="button" className="btn-primary" onClick={openAdd}>
          <Icon name="plus" className="h-4 w-4" />
          {t('lessons.addCourse')}
        </button>
      </div>

      {loading && <p className="text-sm text-slate-500">{t('lessons.loading')}</p>}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {!loading && !error && courses.length === 0 && (
        <EmptyState
          title={t('lessons.noCoursesTitle')}
          message={t('lessons.noCoursesMessage')}
        />
      )}

      {!loading && !error && courses.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {courses.map((course) => (
            <button
              key={course.id}
              type="button"
              onClick={() => setSelectedId(course.id)}
              className="panel flex flex-col gap-2 p-5 text-left transition hover:-translate-y-0.5"
            >
              <div className="flex items-center gap-2">
                <p className="font-medium text-slate-900">{course.title}</p>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                  {t(`lessons.bookingMode.${course.booking_mode}`)}
                </span>
              </div>
              <p className="text-sm text-slate-500">
                {[course.level, course.instructor_name].filter(Boolean).join(' · ')}
              </p>
              <p className="text-sm text-slate-500">
                {formatDate(course.term_start_date)} – {formatDate(course.term_end_date)}
              </p>
            </button>
          ))}
        </div>
      )}

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title={t('lessons.addCourseModalTitle')}
      >
        <form onSubmit={handleAddSubmit} className="grid gap-4">
          {addError && (
            <p role="alert" className="text-sm text-red-600">
              {addError}
            </p>
          )}
          <CourseFormFields
            form={addForm}
            onChange={(key, value) => setAddForm((prev) => ({ ...prev, [key]: value }))}
          />
          <button type="submit" disabled={addSaving} className="btn-primary">
            {addSaving ? t('common.saving') : t('lessons.save')}
          </button>
        </form>
      </Modal>
    </div>
  )
}

function CourseDetailView({
  course,
  onBack,
  onCourseUpdated,
}: {
  course: Course
  onBack: () => void
  onCourseUpdated: (course: Course) => void
}) {
  const { t, formatDate, formatTime } = usePreferences()
  const [enrolments, setEnrolments] = useState<CourseEnrolment[]>([])
  const [sessions, setSessions] = useState<LessonSessionWithBookings[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [generateMessage, setGenerateMessage] = useState<string | null>(null)
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null)

  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState<CourseFormState>(() => toCourseForm(course))
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  function load() {
    setLoading(true)
    Promise.all([listEnrolmentsForCourse(course.id), listSessionsForCourse(course.id)])
      .then(([courseEnrolments, courseSessions]) => {
        setEnrolments(courseEnrolments)
        setSessions(courseSessions)
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [course.id])

  async function handleGenerateSessions() {
    setGenerating(true)
    setGenerateMessage(null)
    try {
      const generated = await generateSessionsForCourse(course)
      setGenerateMessage(t('lessons.sessionsGenerated', { count: generated.length, title: course.title }))
      load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setGenerating(false)
    }
  }

  async function handleWithdraw(enrolmentId: string) {
    setWithdrawingId(enrolmentId)
    try {
      await withdrawFromCourse(enrolmentId)
      setEnrolments((prev) =>
        prev.map((e) => (e.id === enrolmentId ? { ...e, status: 'withdrawn' } : e)),
      )
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setWithdrawingId(null)
    }
  }

  function openEdit() {
    setEditForm(toCourseForm(course))
    setEditError(null)
    setEditOpen(true)
  }

  async function handleEditSubmit(event: FormEvent) {
    event.preventDefault()
    setEditSaving(true)
    setEditError(null)
    try {
      const updated = await updateCourse(course.id, formToCourseInput(editForm))
      onCourseUpdated(updated)
      setEditOpen(false)
    } catch (err) {
      setEditError((err as Error).message)
    } finally {
      setEditSaving(false)
    }
  }

  const activeEnrolments = enrolments.filter((e) => e.status === 'active')

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 text-sm font-medium text-ink/70 hover:text-forest"
      >
        <Icon name="chevronLeft" className="h-4 w-4" />
        {t('lessons.backToCourses')}
      </button>

      <div className="panel p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="section-title">{course.title}</h2>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                {t(`lessons.bookingMode.${course.booking_mode}`)}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {[
                course.level,
                course.instructor_name,
                `${t(`lessons.weekday.${course.weekday}`)} ${course.start_time.slice(0, 5)}–${course.end_time.slice(0, 5)}`,
                course.location,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {formatDate(course.term_start_date)} – {formatDate(course.term_end_date)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className="btn-ghost" onClick={openEdit}>
              <Icon name="edit" className="h-4 w-4" />
              {t('common.edit')}
            </button>
            <button
              type="button"
              className="btn-ghost"
              disabled={generating}
              onClick={handleGenerateSessions}
            >
              {generating ? t('common.saving') : t('lessons.generateSessions')}
            </button>
          </div>
        </div>
        {generateMessage && (
          <p role="status" className="mt-3 text-sm text-emerald-700">
            {generateMessage}
          </p>
        )}
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-600">
            {error}
          </p>
        )}
      </div>

      <div className="panel p-6">
        <h3 className="section-title">{t('lessons.enrolledRidersTitle')}</h3>
        {loading && <p className="mt-2 text-sm text-slate-500">{t('lessons.loading')}</p>}
        {!loading && activeEnrolments.length === 0 && (
          <p className="mt-2 text-sm text-slate-500">{t('lessons.noEnrolmentsMessage')}</p>
        )}
        {activeEnrolments.length > 0 && (
          <div className="mt-3 flex flex-col gap-2">
            {activeEnrolments.map((enrolment) => (
              <div key={enrolment.id} className="flex items-center justify-between text-sm">
                <span className="text-slate-700">{enrolment.rider?.full_name ?? '—'}</span>
                <button
                  type="button"
                  className="text-xs font-medium text-red-600 hover:underline"
                  disabled={withdrawingId === enrolment.id}
                  onClick={() => handleWithdraw(enrolment.id)}
                >
                  {t('coursesEnrol.withdraw')}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="panel p-6">
        <h3 className="section-title">{t('lessons.sessionsTitle')}</h3>
        {!loading && sessions.length === 0 && (
          <p className="mt-2 text-sm text-slate-500">{t('lessons.noSessionsGeneratedMessage')}</p>
        )}
        {sessions.length > 0 && (
          <div className="mt-3 flex flex-col gap-2">
            {sessions.map((session) => (
              <div key={session.id} className="flex items-center justify-between text-sm">
                <span className="text-slate-700">
                  {formatDate(session.starts_at)} · {formatTime(session.starts_at)}–
                  {formatTime(session.ends_at)}
                </span>
                <span className="text-slate-500">
                  {t('lessons.spotsBooked', {
                    booked: session.bookings.filter((b) => b.status === 'confirmed').length,
                    capacity: session.capacity,
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={t('lessons.editCourseModalTitle')}
      >
        <form onSubmit={handleEditSubmit} className="grid gap-4">
          {editError && (
            <p role="alert" className="text-sm text-red-600">
              {editError}
            </p>
          )}
          <p className="text-xs text-slate-400">{t('lessons.editCourseHint')}</p>
          <CourseFormFields
            form={editForm}
            onChange={(key, value) => setEditForm((prev) => ({ ...prev, [key]: value }))}
          />
          <button type="submit" disabled={editSaving} className="btn-primary">
            {editSaving ? t('common.saving') : t('common.save')}
          </button>
        </form>
      </Modal>
    </div>
  )
}

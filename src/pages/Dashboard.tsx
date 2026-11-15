import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AnnouncementBoard } from '../components/AnnouncementBoard'
import { Badge } from '../components/Badge'
import { EmptyState } from '../components/EmptyState'
import { HorseAvatar } from '../components/HorseAvatar'
import { Icon, type IconName } from '../components/Icon'
import {
  countOpenInvoices,
  listEventsAround,
  type WeekEvent,
  getMonthPayments,
  listRecentActivity,
  listTodayTasks,
  listUpcomingVisits,
  type RecentActivityItem,
  type TodayTask,
  type UpcomingVisit,
} from '../features/dashboard/api'
import {
  listMySwapRequests,
  listShiftsInRange,
  listShiftTypes,
  type FeedingShift,
  type ShiftType,
  type SwapRequest,
} from '../features/feedingRota/api'
import { listHorses, type HorseListItem } from '../features/horses/api'
import { useAuth } from '../lib/AuthContext'
import { usePreferences } from '../lib/PreferencesContext'
import { getStatusColor } from '../lib/statusColor'

type DashboardData = {
  todayTasks: TodayTask[]
  visits: UpcomingVisit[]
  activity: RecentActivityItem[]
  horses: HorseListItem[]
  shiftTypes: ShiftType[]
  todayShifts: FeedingShift[]
  swaps: SwapRequest[]
  openInvoices: number
  monthPayments: { paid: number; open: number }
}

// Dates as YYYY-MM-DD in Norwegian time, which is what feeding_shifts.date holds.
function osloToday(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Oslo' })
}

function addDays(dateIso: string, days: number): string {
  const date = new Date(`${dateIso}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function mondayOf(dateIso: string): string {
  const weekday = new Date(`${dateIso}T00:00:00Z`).getUTCDay()
  return addDays(dateIso, -((weekday + 6) % 7))
}

function monthBounds(dateIso: string): [string, string] {
  const [year, month] = dateIso.split('-').map(Number)
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const prefix = dateIso.slice(0, 7)
  return [`${prefix}-01`, `${prefix}-${String(last).padStart(2, '0')}`]
}

function firstName(fullName: string | null | undefined): string {
  return (fullName ?? '').trim().split(/\s+/)[0] ?? ''
}

// Morning shifts get a sunrise, daytime a sun and evening a moon.
function shiftIcon(timeOfDay: string | null | undefined): IconName {
  const hour = Number((timeOfDay ?? '12').slice(0, 2))
  if (hour < 10) return 'sunrise'
  if (hour < 16) return 'sun'
  return 'moon'
}

export default function Dashboard() {
  const { t, formatDate, language } = usePreferences()
  const { profile } = useAuth()
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const locale = language === 'no' ? 'nb-NO' : 'en-GB'
  const today = osloToday()

  useEffect(() => {
    let cancelled = false
    const [monthStart, monthEnd] = monthBounds(today)
    Promise.all([
      listTodayTasks(),
      listUpcomingVisits(),
      listRecentActivity(),
      listHorses(),
      listShiftTypes(),
      listShiftsInRange(today, today),
      listMySwapRequests(),
      countOpenInvoices(),
      getMonthPayments(monthStart, monthEnd),
    ])
      .then(
        ([
          todayTasks,
          visits,
          activity,
          horses,
          shiftTypes,
          todayShifts,
          swaps,
          openInvoices,
          monthPayments,
        ]) => {
          if (cancelled) return
          setData({
            todayTasks,
            visits,
            activity,
            horses: horses.filter((horse) => horse.active),
            shiftTypes: shiftTypes
              .filter((type) => type.active)
              .sort((a, b) => a.time_of_day.localeCompare(b.time_of_day)),
            todayShifts: todayShifts
              .filter((shift) => shift.status === 'published')
              .sort((a, b) =>
                (a.shift_type?.time_of_day ?? '').localeCompare(
                  b.shift_type?.time_of_day ?? '',
                ),
              ),
            swaps: swaps.filter((swap) => swap.status === 'pending'),
            openInvoices,
            monthPayments,
          })
        },
      )
      .catch((err: Error) => {
        if (!cancelled) setError(err.message)
      })
    return () => {
      cancelled = true
    }
  }, [today])

  if (error) return <p role="alert">{t('dashboard.failedToLoad', { error })}</p>
  if (!data)
    return <p className="text-sm text-slate-500">{t('dashboard.loading')}</p>

  const { todayTasks, visits, activity } = data

  const hour = Number(
    new Date().toLocaleTimeString('sv-SE', {
      timeZone: 'Europe/Oslo',
      hour: '2-digit',
    }),
  )
  const greeting = t(
    hour < 10
      ? 'dashboard.greetingMorning'
      : hour < 18
        ? 'dashboard.greetingDay'
        : 'dashboard.greetingEvening',
  )
  const name = firstName(profile?.full_name)
  const todayLabel = new Date(`${today}T12:00:00Z`).toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })
  const monthName = new Date(`${today}T12:00:00Z`).toLocaleDateString(locale, {
    month: 'long',
    timeZone: 'UTC',
  })

  const stat = (
    icon: IconName | 'horse',
    value: number,
    label: string,
    to: string,
    highlight = false,
  ) => (
    <Link
      to={to}
      className={`flex min-w-0 items-center gap-3 rounded-2xl border p-4 shadow-card transition hover:-translate-y-0.5 sm:gap-4 sm:p-5 ${
        highlight && value > 0
          ? 'border-rose/30 bg-blush'
          : 'border-slate-200 bg-card'
      }`}
    >
      <Icon
        name={icon}
        className={`h-8 w-8 shrink-0 sm:h-10 sm:w-10 ${highlight && value > 0 ? 'text-rose' : 'text-forest'}`}
      />
      <div className="min-w-0">
        <p className="text-3xl leading-none font-semibold text-ink sm:text-4xl">
          {value}
        </p>
        <p className="mt-1 text-sm hyphens-auto text-slate-600 [overflow-wrap:anywhere]">
          {label}
        </p>
      </div>
    </Link>
  )

  const firstSwap = data.swaps[0]
  const paidShare =
    data.monthPayments.paid + data.monthPayments.open > 0
      ? data.monthPayments.paid /
        (data.monthPayments.paid + data.monthPayments.open)
      : 0

  return (
    <div className="page-shell">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-forest sm:text-4xl">
            {name
              ? t('dashboard.greetingWithName', { greeting, name })
              : greeting}
          </h1>
          <p className="mt-2 text-lg text-slate-600">
            {t('dashboard.subtitle')}
          </p>
        </div>
        <p className="flex items-center gap-2 rounded-full border border-slate-200 bg-card px-4 py-2 text-sm text-slate-700 first-letter:uppercase">
          <Icon name="calendar" className="h-4 w-4 text-forest" />
          <span className="first-letter:uppercase">{todayLabel}</span>
        </p>
      </section>

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {stat(
          'horse',
          data.horses.length,
          t('dashboard.statHorses'),
          '/horses',
        )}
        {stat(
          'users',
          data.todayShifts.length,
          t('dashboard.statShiftsToday'),
          '/feeding-rota',
        )}
        {stat(
          'fileText',
          data.openInvoices,
          t('dashboard.statOpenInvoices'),
          '/payments',
        )}
        {stat(
          'swap',
          data.swaps.length,
          t('dashboard.statSwapRequests'),
          '/feeding-rota',
          true,
        )}
      </section>

      <AnnouncementBoard canManage limit={5} />

      <section className="grid gap-6 xl:grid-cols-3">
        <WeekPanel
          shiftTypes={data.shiftTypes}
          today={today}
          locale={locale}
          className="xl:col-span-2"
        />

        <div className="flex min-w-0 flex-col gap-6">
          <Panel
            icon="dollar"
            title={t('dashboard.paymentsTitle')}
            to="/payments"
          >
            {data.monthPayments.paid + data.monthPayments.open === 0 ? (
              <p className="text-sm text-slate-500">
                {t('dashboard.paymentsNone')}
              </p>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-500">
                  {t('dashboard.paymentsMonth', { month: monthName })}
                </p>
                <ProgressRow
                  icon="checkSquare"
                  label={t('dashboard.paymentsPaid', {
                    count: data.monthPayments.paid,
                  })}
                  share={paidShare}
                  barClass="bg-forest"
                />
                <ProgressRow
                  icon="clock"
                  label={t('dashboard.paymentsOpen', {
                    count: data.monthPayments.open,
                  })}
                  share={1 - paidShare}
                  barClass="bg-warmbrown/60"
                />
              </div>
            )}
          </Panel>
          {firstSwap && (
            <div className="rounded-2xl border border-rose/30 bg-blush p-5">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
                <Icon name="swap" className="h-5 w-5 text-rose" />
                {t('dashboard.swapTitle')}
              </h2>
              <p className="mt-2 text-sm text-slate-700">
                {t('dashboard.swapText', {
                  name:
                    firstName(firstSwap.requested_by?.full_name) ||
                    t('dashboard.rotaOpen'),
                  day: firstSwap.shift?.date
                    ? new Date(
                        `${firstSwap.shift.date}T12:00:00Z`,
                      ).toLocaleDateString(locale, {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        timeZone: 'UTC',
                      })
                    : '',
                })}
                {data.swaps.length > 1 &&
                  ` ${t('dashboard.swapMore', { count: data.swaps.length - 1 })}`}
              </p>
              <Link
                to="/feeding-rota"
                className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-ink underline decoration-rose underline-offset-4"
              >
                {t('dashboard.seeRequest')}
                <Icon name="chevronRight" className="h-4 w-4" />
              </Link>
            </div>
          )}
        </div>
      </section>

      <Panel icon="horse" title={t('dashboard.horsesTitle')} to="/horses">
        {data.horses.length === 0 ? (
          <p className="text-sm text-slate-500">{t('dashboard.noHorses')}</p>
        ) : (
          <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
            {data.horses.map((horse) => (
              <Link
                key={horse.id}
                to={`/horses/${horse.id}`}
                className="flex w-56 shrink-0 snap-start items-center gap-3 rounded-2xl border border-slate-200 bg-card p-2 pr-4 hover:border-forest/30"
              >
                <HorseAvatar
                  name={horse.name}
                  photoUrl={horse.photo_url}
                  className="h-20 w-20 shrink-0 text-3xl"
                />
                <div className="min-w-0">
                  <p className="truncate text-xl font-semibold text-ink">
                    {horse.name}
                  </p>
                  <span className="mt-1 inline-block rounded-full bg-forest/10 px-2.5 py-0.5 text-xs text-forest">
                    {horse.stall
                      ? t('dashboard.stallLabel', {
                          number: horse.stall.stall_number,
                        })
                      : t('dashboard.noStall')}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Panel>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="panel p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="section-title">
              {t('dashboard.upcomingVisitsTitle')}
            </h2>
            <span className="text-sm text-slate-400">
              {t('dashboard.next14Days')}
            </span>
          </div>
          {visits.length === 0 ? (
            <EmptyState icon="📅" title={t('dashboard.noUpcomingVisits')} />
          ) : (
            <div className="space-y-3">
              {visits.map((visit) => (
                <div
                  key={visit.id}
                  className="flex items-start justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="min-w-0 font-medium wrap-break-word text-slate-800">
                        {visit.title}
                      </p>
                      {visit.event_type && <Badge status={visit.event_type} />}
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {visit.horse_name ?? t('dashboard.noHorseLinked')}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm whitespace-nowrap text-slate-500">
                    {formatDate(visit.start_time)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="section-title">{t('dashboard.todaysTasks')}</h2>
            <span className="text-sm text-slate-400">
              {t('dashboard.scheduledCount', { count: todayTasks.length })}
            </span>
          </div>
          {todayTasks.length === 0 ? (
            <p className="text-sm text-slate-500">
              {t('dashboard.noTasksToday')}
            </p>
          ) : (
            <div className="space-y-3">
              {todayTasks.map((task) => (
                <div
                  key={task.id}
                  className="rounded-2xl border border-slate-100 px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-slate-800">{task.title}</p>
                    {task.priority && <Badge status={task.priority} />}
                  </div>
                  {task.horse_name && (
                    <p className="mt-1 text-sm text-slate-500">
                      {task.horse_name}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
          <Link
            to="/tasks"
            className="mt-4 inline-block text-sm font-medium text-forest hover:underline"
          >
            {t('dashboard.viewAllTasks')}
          </Link>
        </div>

        <div className="panel p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="section-title">{t('dashboard.recentActivity')}</h2>
          </div>
          {activity.length === 0 ? (
            <p className="text-sm text-slate-500">
              {t('dashboard.noRecentActivity')}
            </p>
          ) : (
            <div className="space-y-3">
              {activity.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-3"
                >
                  <div className="mt-1 h-2.5 w-2.5 rounded-full bg-forest" />
                  <div>
                    <p className="font-medium text-slate-800">{item.summary}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {formatDate(item.created_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function Panel({
  icon,
  title,
  to,
  className = '',
  children,
}: {
  icon: IconName | 'horse'
  title: string
  to?: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className={`panel min-w-0 p-5 ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-3 text-2xl font-semibold text-ink">
          <Icon name={icon} className="h-7 w-7 text-forest" />
          {title}
        </h2>
        {to && (
          <Link
            to={to}
            aria-label={title}
            className="rounded-full p-1 text-slate-500 hover:text-forest"
          >
            <Icon name="chevronRight" className="h-5 w-5" />
          </Link>
        )}
      </div>
      {children}
    </div>
  )
}

function ProgressRow({
  icon,
  label,
  share,
  barClass,
}: {
  icon: IconName
  label: string
  share: number
  barClass: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3">
      <Icon name={icon} className="h-6 w-6 shrink-0 text-forest" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-ink">{label}</p>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full ${barClass}`}
            style={{ width: `${Math.round(share * 100)}%` }}
          />
        </div>
      </div>
    </div>
  )
}

type WeekTab = 'rota' | 'calendar'
const WEEK_TAB_KEY = 'stallorg.dashboardWeekTab'

function savedWeekTab(): WeekTab {
  try {
    return localStorage.getItem(WEEK_TAB_KEY) === 'calendar'
      ? 'calendar'
      : 'rota'
  } catch {
    return 'rota'
  }
}

// One week, as the feeding rota or the calendar. Both tabs share the week.
function WeekPanel({
  shiftTypes,
  today,
  locale,
  className = '',
}: {
  shiftTypes: ShiftType[]
  today: string
  locale: string
  className?: string
}) {
  const { t } = usePreferences()
  const [tab, setTab] = useState<WeekTab>(savedWeekTab)
  const [weekStart, setWeekStart] = useState(() => mondayOf(today))
  const days = Array.from({ length: 7 }, (_, index) =>
    addDays(weekStart, index),
  )

  function chooseTab(next: WeekTab) {
    setTab(next)
    try {
      localStorage.setItem(WEEK_TAB_KEY, next)
    } catch {
      // The choice just isn't remembered.
    }
  }

  // formatRange writes "9.–15. november" in Norwegian and "9–15 November" in English.
  const range = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).formatRange(
    new Date(`${days[0]}T12:00:00Z`),
    new Date(`${days[6]}T12:00:00Z`),
  )

  const tabs: { key: WeekTab; label: string }[] = [
    { key: 'rota', label: t('dashboard.rotaTitle') },
    { key: 'calendar', label: t('dashboard.calendarTab') },
  ]

  return (
    <div className={`panel min-w-0 p-5 ${className}`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Icon name="calendar" className="h-7 w-7 shrink-0 text-forest" />
          <div
            role="tablist"
            aria-label={t('dashboard.weekViewLabel')}
            className="flex gap-1 rounded-xl bg-slate-100 p-1"
          >
            {tabs.map((item) => (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={tab === item.key}
                onClick={() => chooseTab(item.key)}
                className={`rounded-lg px-3 py-1.5 text-lg font-semibold ${
                  tab === item.key
                    ? 'bg-card text-ink shadow-soft'
                    : 'text-slate-500 hover:text-ink'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={t('dashboard.previousWeek')}
            onClick={() => setWeekStart(addDays(weekStart, -7))}
            className="rounded-full p-2 text-slate-600 hover:bg-slate-100"
          >
            <Icon name="chevronLeft" className="h-5 w-5" />
          </button>
          <span className="min-w-36 text-center font-semibold text-ink">
            {range}
          </span>
          <button
            type="button"
            aria-label={t('dashboard.nextWeek')}
            onClick={() => setWeekStart(addDays(weekStart, 7))}
            className="rounded-full p-2 text-slate-600 hover:bg-slate-100"
          >
            <Icon name="chevronRight" className="h-5 w-5" />
          </button>
        </div>
        <Link
          to={tab === 'rota' ? '/feeding-rota' : '/calendar'}
          className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90"
        >
          {tab === 'rota' ? t('dashboard.seeRota') : t('dashboard.seeCalendar')}
        </Link>
      </div>

      {tab === 'rota' ? (
        <RotaWeek
          shiftTypes={shiftTypes}
          days={days}
          today={today}
          locale={locale}
        />
      ) : (
        <CalendarWeek days={days} today={today} locale={locale} />
      )}
    </div>
  )
}

function dayLabel(
  dateIso: string,
  locale: string,
  options: Intl.DateTimeFormatOptions,
) {
  return new Date(`${dateIso}T12:00:00Z`).toLocaleDateString(locale, {
    ...options,
    timeZone: 'UTC',
  })
}

function DayHeaders({
  days,
  today,
  locale,
  leading,
}: {
  days: string[]
  today: string
  locale: string
  leading: boolean
}) {
  return (
    <tr>
      {leading && <th className="w-28" />}
      {days.map((day) => (
        <th
          key={day}
          scope="col"
          className={`rounded-xl px-1 py-2 text-xs font-normal text-slate-500 ${
            day === today ? 'bg-blush' : 'bg-slate-50'
          }`}
        >
          <span className="block text-sm font-semibold text-ink first-letter:uppercase">
            {dayLabel(day, locale, { weekday: 'short' }).replace('.', '')}
          </span>
          {dayLabel(day, locale, { day: 'numeric', month: 'short' })}
        </th>
      ))}
    </tr>
  )
}

// The published feeding rota: a row per shift in the stable routine.
function RotaWeek({
  shiftTypes,
  days,
  today,
  locale,
}: {
  shiftTypes: ShiftType[]
  days: string[]
  today: string
  locale: string
}) {
  const { t } = usePreferences()
  const [shifts, setShifts] = useState<FeedingShift[] | null>(null)
  const from = days[0]
  const to = days[6]

  useEffect(() => {
    let cancelled = false
    setShifts(null)
    listShiftsInRange(from, to)
      .then((list) => {
        if (!cancelled)
          setShifts(list.filter((shift) => shift.status === 'published'))
      })
      .catch(() => {
        if (!cancelled) setShifts([])
      })
    return () => {
      cancelled = true
    }
  }, [from, to])

  if (shiftTypes.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        {t('dashboard.rotaNoShiftTypes')}
      </p>
    )
  }

  const shiftAt = (dateIso: string, typeId: string) =>
    shifts?.find(
      (shift) => shift.date === dateIso && shift.shift_type_id === typeId,
    )

  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-[640px] table-fixed border-separate border-spacing-1 text-center">
        <thead>
          <DayHeaders days={days} today={today} locale={locale} leading />
        </thead>
        <tbody>
          {shiftTypes.map((type) => (
            <tr key={type.id}>
              <th
                scope="row"
                className="px-1 text-left text-sm font-semibold text-ink"
              >
                <Icon
                  name={shiftIcon(type.time_of_day)}
                  className="mb-1 h-5 w-5 text-slate-500"
                />
                <span className="block leading-tight">{type.label}</span>
                <span className="text-xs font-normal text-slate-500">
                  {type.time_of_day.slice(0, 5)}
                </span>
              </th>
              {days.map((day) => {
                const shift = shiftAt(day, type.id)
                const name = shift?.assigned_owner?.full_name
                return (
                  <td
                    key={day}
                    className={`rounded-xl p-1 ${day === today ? 'bg-blush' : ''}`}
                  >
                    {shifts === null ? (
                      <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
                    ) : shift ? (
                      <div
                        className={`rounded-lg px-1 py-2 text-xs ${
                          name
                            ? day === today
                              ? 'bg-card text-ink'
                              : 'bg-forest/10 text-ink'
                            : 'border border-dashed border-rose/40 bg-card text-rose'
                        }`}
                      >
                        <span className="block truncate font-medium">
                          {name ? firstName(name) : t('dashboard.rotaOpen')}
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-300">–</span>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {shifts !== null && shifts.length === 0 && (
        <p className="mt-2 text-sm text-slate-500">
          {t('dashboard.rotaEmpty')}
        </p>
      )}
    </div>
  )
}

// The stable calendar: each day's events, in time order.
function CalendarWeek({
  days,
  today,
  locale,
}: {
  days: string[]
  today: string
  locale: string
}) {
  const { t } = usePreferences()
  const [events, setEvents] = useState<WeekEvent[] | null>(null)
  const from = days[0]
  const to = days[6]

  useEffect(() => {
    let cancelled = false
    setEvents(null)
    listEventsAround(from, to)
      .then((list) => {
        if (!cancelled) setEvents(list)
      })
      .catch(() => {
        if (!cancelled) setEvents([])
      })
    return () => {
      cancelled = true
    }
  }, [from, to])

  // Grouped by the day in Norwegian time, whatever time zone the browser is in.
  const osloDay = (iso: string) =>
    new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Europe/Oslo' })
  const osloTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('nb-NO', {
      timeZone: 'Europe/Oslo',
      hour: '2-digit',
      minute: '2-digit',
    })
  const inWeek = (events ?? []).filter((event) => {
    const day = osloDay(event.start_time)
    return day >= from && day <= to
  })

  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-[640px] table-fixed border-separate border-spacing-1">
        <thead>
          <DayHeaders
            days={days}
            today={today}
            locale={locale}
            leading={false}
          />
        </thead>
        <tbody>
          <tr>
            {days.map((day) => {
              const dayEvents = inWeek.filter(
                (event) => osloDay(event.start_time) === day,
              )
              return (
                <td
                  key={day}
                  className={`h-40 rounded-xl p-1 align-top ${day === today ? 'bg-blush' : ''}`}
                >
                  {events === null ? (
                    <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
                  ) : (
                    <ul className="space-y-1">
                      {dayEvents.map((event) => {
                        const type = event.event_type ?? 'other'
                        const typeLabel =
                          event.custom_type || t(`status.${type}`)
                        return (
                          <li key={event.id}>
                            <Link
                              to="/calendar"
                              title={[typeLabel, event.title, event.horse?.name]
                                .filter(Boolean)
                                .join(' · ')}
                              className={`block rounded-lg px-1.5 py-1 text-left text-xs ${getStatusColor(type)}`}
                            >
                              <span className="block font-semibold">
                                {osloTime(event.start_time)}
                              </span>
                              <span className="block truncate">
                                {event.title || typeLabel}
                              </span>
                              {event.horse?.name && (
                                <span className="block truncate opacity-80">
                                  {event.horse.name}
                                </span>
                              )}
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </td>
              )
            })}
          </tr>
        </tbody>
      </table>
      {events !== null && inWeek.length === 0 && (
        <p className="mt-2 text-sm text-slate-500">
          {t('dashboard.calendarEmpty')}
        </p>
      )}
    </div>
  )
}

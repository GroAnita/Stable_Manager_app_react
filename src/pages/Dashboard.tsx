import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnnouncementBoard } from '../components/AnnouncementBoard'
import { Badge } from '../components/Badge'
import { Card } from '../components/Card'
import { EmptyState } from '../components/EmptyState'
import { Icon, type IconName } from '../components/Icon'
import {
  getDashboardStats,
  listPaymentsNeedingAttention,
  listRecentActivity,
  listTodayTasks,
  listUpcomingVisits,
  type DashboardStats,
  type OverduePayment,
  type RecentActivityItem,
  type TodayTask,
  type UpcomingPayment,
  type UpcomingVisit,
} from '../features/dashboard/api'
import { usePreferences } from '../lib/PreferencesContext'

type DashboardData = {
  stats: DashboardStats
  todayTasks: TodayTask[]
  payments: (UpcomingPayment | OverduePayment)[]
  visits: UpcomingVisit[]
  activity: RecentActivityItem[]
}

export default function Dashboard() {
  const { t, formatCurrency, formatDate } = usePreferences()
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      getDashboardStats(),
      listTodayTasks(),
      listPaymentsNeedingAttention(),
      listUpcomingVisits(),
      listRecentActivity(),
    ])
      .then(([stats, todayTasks, payments, visits, activity]) => {
        if (cancelled) return
        setData({ stats, todayTasks, payments, visits, activity })
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (error) return <p role="alert">{t('dashboard.failedToLoad', { error })}</p>
  if (!data)
    return <p className="text-sm text-slate-500">{t('dashboard.loading')}</p>

  const { stats, todayTasks, payments, visits, activity } = data

  const statCards: {
    label: string
    value: number
    icon: IconName | 'horse'
  }[] = [
    {
      label: t('dashboard.totalHorses'),
      value: stats.total_horses ?? 0,
      icon: 'horse',
    },
    {
      label: t('dashboard.occupiedStalls'),
      value: stats.occupied_stalls ?? 0,
      icon: 'grid',
    },
    {
      label: t('dashboard.availableStalls'),
      value: stats.available_stalls ?? 0,
      icon: 'home',
    },
    {
      label: t('dashboard.paymentsDue7'),
      value: stats.upcoming_payments ?? 0,
      icon: 'dollar',
    },
    {
      label: t('dashboard.overduePayments'),
      value: stats.overdue_payments ?? 0,
      icon: 'alert',
    },
    {
      label: t('dashboard.tasksToday'),
      value: stats.today_tasks ?? 0,
      icon: 'checkSquare',
    },
    {
      label: t('dashboard.upcomingVetVisits'),
      value: stats.upcoming_vet_visits ?? 0,
      icon: 'calendar',
    },
    {
      label: t('dashboard.upcomingFarrierVisits'),
      value: stats.upcoming_farrier_visits ?? 0,
      icon: 'horse',
    },
  ]

  return (
    <div className="page-shell">
      <section className="page-header">
        <div>
          <p className="text-sm tracking-[0.25em] text-slate-400 uppercase">
            {t('nav.overview')}
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">
            {t('dashboard.title')}
          </h1>
        </div>
      </section>

      <AnnouncementBoard canManage />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => (
          <Card
            key={card.label}
            label={card.label}
            value={card.value}
            icon={<Icon name={card.icon} className="h-5 w-5" />}
          />
        ))}
      </section>

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
            <h2 className="section-title">
              {t('dashboard.paymentsNeedingAttention')}
            </h2>
          </div>
          {payments.length === 0 ? (
            <p className="text-sm text-slate-500">
              {t('dashboard.nothingDueOrOverdue')}
            </p>
          ) : (
            <div className="space-y-3">
              {payments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-start justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-slate-800">
                      {payment.horse_name}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {formatCurrency(payment.amount ?? 0)} ·{' '}
                      {t('dashboard.due')} {formatDate(payment.due_date)}
                    </p>
                  </div>
                  {payment.status && <Badge status={payment.status} />}
                </div>
              ))}
            </div>
          )}
          <Link
            to="/payments"
            className="mt-4 inline-block text-sm font-medium text-forest hover:underline"
          >
            {t('dashboard.viewAllPayments')}
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

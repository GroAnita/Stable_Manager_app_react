import { useEffect, useState } from 'react'
import { Badge } from '../components/Badge'
import { EmptyState } from '../components/EmptyState'
import {
  getHorseFeedingPlan,
  getHorseFeedingTimes,
  getHorseMedicalRecords,
  listMyHorses,
  type FeedingPlan,
  type FeedingTime,
  type HorseDetail,
  type MedicalRecord,
} from '../features/horses/api'
import { usePreferences } from '../lib/PreferencesContext'
import { OverviewTab } from './horseDetail/OverviewTab'

type HorseBundle = {
  horse: HorseDetail
  medical: MedicalRecord[]
  feedingPlan: FeedingPlan | null
  feedingTimes: FeedingTime[]
}

export default function MyHorse() {
  const { t, formatDate } = usePreferences()
  const [bundles, setBundles] = useState<HorseBundle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    listMyHorses()
      .then(async (horses) => {
        const data = await Promise.all(
          horses.map(async (horse) => {
            const [medical, feedingPlan, feedingTimes] = await Promise.all([
              getHorseMedicalRecords(horse.id),
              getHorseFeedingPlan(horse.id),
              getHorseFeedingTimes(horse.id),
            ])
            return { horse, medical, feedingPlan, feedingTimes }
          }),
        )
        if (!cancelled) setBundles(data)
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="page-shell">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">
          {t('myHorse.title')}
        </h1>
        <p className="mt-2 text-sm text-slate-500">{t('myHorse.subtitle')}</p>
      </div>

      {loading && (
        <p className="text-sm text-slate-500">{t('myHorse.loading')}</p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {t('myHorse.failedToLoad', { error })}
        </p>
      )}
      {!loading && !error && bundles.length === 0 && (
        <EmptyState
          title={t('myHorse.noHorsesTitle')}
          message={t('myHorse.noHorsesMessage')}
        />
      )}

      {bundles.map(({ horse, medical, feedingPlan, feedingTimes }) => (
        <div key={horse.id} className="panel space-y-6 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-semibold text-slate-900">
              {horse.name}
            </h2>
            <Badge status={horse.status} />
          </div>

          <OverviewTab horse={horse} />

          <div>
            <h3 className="section-title">{t('myHorse.medicalRecords')}</h3>
            {medical.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">
                {t('horseDetail.noMedicalRecords')}
              </p>
            ) : (
              <div className="mt-3 space-y-3">
                {medical.map((record) => (
                  <div
                    key={record.id}
                    className="rounded-2xl bg-slate-50 p-4 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-slate-900">
                        {record.type ? t(`status.${record.type}`) : '—'}
                      </span>
                      <span className="text-slate-500">
                        {formatDate(record.date)}
                      </span>
                    </div>
                    {record.next_due && (
                      <p className="mt-1 text-slate-500">
                        {t('horseDetail.nextDue')}: {formatDate(record.next_due)}
                      </p>
                    )}
                    {record.veterinarian && (
                      <p className="mt-1 text-slate-500">
                        {t('horseDetail.veterinarian')}: {record.veterinarian}
                      </p>
                    )}
                    {record.description && (
                      <p className="mt-1 text-slate-600">
                        {record.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="section-title">{t('myHorse.feedingPlan')}</h3>
            {feedingTimes.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">
                {t('horseDetail.noFeedingTimes')}
              </p>
            ) : (
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                {feedingTimes.map((entry) => (
                  <div key={entry.id} className="rounded-2xl bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-slate-900">
                        {entry.label}
                      </p>
                      {entry.time_of_day && (
                        <span className="text-sm text-slate-500">
                          {entry.time_of_day.slice(0, 5)}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-slate-600">
                      {t('horseDetail.hay')}: {entry.hay || '—'}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {t('horseDetail.grain')}: {entry.feed || '—'}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {t('horseDetail.supplements')}: {entry.supplements || '—'}
                    </p>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-3 text-sm text-slate-500">
              {feedingPlan?.special_instructions ||
                t('horseDetail.noSpecialFeeding')}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

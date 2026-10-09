import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { HorseAvatar } from '../components/HorseAvatar'
import { Icon } from '../components/Icon'
import {
  deleteHorse,
  getHorse,
  getHorseFeedingPlan,
  getHorseFeedingTimes,
  getHorseMedicalRecords,
  getHorseSchedule,
  getHorseVaccinations,
  type FeedingPlan,
  type FeedingTime,
  type HorseDetail as HorseDetailData,
  type HorseEvent,
  type MedicalRecord,
  type Vaccination,
} from '../features/horses/api'
import { usePreferences } from '../lib/PreferencesContext'
import { DocumentsTab } from './horseDetail/DocumentsTab'
import { FeedingTab } from './horseDetail/FeedingTab'
import { MedicalTab } from './horseDetail/MedicalTab'
import { NotesTab } from './horseDetail/NotesTab'
import { OverviewTab } from './horseDetail/OverviewTab'
import { ScheduleTab } from './horseDetail/ScheduleTab'

type Tab =
  'overview' | 'medical' | 'feeding' | 'documents' | 'schedule' | 'notes'

const TABS: { key: Tab; labelKey: string }[] = [
  { key: 'overview', labelKey: 'horseDetail.tabOverview' },
  { key: 'medical', labelKey: 'horseDetail.tabMedical' },
  { key: 'feeding', labelKey: 'horseDetail.tabFeeding' },
  { key: 'documents', labelKey: 'horseDetail.tabDocuments' },
  { key: 'schedule', labelKey: 'horseDetail.tabSchedule' },
  { key: 'notes', labelKey: 'horseDetail.tabNotes' },
]

export default function HorseDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = usePreferences()
  const [horse, setHorse] = useState<HorseDetailData | null>(null)
  const [medicalRecords, setMedicalRecords] = useState<MedicalRecord[]>([])
  const [vaccinations, setVaccinations] = useState<Vaccination[]>([])
  const [feedingPlan, setFeedingPlan] = useState<FeedingPlan | null>(null)
  const [feedingTimes, setFeedingTimes] = useState<FeedingTime[]>([])
  const [schedule, setSchedule] = useState<HorseEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('overview')

  useEffect(() => {
    if (!id) return
    let cancelled = false
    Promise.all([
      getHorse(id),
      getHorseMedicalRecords(id),
      getHorseVaccinations(id),
      getHorseFeedingPlan(id),
      getHorseFeedingTimes(id),
      getHorseSchedule(id),
    ])
      .then(([horseData, medical, vaccinationRecords, feeding, times, events]) => {
        if (cancelled) return
        setHorse(horseData)
        setMedicalRecords(medical)
        setVaccinations(vaccinationRecords)
        setFeedingPlan(feeding)
        setFeedingTimes(times)
        setSchedule(events)
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
  }, [id])

  async function handleDelete() {
    if (!id || !window.confirm(t('horseDetail.confirmDelete'))) return
    await deleteHorse(id)
    navigate('/horses')
  }

  if (loading)
    return <p className="text-sm text-ink/60">{t('horseDetail.loading')}</p>
  if (error)
    return (
      <p role="alert" className="text-sm text-red-600">
        {t('horseDetail.failedToLoad', { error })}
      </p>
    )
  if (!horse)
    return <p className="text-sm text-ink/60">{t('horseDetail.notFound')}</p>

  return (
    <div className="page-shell">
      <div className="page-header">
        <div className="flex items-center gap-4">
          <HorseAvatar
            name={horse.name}
            photoUrl={horse.photo_url}
            className="h-20 w-20 text-3xl"
          />
          <div>
            <p className="text-sm tracking-[0.25em] text-slate-400 uppercase">
              {t('horseDetail.profile')}
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">
              {horse.name}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              {[horse.breed, horse.gender, horse.color]
                .filter(Boolean)
                .join(' · ') || '—'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link to={`/horses/${horse.id}/edit`} className="btn-ghost">
            <Icon name="edit" className="h-4 w-4" />
            {t('horseDetail.edit')}
          </Link>
          <button
            type="button"
            onClick={handleDelete}
            className="btn-secondary"
          >
            <Icon name="trash" className="h-4 w-4" />
            {t('horseDetail.deleteHorse')}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`rounded-xl px-4 py-2 text-sm font-medium ${
              tab === item.key
                ? 'bg-forest text-white'
                : 'bg-white text-slate-600'
            }`}
          >
            {t(item.labelKey)}
          </button>
        ))}
      </div>

      <div className="panel p-6">
        {tab === 'overview' && <OverviewTab horse={horse} />}
        {tab === 'medical' && (
          <MedicalTab
            horseId={horse.id}
            stableId={horse.stable_id}
            records={medicalRecords}
            onChange={setMedicalRecords}
            vaccinations={vaccinations}
            onVaccinationsChange={setVaccinations}
          />
        )}
        {tab === 'feeding' && (
          <FeedingTab
            horseId={horse.id}
            stableId={horse.stable_id}
            plan={feedingPlan}
            feedingTimes={feedingTimes}
            onPlanSaved={setFeedingPlan}
            onTimesChanged={setFeedingTimes}
          />
        )}
        {tab === 'documents' && (
          <DocumentsTab horseId={horse.id} stableId={horse.stable_id} />
        )}
        {tab === 'schedule' && (
          <ScheduleTab
            horseId={horse.id}
            stableId={horse.stable_id}
            events={schedule}
            onChange={setSchedule}
          />
        )}
        {tab === 'notes' && (
          <NotesTab
            horseId={horse.id}
            notes={horse.notes}
            onSaved={(notes) =>
              setHorse((prev) => (prev ? { ...prev, notes } : prev))
            }
          />
        )}
      </div>
    </div>
  )
}

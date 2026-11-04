import { useEffect, useState, type FormEvent } from 'react'
import { Badge } from '../components/Badge'
import { EmptyState } from '../components/EmptyState'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import { Toggle } from '../components/Toggle'
import {
  getHorseFeedingPlan,
  getHorseFeedingTimes,
  getHorseMedicalRecords,
  getHorseSchedule,
  getHorseVaccinations,
  listMyHorses,
  updateHorse,
  type FeedingPlan,
  type FeedingTime,
  type HorseDetail,
  type HorseEvent,
  type MedicalRecord,
  type Vaccination,
} from '../features/horses/api'
import {
  listStallOptions,
  listTurnoutShelterOptions,
  type StallOption,
  type TurnoutShelterOption,
} from '../lib/options'
import { usePreferences } from '../lib/PreferencesContext'
import { FeedingTab } from './horseDetail/FeedingTab'
import { OverviewTab } from './horseDetail/OverviewTab'
import { ScheduleTab } from './horseDetail/ScheduleTab'
import { VaccinationSection } from './horseDetail/VaccinationSection'

type HorseBundle = {
  horse: HorseDetail
  medical: MedicalRecord[]
  vaccinations: Vaccination[]
  feedingPlan: FeedingPlan | null
  feedingTimes: FeedingTime[]
  schedule: HorseEvent[]
}

// Everything staff can edit on a horse, except handing off ownership
// (owner, name), the paddock assignment, and granting additional-owner
// access — those stay staff-only and aren't part of this form at all.
// Enforced server-side too, via protect_horse_fields().
type EditFormState = {
  breed: string
  birthday: string
  gender: string
  color: string
  passport_number: string
  microchip_number: string
  insurance_company: string
  insurance_number: string
  allergies: string
  feeding_notes: string
  medical_notes: string
  notes: string
  arrival_date: string
  stall_id: string
  turnout_shelter_id: string
  active: boolean
  away: boolean
}

const emptyEditForm: EditFormState = {
  breed: '',
  birthday: '',
  gender: '',
  color: '',
  passport_number: '',
  microchip_number: '',
  insurance_company: '',
  insurance_number: '',
  allergies: '',
  feeding_notes: '',
  medical_notes: '',
  notes: '',
  arrival_date: '',
  stall_id: '',
  turnout_shelter_id: '',
  active: true,
  away: false,
}

function toEditForm(horse: HorseDetail): EditFormState {
  return {
    breed: horse.breed ?? '',
    birthday: horse.birthday ?? '',
    gender: horse.gender ?? '',
    color: horse.color ?? '',
    passport_number: horse.passport_number ?? '',
    microchip_number: horse.microchip_number ?? '',
    insurance_company: horse.insurance_company ?? '',
    insurance_number: horse.insurance_number ?? '',
    allergies: horse.allergies ?? '',
    feeding_notes: horse.feeding_notes ?? '',
    medical_notes: horse.medical_notes ?? '',
    notes: horse.notes ?? '',
    arrival_date: horse.arrival_date ?? '',
    stall_id: horse.stall_id ?? '',
    turnout_shelter_id: horse.turnout_shelter_id ?? '',
    active: horse.active,
    away: horse.away,
  }
}

export default function MyHorse() {
  const { t, formatDate } = usePreferences()
  const [bundles, setBundles] = useState<HorseBundle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [editingHorse, setEditingHorse] = useState<HorseDetail | null>(null)
  const [editForm, setEditForm] = useState<EditFormState>(emptyEditForm)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [stalls, setStalls] = useState<StallOption[]>([])
  const [turnoutShelters, setTurnoutShelters] = useState<
    TurnoutShelterOption[]
  >([])

  useEffect(() => {
    listStallOptions()
      .then(setStalls)
      .catch(() => setStalls([]))
    listTurnoutShelterOptions()
      .then(setTurnoutShelters)
      .catch(() => setTurnoutShelters([]))
  }, [])

  useEffect(() => {
    let cancelled = false
    listMyHorses()
      .then(async (horses) => {
        const data = await Promise.all(
          horses.map(async (horse) => {
            const [medical, vaccinations, feedingPlan, feedingTimes, schedule] =
              await Promise.all([
                getHorseMedicalRecords(horse.id),
                getHorseVaccinations(horse.id),
                getHorseFeedingPlan(horse.id),
                getHorseFeedingTimes(horse.id),
                getHorseSchedule(horse.id),
              ])
            return {
              horse,
              medical,
              vaccinations,
              feedingPlan,
              feedingTimes,
              schedule,
            }
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

  function handleFeedingPlanSaved(horseId: string, plan: FeedingPlan) {
    setBundles((prev) =>
      prev.map((bundle) =>
        bundle.horse.id === horseId ? { ...bundle, feedingPlan: plan } : bundle,
      ),
    )
  }

  function handleFeedingTimesChanged(horseId: string, times: FeedingTime[]) {
    setBundles((prev) =>
      prev.map((bundle) =>
        bundle.horse.id === horseId
          ? { ...bundle, feedingTimes: times }
          : bundle,
      ),
    )
  }

  function handleVaccinationsChanged(
    horseId: string,
    vaccinations: Vaccination[],
  ) {
    setBundles((prev) =>
      prev.map((bundle) =>
        bundle.horse.id === horseId ? { ...bundle, vaccinations } : bundle,
      ),
    )
  }

  function handleScheduleChanged(horseId: string, schedule: HorseEvent[]) {
    setBundles((prev) =>
      prev.map((bundle) =>
        bundle.horse.id === horseId ? { ...bundle, schedule } : bundle,
      ),
    )
  }

  function openEdit(horse: HorseDetail) {
    setEditingHorse(horse)
    setEditForm(toEditForm(horse))
    setEditError(null)
  }

  function updateEditField<K extends keyof EditFormState>(
    key: K,
    value: EditFormState[K],
  ) {
    setEditForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleEditSubmit(event: FormEvent) {
    event.preventDefault()
    if (!editingHorse) return
    setEditSaving(true)
    setEditError(null)
    try {
      const updated = await updateHorse(editingHorse.id, {
        breed: editForm.breed || null,
        birthday: editForm.birthday || null,
        gender: editForm.gender || null,
        color: editForm.color || null,
        passport_number: editForm.passport_number || null,
        microchip_number: editForm.microchip_number || null,
        insurance_company: editForm.insurance_company || null,
        insurance_number: editForm.insurance_number || null,
        allergies: editForm.allergies || null,
        feeding_notes: editForm.feeding_notes || null,
        medical_notes: editForm.medical_notes || null,
        notes: editForm.notes || null,
        arrival_date: editForm.arrival_date || null,
        stall_id: editForm.stall_id || null,
        turnout_shelter_id: editForm.turnout_shelter_id || null,
        active: editForm.active,
        away: editForm.away,
      })
      setBundles((prev) =>
        prev.map((bundle) =>
          bundle.horse.id === updated.id
            ? { ...bundle, horse: { ...bundle.horse, ...updated } }
            : bundle,
        ),
      )
      setEditingHorse(null)
    } catch (err) {
      setEditError((err as Error).message)
    } finally {
      setEditSaving(false)
    }
  }

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

      {bundles.map(
        ({
          horse,
          medical,
          vaccinations,
          feedingPlan,
          feedingTimes,
          schedule,
        }) => (
          <div key={horse.id} className="panel space-y-6 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-2xl font-semibold text-slate-900">
                {horse.name}
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <Badge status={horse.status} />
                {horse.away && <Badge status="away" />}
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => openEdit(horse)}
                >
                  <Icon name="edit" className="h-4 w-4" />
                  {t('myHorse.editHorse')}
                </button>
              </div>
            </div>

            <OverviewTab
              horse={horse}
              vaccinations={vaccinations}
              lessonBookingDates={null}
            />

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
                          {t('horseDetail.nextDue')}:{' '}
                          {formatDate(record.next_due)}
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

            <VaccinationSection
              horseId={horse.id}
              stableId={horse.stable_id}
              vaccinations={vaccinations}
              onChange={(next) => handleVaccinationsChanged(horse.id, next)}
            />

            <FeedingTab
              horseId={horse.id}
              stableId={horse.stable_id}
              plan={feedingPlan}
              feedingTimes={feedingTimes}
              onPlanSaved={(plan) => handleFeedingPlanSaved(horse.id, plan)}
              onTimesChanged={(times) =>
                handleFeedingTimesChanged(horse.id, times)
              }
              showExtras={false}
            />

            <div>
              <h3 className="section-title">{t('horseDetail.tabSchedule')}</h3>
              <div className="mt-3">
                <ScheduleTab
                  horseId={horse.id}
                  stableId={horse.stable_id}
                  events={schedule}
                  onChange={(events) => handleScheduleChanged(horse.id, events)}
                />
              </div>
            </div>
          </div>
        ),
      )}

      <Modal
        open={editingHorse !== null}
        onClose={() => setEditingHorse(null)}
        title={t('myHorse.editHorse')}
        size="lg"
      >
        <form onSubmit={handleEditSubmit} className="grid gap-4 sm:grid-cols-2">
          {editError && (
            <p role="alert" className="text-sm text-red-600 sm:col-span-2">
              {editError}
            </p>
          )}
          <label>
            <span className="field-label">{t('horseForm.breed')}</span>
            <input
              className="field"
              value={editForm.breed}
              onChange={(e) => updateEditField('breed', e.target.value)}
            />
          </label>
          <label>
            <span className="field-label">{t('horseForm.birthday')}</span>
            <input
              type="date"
              className="field"
              value={editForm.birthday}
              onChange={(e) => updateEditField('birthday', e.target.value)}
            />
          </label>
          <label>
            <span className="field-label">{t('horseForm.gender')}</span>
            <select
              className="field"
              value={editForm.gender}
              onChange={(e) => updateEditField('gender', e.target.value)}
            >
              <option value="">—</option>
              <option value="mare">{t('horseForm.genderMare')}</option>
              <option value="gelding">{t('horseForm.genderGelding')}</option>
              <option value="stallion">{t('horseForm.genderStallion')}</option>
            </select>
          </label>
          <label>
            <span className="field-label">{t('horseForm.color')}</span>
            <select
              className="field"
              value={editForm.color}
              onChange={(e) => updateEditField('color', e.target.value)}
            >
              <option value="">—</option>
              <option value="bay">{t('horseForm.colorBay')}</option>
              <option value="black">{t('horseForm.colorBlack')}</option>
              <option value="brown">{t('horseForm.colorBrown')}</option>
              <option value="chestnut">{t('horseForm.colorChestnut')}</option>
              <option value="grey">{t('horseForm.colorGrey')}</option>
              <option value="palomino">{t('horseForm.colorPalomino')}</option>
              <option value="buckskin">{t('horseForm.colorBuckskin')}</option>
              <option value="dun">{t('horseForm.colorDun')}</option>
              <option value="roan">{t('horseForm.colorRoan')}</option>
              <option value="pinto">{t('horseForm.colorPinto')}</option>
              <option value="appaloosa">{t('horseForm.colorAppaloosa')}</option>
              <option value="cremello">{t('horseForm.colorCremello')}</option>
              <option value="white">{t('horseForm.colorWhite')}</option>
            </select>
          </label>
          <label>
            <span className="field-label">{t('horseForm.passportNumber')}</span>
            <input
              className="field"
              value={editForm.passport_number}
              onChange={(e) =>
                updateEditField('passport_number', e.target.value)
              }
            />
          </label>
          <label>
            <span className="field-label">
              {t('horseForm.microchipNumber')}
            </span>
            <input
              className="field"
              value={editForm.microchip_number}
              onChange={(e) =>
                updateEditField('microchip_number', e.target.value)
              }
            />
          </label>
          <label>
            <span className="field-label">
              {t('horseForm.insuranceCompany')}
            </span>
            <input
              className="field"
              value={editForm.insurance_company}
              onChange={(e) =>
                updateEditField('insurance_company', e.target.value)
              }
            />
          </label>
          <label>
            <span className="field-label">
              {t('horseForm.insuranceNumber')}
            </span>
            <input
              className="field"
              value={editForm.insurance_number}
              onChange={(e) =>
                updateEditField('insurance_number', e.target.value)
              }
            />
          </label>
          <label>
            <span className="field-label">{t('horseForm.stall')}</span>
            <select
              className="field"
              value={editForm.stall_id}
              onChange={(e) => updateEditField('stall_id', e.target.value)}
            >
              <option value="">—</option>
              {stalls.map((stall) => {
                const occupiedByOther =
                  stall.occupant && stall.occupant.id !== editingHorse?.id
                return (
                  <option key={stall.id} value={stall.id}>
                    {stall.stall_number} —{' '}
                    {occupiedByOther
                      ? t('horseForm.stallOccupied', {
                          name: stall.occupant!.name,
                        })
                      : t('status.available')}
                  </option>
                )
              })}
            </select>
          </label>
          <label>
            <span className="field-label">{t('horseForm.turnoutShelter')}</span>
            <select
              className="field"
              value={editForm.turnout_shelter_id}
              onChange={(e) =>
                updateEditField('turnout_shelter_id', e.target.value)
              }
            >
              <option value="">—</option>
              {turnoutShelters.map((shelter) => (
                <option key={shelter.id} value={shelter.id}>
                  {shelter.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="field-label">{t('horseForm.arrivalDate')}</span>
            <input
              type="date"
              className="field"
              value={editForm.arrival_date}
              onChange={(e) => updateEditField('arrival_date', e.target.value)}
            />
          </label>
          <label className="sm:col-span-2">
            <span className="field-label">{t('horseForm.allergies')}</span>
            <textarea
              className="field"
              value={editForm.allergies}
              onChange={(e) => updateEditField('allergies', e.target.value)}
            />
          </label>
          <label className="sm:col-span-2">
            <span className="field-label">{t('horseForm.feedingNotes')}</span>
            <textarea
              className="field"
              value={editForm.feeding_notes}
              onChange={(e) => updateEditField('feeding_notes', e.target.value)}
            />
          </label>
          <label className="sm:col-span-2">
            <span className="field-label">{t('horseForm.medicalNotes')}</span>
            <textarea
              className="field"
              value={editForm.medical_notes}
              onChange={(e) => updateEditField('medical_notes', e.target.value)}
            />
          </label>
          <label className="sm:col-span-2">
            <span className="field-label">{t('horseForm.generalNotes')}</span>
            <textarea
              className="field"
              value={editForm.notes}
              onChange={(e) => updateEditField('notes', e.target.value)}
            />
          </label>
          <Toggle
            checked={editForm.active}
            onChange={(checked) => updateEditField('active', checked)}
            label={t('horseForm.active')}
          />
          <Toggle
            checked={editForm.away}
            onChange={(checked) => updateEditField('away', checked)}
            label={t('horseForm.away')}
          />
          <div className="sm:col-span-2">
            <button type="submit" disabled={editSaving} className="btn-primary">
              {editSaving ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

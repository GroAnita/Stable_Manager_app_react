import { Badge } from '../../components/Badge'
import type { HorseDetail } from '../../features/horses/api'
import { usePreferences } from '../../lib/PreferencesContext'

export function OverviewTab({ horse }: { horse: HorseDetail }) {
  const { t, formatDate } = usePreferences()
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-slate-400">{t('horseDetail.age')}</p>
            <p className="font-medium text-slate-800">
              {horse.age != null
                ? `${horse.age} ${t('horseDetail.years')}`
                : '—'}
            </p>
          </div>
          <div>
            <p className="text-slate-400">{t('horseDetail.birthday')}</p>
            <p className="font-medium text-slate-800">
              {formatDate(horse.birthday)}
            </p>
          </div>
          <div>
            <p className="text-slate-400">{t('horseDetail.passport')}</p>
            <p className="font-medium text-slate-800">
              {horse.passport_number ?? '—'}
            </p>
          </div>
          <div>
            <p className="text-slate-400">{t('horseDetail.microchip')}</p>
            <p className="font-medium text-slate-800">
              {horse.microchip_number ?? '—'}
            </p>
          </div>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-sm text-slate-400">{t('horseDetail.owner')}</p>
          <p className="mt-1 font-medium text-slate-900">
            {horse.owner?.full_name ?? '—'}
          </p>
          <p className="text-sm text-slate-500">{horse.owner?.phone ?? ''}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-sm text-slate-400">
            {t('horseDetail.stallAssignment')}
          </p>
          <p className="mt-1 font-medium text-slate-900">
            {t('horseList.stall')} {horse.stall?.stall_number ?? '—'} ·{' '}
            {horse.stall?.size ?? '—'}
          </p>
          <p className="text-sm text-slate-500">
            {horse.stall?.notes || t('horseDetail.noStallNotes')}
          </p>
        </div>
      </div>
      <div className="space-y-4">
        <div>
          <p className="text-sm text-slate-400">
            {t('horseDetail.vaccinationStatus')}
          </p>
          <div className="mt-2">
            {horse.vaccination_status ? (
              <Badge status={horse.vaccination_status} />
            ) : (
              <p className="text-slate-700">—</p>
            )}
          </div>
        </div>
        <div>
          <p className="text-sm text-slate-400">{t('horseDetail.insurance')}</p>
          <p className="mt-1 text-slate-700">
            {horse.insurance_company
              ? `${horse.insurance_company} (${horse.insurance_number ?? '—'})`
              : '—'}
          </p>
        </div>
        <div>
          <p className="text-sm text-slate-400">{t('horseDetail.allergies')}</p>
          <p className="mt-1 text-slate-700">
            {horse.allergies || t('horseDetail.noneNoted')}
          </p>
        </div>
        <div>
          <p className="text-sm text-slate-400">
            {t('horseDetail.medicalNotes')}
          </p>
          <p className="mt-1 text-slate-700">
            {horse.medical_notes || t('horseDetail.noMedicalNotes')}
          </p>
        </div>
      </div>
    </div>
  )
}

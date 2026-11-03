import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  createCoRider,
  getCoRider,
  updateCoRider,
  type CoRiderInsert,
} from '../features/co-riders/api'
import { usePreferences } from '../lib/PreferencesContext'
import { getCurrentStableId } from '../lib/stableContext'

type FormState = {
  full_name: string
  phone: string
  email: string
  notes: string
}

const emptyForm: FormState = {
  full_name: '',
  phone: '',
  email: '',
  notes: '',
}

export default function CoRiderForm() {
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { t } = usePreferences()

  const [form, setForm] = useState<FormState>(emptyForm)
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    getCoRider(id)
      .then((coRider) => {
        if (cancelled) return
        setForm({
          full_name: coRider.full_name,
          phone: coRider.phone ?? '',
          email: coRider.email ?? '',
          notes: coRider.notes ?? '',
        })
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const submitter = (event.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement | null
    const addAnother = submitter?.value === 'addAnother'
    setSaving(true)
    setError(null)
    setSuccessMessage(null)
    try {
      const payload = {
        full_name: form.full_name,
        phone: form.phone || null,
        email: form.email || null,
        notes: form.notes || null,
      }

      if (isEdit && id) {
        await updateCoRider(id, payload)
        navigate(`/co-riders/${id}`)
      } else {
        const stableId = await getCurrentStableId()
        if (!stableId) throw new Error(t('coRiderForm.noStableFound'))
        const insertPayload: CoRiderInsert = {
          ...payload,
          stable_id: stableId,
        }
        const created = await createCoRider(insertPayload)
        if (addAnother) {
          setForm(emptyForm)
          setSuccessMessage(
            t('coRiderForm.addedAnother', { name: created.full_name }),
          )
        } else {
          navigate(`/co-riders/${created.id}`)
        }
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (loading)
    return <p className="text-sm text-slate-500">{t('coRiderForm.loading')}</p>

  return (
    <div className="page-shell">
      <h1 className="text-3xl font-semibold text-slate-900">
        {isEdit ? t('coRiderForm.editCoRider') : t('coRiderForm.newCoRider')}
      </h1>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {successMessage && (
        <p className="text-sm text-forest">{successMessage}</p>
      )}
      <form
        onSubmit={handleSubmit}
        className="panel grid gap-4 p-5 sm:grid-cols-2"
      >
        <label>
          <span className="field-label">{t('coRiderForm.fullName')}</span>
          <input
            required
            className="field"
            value={form.full_name}
            onChange={(e) => updateField('full_name', e.target.value)}
          />
        </label>
        <label>
          <span className="field-label">{t('coRiderForm.phone')}</span>
          <input
            type="tel"
            className="field"
            value={form.phone}
            onChange={(e) => updateField('phone', e.target.value)}
          />
        </label>
        <label>
          <span className="field-label">{t('coRiderForm.email')}</span>
          <input
            type="email"
            className="field"
            value={form.email}
            onChange={(e) => updateField('email', e.target.value)}
          />
        </label>
        <label className="sm:col-span-2">
          <span className="field-label">{t('coRiderForm.notes')}</span>
          <textarea
            className="field"
            value={form.notes}
            onChange={(e) => updateField('notes', e.target.value)}
          />
        </label>

        <div className="flex flex-wrap gap-3 sm:col-span-2">
          <button
            type="submit"
            name="intent"
            value="save"
            disabled={saving}
            className="btn-primary"
          >
            {saving ? t('common.saving') : t('common.save')}
          </button>
          {!isEdit && (
            <button
              type="submit"
              name="intent"
              value="addAnother"
              disabled={saving}
              className="btn-ghost"
            >
              {t('common.saveAndAddAnother')}
            </button>
          )}
        </div>
      </form>
    </div>
  )
}

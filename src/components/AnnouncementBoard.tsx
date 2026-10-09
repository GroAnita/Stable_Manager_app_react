import { useEffect, useState, type FormEvent } from 'react'
import {
  createAnnouncement,
  deleteAnnouncement,
  listAnnouncements,
  type Announcement,
} from '../features/announcements/api'
import { usePreferences } from '../lib/PreferencesContext'
import { ConfirmDialog } from './ConfirmDialog'
import { Icon } from './Icon'

export function AnnouncementBoard({ canManage }: { canManage: boolean }) {
  const { t, formatDate } = usePreferences()
  const [announcements, setAnnouncements] = useState<Announcement[] | null>(
    null,
  )
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [posting, setPosting] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  function load() {
    listAnnouncements()
      .then(setAnnouncements)
      .catch((err: Error) => setError(err.message))
  }

  useEffect(load, [])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setPosting(true)
    setError(null)
    try {
      await createAnnouncement({ title, body })
      setTitle('')
      setBody('')
      setShowForm(false)
      load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setPosting(false)
    }
  }

  async function handleDelete() {
    if (!pendingDeleteId) return
    try {
      await deleteAnnouncement(pendingDeleteId)
      setPendingDeleteId(null)
      load()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="panel p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="section-title">{t('announcements.title')}</h2>
        {canManage && (
          <button
            type="button"
            className="btn-secondary shrink-0"
            onClick={() => setShowForm((prev) => !prev)}
          >
            {showForm ? t('common.cancel') : t('announcements.post')}
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="mb-3 text-sm text-red-600">
          {error}
        </p>
      )}

      {canManage && showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-4 flex flex-col gap-3 rounded-2xl bg-slate-50 p-4"
        >
          <label>
            <span className="field-label">{t('announcements.titleLabel')}</span>
            <input
              required
              className="field"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label>
            <span className="field-label">{t('announcements.bodyLabel')}</span>
            <textarea
              required
              className="field"
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </label>
          <div>
            <button
              type="submit"
              disabled={posting}
              className="btn-primary"
            >
              {posting ? t('common.saving') : t('announcements.publish')}
            </button>
          </div>
        </form>
      )}

      {announcements === null ? (
        <p className="text-sm text-slate-500">{t('common.loading')}</p>
      ) : announcements.length === 0 ? (
        <p className="text-sm text-slate-500">
          {t('announcements.noAnnouncements')}
        </p>
      ) : (
        <div className="space-y-3">
          {announcements.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl bg-slate-50 px-4 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium text-slate-800">{item.title}</p>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs whitespace-nowrap text-slate-400">
                    {formatDate(item.created_at)}
                  </span>
                  {canManage && (
                    <button
                      type="button"
                      aria-label={t('common.delete')}
                      className="text-slate-400 hover:text-red-600"
                      onClick={() => setPendingDeleteId(item.id)}
                    >
                      <Icon name="trash" className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              <p className="mt-1 text-sm whitespace-pre-wrap text-slate-600">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={pendingDeleteId !== null}
        title={t('announcements.deleteTitle')}
        message={t('announcements.deleteMessage')}
        onConfirm={handleDelete}
        onCancel={() => setPendingDeleteId(null)}
      />
    </div>
  )
}

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  countOf,
  createAnnouncement,
  deleteAnnouncement,
  listAnnouncements,
  listMyAcknowledgedAnnouncementIds,
  toggleAnnouncementAcknowledgment,
  type AnnouncementWithCounts,
} from '../features/announcements/api'
import { usePreferences } from '../lib/PreferencesContext'
import { AnnouncementDetail } from './AnnouncementDetail'
import { ConfirmDialog } from './ConfirmDialog'
import { EmojiPicker } from './EmojiPicker'
import { Icon } from './Icon'

type AnnouncementCategory = 'warning' | 'reminder' | 'info'

const CATEGORY_CARD_CLASSES: Record<AnnouncementCategory, string> = {
  warning: 'border-l-4 border-red-500 bg-red-50',
  reminder: 'border-l-4 border-amber-400 bg-amber-50',
  info: 'bg-slate-50',
}

const CATEGORY_BADGE_CLASSES: Record<AnnouncementCategory, string> = {
  warning: 'bg-red-100 text-red-700',
  reminder: 'bg-amber-100 text-amber-700',
  info: 'bg-emerald-100 text-emerald-700',
}

function categoryLabelKey(category: string): string {
  switch (category) {
    case 'warning':
      return 'announcements.categoryWarning'
    case 'reminder':
      return 'announcements.categoryReminder'
    default:
      return 'announcements.categoryInfo'
  }
}

function toCategory(value: string): AnnouncementCategory {
  return value === 'warning' || value === 'reminder' ? value : 'info'
}

export function AnnouncementBoard({
  canManage,
  limit,
}: {
  canManage: boolean
  limit?: number
}) {
  const { t, formatDate } = usePreferences()
  const [announcements, setAnnouncements] = useState<
    AnnouncementWithCounts[] | null
  >(null)
  const [ackedIds, setAckedIds] = useState<Set<string>>(new Set())
  const [viewingId, setViewingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [category, setCategory] = useState<AnnouncementCategory>('info')
  const [posting, setPosting] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  function insertEmojiIntoBody(emoji: string) {
    const el = bodyRef.current
    if (!el) {
      setBody((prev) => prev + emoji)
      return
    }
    const start = el.selectionStart ?? body.length
    const end = el.selectionEnd ?? body.length
    const next = body.slice(0, start) + emoji + body.slice(end)
    setBody(next)
    requestAnimationFrame(() => {
      el.focus()
      const pos = start + emoji.length
      el.setSelectionRange(pos, pos)
    })
  }

  function load() {
    Promise.all([listAnnouncements(), listMyAcknowledgedAnnouncementIds()])
      .then(([announcementsData, ackedData]) => {
        setAnnouncements(announcementsData)
        setAckedIds(new Set(ackedData))
      })
      .catch((err: Error) => setError(err.message))
  }

  useEffect(load, [])

  async function handleToggleAcknowledge(item: AnnouncementWithCounts) {
    const wasAcknowledged = ackedIds.has(item.id)
    try {
      await toggleAnnouncementAcknowledgment(
        item.id,
        item.stable_id,
        wasAcknowledged,
      )
      load()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const viewingAnnouncement =
    announcements?.find((item) => item.id === viewingId) ?? null

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setPosting(true)
    setError(null)
    try {
      await createAnnouncement({ title, body, category })
      setTitle('')
      setBody('')
      setCategory('info')
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
            <span className="field-label">
              {t('announcements.categoryLabel')}
            </span>
            <select
              className="field"
              value={category}
              onChange={(e) => setCategory(toCategory(e.target.value))}
            >
              <option value="info">{t('announcements.categoryInfo')}</option>
              <option value="reminder">
                {t('announcements.categoryReminder')}
              </option>
              <option value="warning">
                {t('announcements.categoryWarning')}
              </option>
            </select>
          </label>
          <label>
            <span className="field-label flex items-center gap-2">
              {t('announcements.bodyLabel')}
              <EmojiPicker onSelect={insertEmojiIntoBody} />
            </span>
            <textarea
              ref={bodyRef}
              required
              className="field"
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </label>
          <div>
            <button type="submit" disabled={posting} className="btn-primary">
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
          {(limit ? announcements.slice(0, limit) : announcements).map(
            (item) => {
              const itemCategory = toCategory(item.category)
              return (
                <div
                  key={item.id}
                  className={`rounded-2xl px-4 py-3 ${CATEGORY_CARD_CLASSES[itemCategory]}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <p className="font-medium text-slate-800">
                        {item.title}
                      </p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${CATEGORY_BADGE_CLASSES[itemCategory]}`}
                      >
                        {t(categoryLabelKey(itemCategory))}
                      </span>
                    </div>
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
                  <div className="mt-2 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleToggleAcknowledge(item)}
                      className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium ${
                        ackedIds.has(item.id)
                          ? 'text-forest'
                          : 'text-slate-500 hover:text-forest'
                      }`}
                    >
                      <Icon name="thumbsUp" className="h-3.5 w-3.5" />
                      {countOf(item.acknowledgments)}
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewingId(item.id)}
                      className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:text-forest"
                    >
                      <Icon name="messageCircle" className="h-3.5 w-3.5" />
                      {countOf(item.comments)}
                    </button>
                  </div>
                </div>
              )
            },
          )}
        </div>
      )}

      {limit != null && (announcements?.length ?? 0) > limit && (
        <Link
          to="/notice-board"
          className="btn-ghost mt-4 w-full justify-center"
        >
          {t('announcements.showMore')}
        </Link>
      )}

      <ConfirmDialog
        open={pendingDeleteId !== null}
        title={t('announcements.deleteTitle')}
        message={t('announcements.deleteMessage')}
        onConfirm={handleDelete}
        onCancel={() => setPendingDeleteId(null)}
      />

      <AnnouncementDetail
        announcement={viewingAnnouncement}
        acknowledged={viewingId !== null && ackedIds.has(viewingId)}
        canManage={canManage}
        onClose={() => setViewingId(null)}
        onToggleAcknowledge={() => {
          if (viewingAnnouncement) handleToggleAcknowledge(viewingAnnouncement)
        }}
        onCommentsChanged={load}
      />
    </div>
  )
}

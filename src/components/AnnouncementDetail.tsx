import { useEffect, useState, type FormEvent } from 'react'
import {
  createAnnouncementComment,
  deleteAnnouncementComment,
  listAnnouncementAcknowledgments,
  listAnnouncementComments,
  type AnnouncementAcknowledgment,
  type AnnouncementComment,
  type AnnouncementWithCounts,
} from '../features/announcements/api'
import { useAuth } from '../lib/AuthContext'
import { usePreferences } from '../lib/PreferencesContext'
import { Icon } from './Icon'
import { Modal } from './Modal'

export function AnnouncementDetail({
  announcement,
  acknowledged,
  canManage,
  onClose,
  onToggleAcknowledge,
  onCommentsChanged,
}: {
  announcement: AnnouncementWithCounts | null
  acknowledged: boolean
  canManage: boolean
  onClose: () => void
  onToggleAcknowledge: () => void
  onCommentsChanged: () => void
}) {
  const { t, formatDate } = usePreferences()
  const { profile } = useAuth()
  const [comments, setComments] = useState<AnnouncementComment[]>([])
  const [acks, setAcks] = useState<AnnouncementAcknowledgment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [body, setBody] = useState('')
  const [posting, setPosting] = useState(false)

  useEffect(() => {
    if (!announcement) return
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([
      listAnnouncementComments(announcement.id),
      listAnnouncementAcknowledgments(announcement.id),
    ])
      .then(([commentsData, acksData]) => {
        if (cancelled) return
        setComments(commentsData)
        setAcks(acksData)
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
  }, [announcement])

  async function handleSubmitComment(event: FormEvent) {
    event.preventDefault()
    if (!announcement || !body.trim()) return
    setPosting(true)
    setError(null)
    try {
      const created = await createAnnouncementComment(
        announcement.id,
        announcement.stable_id,
        body.trim(),
      )
      setComments((prev) => [...prev, created])
      setBody('')
      onCommentsChanged()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setPosting(false)
    }
  }

  async function handleDeleteComment(id: string) {
    try {
      await deleteAnnouncementComment(id)
      setComments((prev) => prev.filter((c) => c.id !== id))
      onCommentsChanged()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <Modal
      open={announcement !== null}
      onClose={onClose}
      title={announcement?.title ?? ''}
    >
      {announcement && (
        <div className="space-y-5">
          <p className="text-sm whitespace-pre-wrap text-slate-600">
            {announcement.body}
          </p>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-b border-slate-100 py-3">
            <button
              type="button"
              onClick={onToggleAcknowledge}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium ${
                acknowledged
                  ? 'bg-forest/10 text-forest'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Icon name="thumbsUp" className="h-4 w-4" />
              {acknowledged
                ? t('announcements.acknowledged')
                : t('announcements.acknowledge')}
            </button>
            {acks.length > 0 && (
              <p className="text-xs text-slate-400">
                {t('announcements.acknowledgedBy', {
                  names: acks
                    .map((a) => a.user?.full_name ?? t('common.notAvailable'))
                    .join(', '),
                })}
              </p>
            )}
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}

          <div>
            <h3 className="section-title">{t('announcements.comments')}</h3>
            {loading ? (
              <p className="mt-2 text-sm text-slate-500">
                {t('common.loading')}
              </p>
            ) : comments.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">
                {t('announcements.noComments')}
              </p>
            ) : (
              <div className="mt-3 space-y-3">
                {comments.map((comment) => (
                  <div key={comment.id} className="rounded-2xl bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-slate-800">
                        {comment.author?.full_name ?? t('common.notAvailable')}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">
                          {formatDate(comment.created_at)}
                        </span>
                        {(comment.author_id === profile?.id || canManage) && (
                          <button
                            type="button"
                            aria-label={t('common.delete')}
                            className="text-slate-400 hover:text-red-600"
                            onClick={() => handleDeleteComment(comment.id)}
                          >
                            <Icon name="trash" className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="mt-1 text-sm whitespace-pre-wrap text-slate-600">
                      {comment.body}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleSubmitComment} className="mt-3 flex gap-2">
              <input
                className="field"
                placeholder={t('announcements.commentPlaceholder')}
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
              <button
                type="submit"
                disabled={posting || !body.trim()}
                className="btn-primary shrink-0"
              >
                {posting
                  ? t('common.saving')
                  : t('announcements.commentSubmit')}
              </button>
            </form>
          </div>
        </div>
      )}
    </Modal>
  )
}

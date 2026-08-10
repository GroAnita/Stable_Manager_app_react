import { useEffect, useState, type FormEvent } from 'react'
import {
  deleteHorseDocument,
  listHorseDocuments,
  uploadHorseDocument,
  type DocumentType,
  type HorseDocument,
} from '../../features/documents/api'
import { usePreferences } from '../../lib/PreferencesContext'

const DOCUMENT_TYPES: DocumentType[] = [
  'passport',
  'insurance',
  'contract',
  'veterinary_report',
  'receipt',
  'photo',
]

export function DocumentsTab({
  horseId,
  stableId,
}: {
  horseId: string
  stableId: string
}) {
  const { t, formatDate } = usePreferences()
  const [documents, setDocuments] = useState<HorseDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [documentType, setDocumentType] = useState<DocumentType>('passport')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  function refetch() {
    setLoading(true)
    listHorseDocuments(horseId)
      .then(setDocuments)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    listHorseDocuments(horseId)
      .then(setDocuments)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [horseId])

  async function handleUpload(event: FormEvent) {
    event.preventDefault()
    if (!file) {
      setError(t('horseDetail.noFileSelected'))
      return
    }
    setUploading(true)
    setError(null)
    try {
      await uploadHorseDocument({ horseId, stableId, documentType, file })
      setFile(null)
      refetch()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(doc: HorseDocument) {
    if (!window.confirm(t('horseDetail.deleteDocumentConfirm'))) return
    await deleteHorseDocument(doc)
    setDocuments((prev) => prev.filter((d) => d.id !== doc.id))
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleUpload}
        className="flex flex-wrap items-end gap-3 rounded-2xl bg-slate-50 p-4"
      >
        <label>
          <span className="field-label">
            {t('horseDetail.documentTypeLabel')}
          </span>
          <select
            className="field"
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value as DocumentType)}
          >
            {DOCUMENT_TYPES.map((value) => (
              <option key={value} value={value}>
                {t(`documentType.${value}`)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="field-label">{t('horseDetail.chooseFile')}</span>
          <input
            type="file"
            className="field"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <button type="submit" disabled={uploading} className="btn-primary">
          {uploading
            ? t('horseDetail.uploading')
            : t('horseDetail.uploadDocument')}
        </button>
      </form>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {loading && (
        <p className="text-sm text-slate-500">{t('common.loading')}</p>
      )}

      {!loading && documents.length === 0 && (
        <p className="text-sm text-slate-500">{t('horseDetail.noDocuments')}</p>
      )}

      {!loading && documents.length > 0 && (
        <div className="space-y-3">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-100 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="font-medium wrap-break-word text-slate-900">
                  {t(`documentType.${doc.document_type}`)}
                </p>
                <p className="text-sm text-slate-500">
                  {formatDate(doc.uploaded_at)}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                {doc.signedUrl && (
                  <a
                    href={doc.signedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-ghost px-3 py-2"
                  >
                    {t('horseDetail.viewDocument')}
                  </a>
                )}
                <button
                  type="button"
                  className="btn-ghost px-3 py-2"
                  onClick={() => handleDelete(doc)}
                >
                  {t('common.delete')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

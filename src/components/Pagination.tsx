import { usePreferences } from '../lib/PreferencesContext'

export function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}) {
  const { t } = usePreferences()
  if (totalPages <= 1) return null

  const pages = Array.from({ length: totalPages }, (_, index) => index + 1)

  return (
    <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
      <button
        type="button"
        className="btn-ghost px-3 py-2"
        disabled={page === 1}
        onClick={() => onPageChange(page - 1)}
      >
        {t('common.previous')}
      </button>
      {pages.map((item) => (
        <button
          key={item}
          type="button"
          className={`${item === page ? 'btn-primary' : 'btn-ghost'} px-3 py-2`}
          onClick={() => onPageChange(item)}
        >
          {item}
        </button>
      ))}
      <button
        type="button"
        className="btn-ghost px-3 py-2"
        disabled={page === totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        {t('common.next')}
      </button>
    </div>
  )
}

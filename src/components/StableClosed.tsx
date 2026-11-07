import { usePreferences } from '../lib/PreferencesContext'

// Shown to everyone in a stable whose owner deleted the account. The stable is
// deleted for good after 3 months.
export function StableClosed({ onSignOut }: { onSignOut: () => void }) {
  const { t } = usePreferences()
  return (
    <main className="flex min-h-screen items-center justify-center px-4 pt-[env(safe-area-inset-top)]">
      <div className="panel max-w-md p-6 text-center">
        <h1 className="text-xl font-semibold text-slate-900">
          {t('deleteAccount.closedTitle')}
        </h1>
        <p className="mt-3 text-sm text-slate-600">
          {t('deleteAccount.closedBody')}
        </p>
        <button type="button" className="btn-primary mt-5" onClick={onSignOut}>
          {t('nav.signOut')}
        </button>
      </div>
    </main>
  )
}

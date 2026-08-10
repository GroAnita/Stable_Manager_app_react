export function EmptyState({
  icon = '🐴',
  title = 'Nothing here yet',
  message = '',
}: {
  icon?: string
  title?: string
  message?: string
}) {
  return (
    <div className="panel flex flex-col items-center justify-center gap-3 p-10 text-center text-slate-500">
      <div className="text-4xl">{icon}</div>
      <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
      {message && <p className="max-w-md text-sm">{message}</p>}
    </div>
  )
}

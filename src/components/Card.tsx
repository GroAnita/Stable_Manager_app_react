import type { ReactNode } from 'react'

export function Card({
  label,
  value,
  icon,
  helper,
}: {
  label: string
  value: ReactNode
  icon?: ReactNode
  helper?: string
}) {
  return (
    <div className="card-stat">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
          {helper && <p className="mt-2 text-sm text-slate-500">{helper}</p>}
        </div>
        {icon && (
          <div className="rounded-2xl bg-forest/10 p-3 text-forest">{icon}</div>
        )}
      </div>
    </div>
  )
}

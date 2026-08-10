export function getStatusColor(status: string): string {
  const normalized = status.toLowerCase()
  if (
    [
      'paid',
      'active',
      'available',
      'completed',
      'healthy',
      'confirmed',
      'up to date',
    ].includes(normalized)
  )
    return 'bg-emerald-100 text-emerald-800 border border-emerald-200'
  if (
    [
      'due',
      'reserved',
      'medium',
      'pending',
      'warning',
      'partially paid',
      'due soon',
    ].includes(normalized)
  )
    return 'bg-amber-100 text-amber-800 border border-amber-200'
  if (
    [
      'overdue',
      'maintenance',
      'expired',
      'cancelled',
      'high',
      'unpaid',
    ].includes(normalized)
  )
    return 'bg-red-100 text-red-800 border border-red-200'
  if (
    [
      'occupied',
      'scheduled',
      'info',
      'low',
      'farrier',
      'vet',
      'training',
    ].includes(normalized)
  )
    return 'bg-sky-100 text-sky-800 border border-sky-200'
  return 'bg-slate-100 text-slate-700 border border-slate-200'
}

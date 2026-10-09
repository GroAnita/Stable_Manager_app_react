export type StatusDotColor = 'green' | 'yellow' | 'red' | 'grey'

export function StatusDot({ color }: { color: StatusDotColor }) {
  const classes: Record<StatusDotColor, string> = {
    green: 'bg-emerald-500',
    yellow: 'bg-amber-500',
    red: 'bg-red-500',
    grey: 'bg-slate-300',
  }
  return (
    <span className={`inline-block h-2.5 w-2.5 rounded-full ${classes[color]}`} />
  )
}

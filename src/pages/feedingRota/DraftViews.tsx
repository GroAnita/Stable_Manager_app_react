import type { DraftDay } from '../../lib/feedingRotaDraft'

const SLOT_KEYS = [
  ['morning'],
  ['morning', 'evening'],
  ['morning', 'lunch', 'evening'],
  ['morning', 'lunch', 'evening', 'night'],
]

const SLOT_STYLES: Record<string, string> = {
  morning: 'border-gold/50 bg-gold/20 text-warmbrown',
  lunch: 'border-warmbrown/30 bg-warmbrown/10 text-warmbrown',
  evening: 'border-forest/30 bg-forest/10 text-forest',
  night: 'border-slate-300 bg-slate-100 text-slate-700',
}

type ViewProps = {
  days: DraftDay[]
  feedingsPerDay: number
  ownerName: (id: string) => string
  t: (key: string) => string
  locale: string
}

function weeksOf(days: DraftDay[]): DraftDay[][] {
  const weeks: DraftDay[][] = []
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7))
  return weeks
}

function dayLabel(dateIso: string, locale: string): string {
  return new Date(`${dateIso}T00:00:00Z`).toLocaleDateString(locale, {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

function OwnerChip({
  ownerId,
  slotKey,
  ownerName,
  t,
}: {
  ownerId: string | null
  slotKey: string
  ownerName: (id: string) => string
  t: (key: string) => string
}) {
  const name = ownerId ? ownerName(ownerId) : t('feedingRotaDraft.nobodyFree')
  return (
    <span
      title={`${t(`feedingRotaDraft.slot_${slotKey}`)}: ${name}`}
      className={`block truncate rounded-lg border px-2 py-1 text-xs font-medium ${
        ownerId ? SLOT_STYLES[slotKey] : 'border-red-200 bg-red-50 text-red-600'
      }`}
    >
      {name}
    </span>
  )
}

export function SlotLegend({
  feedingsPerDay,
  t,
}: {
  feedingsPerDay: number
  t: (key: string) => string
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {SLOT_KEYS[feedingsPerDay - 1].map((key) => (
        <span
          key={key}
          className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${SLOT_STYLES[key]}`}
        >
          {t(`feedingRotaDraft.slot_${key}`)}
        </span>
      ))}
    </div>
  )
}

export function DraftCalendar({
  days,
  feedingsPerDay,
  ownerName,
  t,
  locale,
}: ViewProps) {
  const slotKeys = SLOT_KEYS[feedingsPerDay - 1]
  return (
    <div className="space-y-5 overflow-x-auto pb-2">
      {weeksOf(days).map((week, weekIndex) => (
        <div key={week[0].date} className="min-w-[52rem]">
          <h3 className="mb-2 text-sm font-semibold text-slate-700">
            {t('feedingRotaDraft.week')} {weekIndex + 1}
          </h3>
          <div className="grid grid-cols-7 gap-2">
            {week.map((day) => (
              <div
                key={day.date}
                className="min-w-0 rounded-xl border border-slate-100 bg-slate-50 p-2"
              >
                <p className="mb-2 text-xs font-semibold text-slate-600 first-letter:uppercase">
                  {dayLabel(day.date, locale)}
                </p>
                <div className="space-y-1.5">
                  {day.slots.map((ownerId, slot) => (
                    <OwnerChip
                      key={slotKeys[slot]}
                      ownerId={ownerId}
                      slotKey={slotKeys[slot]}
                      ownerName={ownerName}
                      t={t}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function DraftList({
  days,
  feedingsPerDay,
  ownerName,
  t,
  locale,
}: ViewProps) {
  const slotKeys = SLOT_KEYS[feedingsPerDay - 1]
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {weeksOf(days).map((week, weekIndex) => (
        <div
          key={week[0].date}
          className="w-64 shrink-0 rounded-xl border border-slate-100 p-3"
        >
          <h3 className="mb-2 text-center text-sm font-semibold text-slate-700">
            {t('feedingRotaDraft.week')} {weekIndex + 1}
          </h3>
          <div className="divide-y divide-slate-100">
            {week.map((day) => (
              <div key={day.date} className="py-2">
                <p className="mb-1.5 text-xs font-semibold text-slate-600 first-letter:uppercase">
                  {dayLabel(day.date, locale)}
                </p>
                <div className="space-y-1">
                  {day.slots.map((ownerId, slot) => (
                    <div
                      key={slotKeys[slot]}
                      className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-2"
                    >
                      <span className="text-xs text-slate-500">
                        {t(`feedingRotaDraft.slot_${slotKeys[slot]}`)}
                      </span>
                      <OwnerChip
                        ownerId={ownerId}
                        slotKey={slotKeys[slot]}
                        ownerName={ownerName}
                        t={t}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

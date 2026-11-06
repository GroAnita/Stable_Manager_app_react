import {
  draftDayLabel,
  type DraftDay,
  type DraftSlot,
} from '../../lib/feedingRotaDraft'

const STYLES = {
  gold: 'border-gold/50 bg-gold/20 text-warmbrown',
  brown: 'border-warmbrown/30 bg-warmbrown/10 text-warmbrown',
  green: 'border-forest/30 bg-forest/10 text-forest',
  grey: 'border-slate-300 bg-slate-100 text-slate-700',
}

// First feeding of the day is gold and the last green, however many there are.
function slotStyle(slot: number, slotCount: number): string {
  if (slotCount === 1) return STYLES.gold
  if (slot === 0) return STYLES.gold
  if (slot === slotCount - 1) return STYLES.green
  return slot % 2 === 1 ? STYLES.brown : STYLES.grey
}

type ViewProps = {
  days: DraftDay[]
  slotLabels: string[]
  ownerName: (id: string) => string
  t: (key: string) => string
  locale: string
  onPick: (date: string, slot: number) => void
}

function weeksOf(days: DraftDay[]): DraftDay[][] {
  const weeks: DraftDay[][] = []
  for (const day of days) {
    if (!weeks[day.week]) weeks[day.week] = []
    weeks[day.week].push(day)
  }
  return weeks.filter(Boolean)
}

function OwnerChip({
  slot,
  index,
  slotLabels,
  ownerName,
  t,
  onClick,
}: {
  slot: DraftSlot
  index: number
  slotLabels: string[]
  ownerName: (id: string) => string
  t: (key: string) => string
  onClick: () => void
}) {
  const name = slot.ownerId
    ? ownerName(slot.ownerId)
    : t('feedingRotaDraft.nobodyFree')
  return (
    <button
      type="button"
      disabled={slot.completed}
      title={`${slotLabels[index]}: ${name}`}
      onClick={onClick}
      className={`block w-full truncate rounded-lg border px-2 py-1 text-left text-xs font-medium ${
        slot.shiftId ? '' : 'border-dashed'
      } ${slot.completed ? 'opacity-60' : 'hover:opacity-75'} ${
        slot.ownerId
          ? slotStyle(index, slotLabels.length)
          : 'border-red-200 bg-red-50 text-red-600'
      }`}
    >
      {slot.completed ? '✓ ' : ''}
      {name}
    </button>
  )
}

export function SlotLegend({
  slotLabels,
  t,
}: {
  slotLabels: string[]
  t: (key: string) => string
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {slotLabels.map((label, index) => (
        <span
          key={label}
          className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${slotStyle(index, slotLabels.length)}`}
        >
          {label}
        </span>
      ))}
      <span className="rounded-full border border-dashed border-slate-300 px-2.5 py-0.5 text-xs text-slate-500">
        {t('feedingRotaDraft.notPublished')}
      </span>
    </div>
  )
}

export function DraftCalendar({
  days,
  slotLabels,
  ownerName,
  t,
  locale,
  onPick,
}: ViewProps) {
  return (
    <div className="space-y-5 overflow-x-auto pb-2">
      {weeksOf(days).map((week) => (
        <div key={week[0].date} style={{ minWidth: `${week.length * 7.5}rem` }}>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">
            {t('feedingRotaDraft.week')} {week[0].week + 1}
          </h3>
          <div
            className="grid gap-2"
            style={{
              gridTemplateColumns: `repeat(${week.length}, minmax(0, 1fr))`,
            }}
          >
            {week.map((day) => (
              <div
                key={day.date}
                className="min-w-0 rounded-xl border border-slate-100 bg-slate-50 p-2"
              >
                <p className="mb-2 text-xs font-semibold text-slate-600 first-letter:uppercase">
                  {draftDayLabel(day.date, locale)}
                </p>
                <div className="space-y-1.5">
                  {day.slots.map(
                    (slot, index) =>
                      slot && (
                        <OwnerChip
                          key={slotLabels[index]}
                          slot={slot}
                          index={index}
                          slotLabels={slotLabels}
                          ownerName={ownerName}
                          t={t}
                          onClick={() => onPick(day.date, index)}
                        />
                      ),
                  )}
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
  slotLabels,
  ownerName,
  t,
  locale,
  onPick,
}: ViewProps) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {weeksOf(days).map((week) => (
        <div
          key={week[0].date}
          className="w-64 shrink-0 rounded-xl border border-slate-100 p-3"
        >
          <h3 className="mb-2 text-center text-sm font-semibold text-slate-700">
            {t('feedingRotaDraft.week')} {week[0].week + 1}
          </h3>
          <div className="divide-y divide-slate-100">
            {week.map((day) => (
              <div key={day.date} className="py-2">
                <p className="mb-1.5 text-xs font-semibold text-slate-600 first-letter:uppercase">
                  {draftDayLabel(day.date, locale)}
                </p>
                <div className="space-y-1">
                  {day.slots.map(
                    (slot, index) =>
                      slot && (
                        <div
                          key={slotLabels[index]}
                          className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-2"
                        >
                          <span className="truncate text-xs text-slate-500">
                            {slotLabels[index]}
                          </span>
                          <OwnerChip
                            slot={slot}
                            index={index}
                            slotLabels={slotLabels}
                            ownerName={ownerName}
                            t={t}
                            onClick={() => onPick(day.date, index)}
                          />
                        </div>
                      ),
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

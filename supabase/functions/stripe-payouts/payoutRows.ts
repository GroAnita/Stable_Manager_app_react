// Turns Stripe's movements in a payout into rows for the stable's accountant. Kept
// separate from the function so it has no Deno or network dependency.

export type PayoutMovement = {
  type: string
  amount: number
  fee: number
  net: number
  created: number
  paymentIntentId: string | null
}

export type PayoutRow = {
  type: string
  date: string
  gross: number
  fee: number
  net: number
  invoiceNumber: string | null
}

export type PayoutSummary = {
  id: string
  arrivalDate: string
  status: string
  amount: number
  rows: PayoutRow[]
  // What the rows add up to, minus what was paid out. Zero means it all adds up.
  difference: number
}

function kroner(minorUnits: number): number {
  return Math.round(minorUnits) / 100
}

function isoDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10)
}

export function buildPayoutSummary(input: {
  id: string
  arrivalDate: number
  status: string
  amount: number
  movements: PayoutMovement[]
  invoiceNumbers: Map<string, string | null>
}): PayoutSummary {
  // The payout itself is one of the movements Stripe lists.
  const movements = input.movements.filter(
    (movement) => movement.type !== 'payout',
  )
  const totalNet = movements.reduce((sum, movement) => sum + movement.net, 0)
  return {
    id: input.id,
    arrivalDate: isoDate(input.arrivalDate),
    status: input.status,
    amount: kroner(input.amount),
    rows: movements.map((movement) => ({
      type: movement.type,
      date: isoDate(movement.created),
      gross: kroner(movement.amount),
      fee: kroner(movement.fee),
      net: kroner(movement.net),
      invoiceNumber: movement.paymentIntentId
        ? (input.invoiceNumbers.get(movement.paymentIntentId) ?? null)
        : null,
    })),
    difference: kroner(totalNet - input.amount),
  }
}

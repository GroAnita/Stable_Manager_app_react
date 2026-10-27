// How many days ahead a bill (an expense logged with a future expense_date,
// e.g. a hay invoice) should start showing as "due soon" rather than just
// "upcoming" on the Dashboard and Calendar.
export const BILL_REMINDER_WINDOW_DAYS = 2

export function daysUntilDue(
  expenseDate: string,
  today: Date = new Date(),
): number {
  const due = new Date(`${expenseDate}T00:00:00`)
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((due.getTime() - start.getTime()) / 86400000)
}

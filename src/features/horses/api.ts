import {
  amountIncVat,
  billingCycleDueDate,
  beddingAmountIncVat,
  daysInBillingCycleFor,
  hayValueIncVat,
} from '../../lib/billing'
import { supabase } from '../../lib/supabaseClient'
import type { Database } from '../../types/supabase'
import { getActiveContractForHorse } from '../contracts/api'
import {
  countPaymentsDueOn,
  createPayment,
  deletePayment,
  findOpenPayment,
  getPayment,
  hasPaidPayment,
  updatePayment,
} from '../payments/api'

export type Horse = Database['public']['Tables']['horses']['Row']
export type HorseInsert = Database['public']['Tables']['horses']['Insert']
export type HorseUpdate = Database['public']['Tables']['horses']['Update']

export type HorseListItem = Pick<
  Horse,
  | 'id'
  | 'name'
  | 'breed'
  | 'age'
  | 'color'
  | 'passport_number'
  | 'photo_url'
  | 'status'
  | 'active'
> & {
  owner: Pick<
    Database['public']['Tables']['owners']['Row'],
    'id' | 'full_name'
  > | null
  stall: Pick<
    Database['public']['Tables']['stalls']['Row'],
    'id' | 'stall_number'
  > | null
}

export type HorseDetail = Horse & {
  owner: Pick<
    Database['public']['Tables']['owners']['Row'],
    'id' | 'full_name' | 'phone'
  > | null
  stall: Pick<
    Database['public']['Tables']['stalls']['Row'],
    'id' | 'stall_number' | 'size' | 'notes'
  > | null
}

export type Vaccination = Database['public']['Tables']['vaccinations']['Row']
export type VaccinationInsert =
  Database['public']['Tables']['vaccinations']['Insert']
export type VaccinationUpdate =
  Database['public']['Tables']['vaccinations']['Update']

export async function getHorseVaccinations(
  horseId: string,
): Promise<Vaccination[]> {
  const { data, error } = await supabase
    .from('vaccinations')
    .select('*')
    .eq('horse_id', horseId)
    .order('date', { ascending: false })
  if (error) throw error
  return data
}

export async function createVaccination(
  input: VaccinationInsert,
): Promise<Vaccination> {
  const { data, error } = await supabase
    .from('vaccinations')
    .insert(input)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateVaccination(
  id: string,
  input: VaccinationUpdate,
): Promise<Vaccination> {
  const { data, error } = await supabase
    .from('vaccinations')
    .update(input)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteVaccination(id: string): Promise<void> {
  const { error } = await supabase.from('vaccinations').delete().eq('id', id)
  if (error) throw error
}

export type MedicalRecord =
  Database['public']['Tables']['medical_records']['Row']
export type MedicalRecordInsert =
  Database['public']['Tables']['medical_records']['Insert']
export type MedicalRecordUpdate =
  Database['public']['Tables']['medical_records']['Update']
export type FeedingPlan = Database['public']['Tables']['feeding_plans']['Row']
export type FeedingPlanInsert =
  Database['public']['Tables']['feeding_plans']['Insert']
export type FeedingTime = Database['public']['Tables']['feeding_times']['Row']
export type FeedingTimeInsert =
  Database['public']['Tables']['feeding_times']['Insert']
export type FeedingTimeUpdate =
  Database['public']['Tables']['feeding_times']['Update']
export type HorseEvent = Pick<
  Database['public']['Tables']['calendar_events']['Row'],
  'id' | 'title' | 'description' | 'event_type' | 'start_time' | 'end_time'
>
export type CalendarEvent = HorseEvent & {
  horse: Pick<Database['public']['Tables']['horses']['Row'], 'id' | 'name'> | null
}

export async function listAllEvents(): Promise<CalendarEvent[]> {
  const { data, error } = await supabase
    .from('calendar_events')
    .select(
      'id, title, description, event_type, start_time, end_time, horse:horses(id, name)',
    )
    .order('start_time')
  if (error) throw error
  return data
}
export type HorseEventInsert =
  Database['public']['Tables']['calendar_events']['Insert']
export type HorseEventUpdate =
  Database['public']['Tables']['calendar_events']['Update']

export async function listHorses(): Promise<HorseListItem[]> {
  const { data, error } = await supabase
    .from('horses')
    .select(
      'id, name, breed, age, color, passport_number, photo_url, status, active, owner:owners(id, full_name), stall:stalls(id, stall_number)',
    )
    .order('name')
  if (error) throw error
  return data
}

export async function listMyHorses(): Promise<HorseDetail[]> {
  const { data, error } = await supabase
    .from('horses')
    .select(
      '*, owner:owners(id, full_name, phone), stall:stalls(id, stall_number, size, notes)',
    )
    .order('name')
  if (error) throw error
  return data
}

export async function getHorse(id: string): Promise<HorseDetail> {
  const { data, error } = await supabase
    .from('horses')
    .select(
      '*, owner:owners(id, full_name, phone), stall:stalls(id, stall_number, size, notes)',
    )
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function createHorse(input: HorseInsert): Promise<Horse> {
  const { data, error } = await supabase
    .from('horses')
    .insert(input)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateHorse(
  id: string,
  input: HorseUpdate,
): Promise<Horse> {
  const { data, error } = await supabase
    .from('horses')
    .update(input)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteHorse(id: string): Promise<void> {
  const { error } = await supabase.from('horses').delete().eq('id', id)
  if (error) throw error
}

export async function getHorseMedicalRecords(
  horseId: string,
): Promise<MedicalRecord[]> {
  const { data, error } = await supabase
    .from('medical_records')
    .select('*')
    .eq('horse_id', horseId)
    .order('date', { ascending: false })
  if (error) throw error
  return data
}

export async function createMedicalRecord(
  input: MedicalRecordInsert,
): Promise<MedicalRecord> {
  const { data, error } = await supabase
    .from('medical_records')
    .insert(input)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateMedicalRecord(
  id: string,
  input: MedicalRecordUpdate,
): Promise<MedicalRecord> {
  const { data, error } = await supabase
    .from('medical_records')
    .update(input)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteMedicalRecord(id: string): Promise<void> {
  const { error } = await supabase.from('medical_records').delete().eq('id', id)
  if (error) throw error
}

export async function getHorseFeedingPlan(
  horseId: string,
): Promise<FeedingPlan | null> {
  const { data, error } = await supabase
    .from('feeding_plans')
    .select('*')
    .eq('horse_id', horseId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function upsertFeedingPlan(
  input: FeedingPlanInsert,
): Promise<FeedingPlan> {
  const { data, error } = await supabase
    .from('feeding_plans')
    .upsert(input, { onConflict: 'horse_id' })
    .select()
    .single()
  if (error) throw error
  return data
}

export type FeedingExtraEntry = {
  id: string
  priceListItemId: string
  item: string
  category: string
  unit: string
  price: number
  quantity: number
  amount: number
  date: string
  paymentId: string
  invoiceLine: string
}

export function parseFeedingExtras(raw: string | null): FeedingExtraEntry[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as FeedingExtraEntry[]) : []
  } catch {
    return []
  }
}

export async function listAllFeedingExtras(): Promise<FeedingExtraEntry[]> {
  const { data, error } = await supabase.from('feeding_plans').select('extras')
  if (error) throw error
  return data.flatMap((row) => parseFeedingExtras(row.extras))
}

type Translate = (key: string, vars?: Record<string, string | number>) => string

export async function logFeedingExtra(params: {
  horseId: string
  stableId: string
  priceListItemId: string
  quantity: number
  date: string
  extras: FeedingExtraEntry[]
  t: Translate
  formatCurrency: (amount: number) => string
  formatDate: (date: string) => string
}): Promise<{ plan: FeedingPlan; message: string }> {
  const { horseId, stableId, priceListItemId, quantity, date, extras, t, formatCurrency, formatDate } =
    params

  const { data: item, error: itemError } = await supabase
    .from('price_list_items')
    .select('id, item, category, unit, price')
    .eq('id', priceListItemId)
    .single()
  if (itemError) throw itemError

  const contract = await getActiveContractForHorse(horseId)
  if (!contract) throw new Error(t('horseDetail.extraNoActiveContract'))

  const amount = amountIncVat(item.price ?? 0, quantity)
  const dueDate = billingCycleDueDate(date)
  const invoiceLine = t('horseDetail.extraInvoiceLine', {
    item: item.item,
    quantity,
    unit: item.unit ? ` ${item.unit}` : '',
    amount: formatCurrency(amount),
    date: formatDate(date),
  })

  const openPayment = await findOpenPayment(contract.id, dueDate)

  let paymentId: string
  let message: string
  if (openPayment) {
    const updated = await updatePayment(openPayment.id, {
      amount: Math.round((openPayment.amount + amount) * 100) / 100,
      notes: openPayment.notes
        ? `${openPayment.notes}\n${invoiceLine}`
        : invoiceLine,
    })
    paymentId = updated.id
    message = t('horseDetail.extraAddedToInvoice', {
      item: item.item,
      date: formatDate(dueDate),
    })
  } else {
    const alreadyPaid = await hasPaidPayment(contract.id, dueDate)
    const baseRent = alreadyPaid ? 0 : (contract.monthly_rent ?? 0)

    let hayCharge = 0
    if (!alreadyPaid && contract.hay_price_list_item_id) {
      const { data: hayItem } = await supabase
        .from('price_list_items')
        .select('price')
        .eq('id', contract.hay_price_list_item_id)
        .maybeSingle()
      hayCharge = hayValueIncVat(
        hayItem?.price ?? 0,
        contract.included_hay_kg ?? 0,
        daysInBillingCycleFor(dueDate),
      )
    }

    let beddingCharge = 0
    if (!alreadyPaid && contract.bedding_price_list_item_id) {
      const { data: beddingItem } = await supabase
        .from('price_list_items')
        .select('price')
        .eq('id', contract.bedding_price_list_item_id)
        .maybeSingle()
      beddingCharge = beddingAmountIncVat(
        beddingItem?.price ?? 0,
        contract.bedding_quantity ?? 0,
      )
    }

    const sequence = (await countPaymentsDueOn(dueDate)) + 1
    const boardLines: string[] = []
    if (baseRent)
      boardLines.push(
        t('horseDetail.extraMonthlyBoardLine', { amount: formatCurrency(baseRent) }),
      )
    if (hayCharge)
      boardLines.push(
        t('horseDetail.extraMonthlyHayLine', { amount: formatCurrency(hayCharge) }),
      )
    if (beddingCharge)
      boardLines.push(
        t('horseDetail.extraMonthlyBeddingLine', {
          amount: formatCurrency(beddingCharge),
        }),
      )

    const created = await createPayment({
      contract_id: contract.id,
      owner_id: contract.owner_id,
      stable_id: stableId,
      amount: Math.round((baseRent + hayCharge + beddingCharge + amount) * 100) / 100,
      due_date: dueDate,
      status: 'due',
      invoice_number: `INV-${dueDate.slice(0, 7).replace('-', '')}-${String(sequence).padStart(3, '0')}${alreadyPaid ? '-EXTRA' : ''}`,
      notes: boardLines.length ? `${boardLines.join('\n')}\n${invoiceLine}` : invoiceLine,
    })
    paymentId = created.id
    message = alreadyPaid
      ? t('horseDetail.extraAlreadyPaid', {
          amount: formatCurrency(amount),
          item: item.item,
        })
      : t('horseDetail.extraCreatedInvoice', {
          date: formatDate(dueDate),
          item: item.item,
        })
  }

  const entry: FeedingExtraEntry = {
    id: crypto.randomUUID(),
    priceListItemId: item.id,
    item: item.item,
    category: item.category ?? '',
    unit: item.unit ?? '',
    price: item.price ?? 0,
    quantity,
    amount,
    date,
    paymentId,
    invoiceLine,
  }

  const plan = await upsertFeedingPlan({
    horse_id: horseId,
    stable_id: stableId,
    extras: JSON.stringify([...extras, entry]),
  })

  return { plan, message }
}

export async function removeFeedingExtra(params: {
  horseId: string
  stableId: string
  entry: FeedingExtraEntry
  extras: FeedingExtraEntry[]
}): Promise<FeedingPlan> {
  const { horseId, stableId, entry, extras } = params

  const payment = await getPayment(entry.paymentId)
  if (payment) {
    const remaining = Math.round((payment.amount - entry.amount) * 100) / 100
    if (remaining <= 0) {
      await deletePayment(payment.id)
    } else {
      await updatePayment(payment.id, {
        amount: remaining,
        notes: (payment.notes ?? '')
          .split('\n')
          .filter((line) => line !== entry.invoiceLine)
          .join('\n'),
      })
    }
  }

  return upsertFeedingPlan({
    horse_id: horseId,
    stable_id: stableId,
    extras: JSON.stringify(extras.filter((item) => item.id !== entry.id)),
  })
}

export async function getHorseFeedingTimes(
  horseId: string,
): Promise<FeedingTime[]> {
  const { data, error } = await supabase
    .from('feeding_times')
    .select('*')
    .eq('horse_id', horseId)
    .order('time_of_day', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

export async function createFeedingTime(
  input: FeedingTimeInsert,
): Promise<FeedingTime> {
  const { data, error } = await supabase
    .from('feeding_times')
    .insert(input)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateFeedingTime(
  id: string,
  input: FeedingTimeUpdate,
): Promise<FeedingTime> {
  const { data, error } = await supabase
    .from('feeding_times')
    .update(input)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteFeedingTime(id: string): Promise<void> {
  const { error } = await supabase.from('feeding_times').delete().eq('id', id)
  if (error) throw error
}

export async function getHorseSchedule(horseId: string): Promise<HorseEvent[]> {
  const { data, error } = await supabase
    .from('calendar_events')
    .select('id, title, description, event_type, start_time, end_time')
    .eq('horse_id', horseId)
    .order('start_time', { ascending: true })
  if (error) throw error
  return data
}

export async function createHorseEvent(
  input: HorseEventInsert,
): Promise<HorseEvent> {
  const { data, error } = await supabase
    .from('calendar_events')
    .insert(input)
    .select('id, title, description, event_type, start_time, end_time')
    .single()
  if (error) throw error
  return data
}

export async function updateHorseEvent(
  id: string,
  input: HorseEventUpdate,
): Promise<HorseEvent> {
  const { data, error } = await supabase
    .from('calendar_events')
    .update(input)
    .eq('id', id)
    .select('id, title, description, event_type, start_time, end_time')
    .single()
  if (error) throw error
  return data
}

export async function deleteHorseEvent(id: string): Promise<void> {
  const { error } = await supabase.from('calendar_events').delete().eq('id', id)
  if (error) throw error
}

import { supabase } from '../../lib/supabaseClient'
import type { Database } from '../../types/supabase'

export type StableInvite =
  Database['public']['Tables']['stable_invites']['Row']

export async function createOwnerInvite(params: {
  stableId: string
  createdBy: string
  ownerId: string
}): Promise<StableInvite> {
  const { data, error } = await supabase
    .from('stable_invites')
    .insert({
      stable_id: params.stableId,
      created_by: params.createdBy,
      kind: 'owner',
      owner_id: params.ownerId,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function createStaffInvite(params: {
  stableId: string
  createdBy: string
}): Promise<StableInvite> {
  const { data, error } = await supabase
    .from('stable_invites')
    .insert({
      stable_id: params.stableId,
      created_by: params.createdBy,
      kind: 'staff',
      role: 'stable_employee',
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function acceptInvite(token: string): Promise<void> {
  const { error } = await supabase.rpc('accept_stable_invite', {
    p_token: token,
  })
  if (error) throw error
}

export function inviteUrl(token: string): string {
  return `${window.location.origin}/invite/${token}`
}

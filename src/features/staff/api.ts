import { supabase } from '../../lib/supabaseClient'
import type { Database } from '../../types/supabase'

export type Staff = Database['public']['Tables']['staff']['Row']
export type StaffRole = 'stable_owner' | 'stable_employee'

export async function listStaff(): Promise<Staff[]> {
  const { data, error } = await supabase
    .from('staff')
    .select('*')
    .order('full_name')
  if (error) throw error
  return data
}

export async function createStaff(input: {
  stableId: string
  fullName: string
  phone: string
  email: string
  role: StaffRole
}): Promise<Staff> {
  const { data, error } = await supabase
    .from('staff')
    .insert({
      stable_id: input.stableId,
      full_name: input.fullName,
      phone: input.phone || null,
      email: input.email || null,
      role: input.role,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function setStaffRole(
  id: string,
  role: StaffRole,
): Promise<void> {
  const { error } = await supabase.rpc('set_staff_role', {
    p_staff_id: id,
    p_role: role,
  })
  if (error) throw error
}

export async function removeStaff(staff: Staff): Promise<void> {
  if (staff.user_id) {
    const { error } = await supabase.rpc('revoke_staff_access', {
      p_staff_id: staff.id,
    })
    if (error) throw error
    return
  }
  const { error } = await supabase.from('staff').delete().eq('id', staff.id)
  if (error) throw error
}

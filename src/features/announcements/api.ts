import { supabase } from '../../lib/supabaseClient'
import type { Database } from '../../types/supabase'

export type Announcement = Database['public']['Tables']['announcements']['Row']
export type AnnouncementInsert =
  Database['public']['Tables']['announcements']['Insert']
export type AnnouncementUpdate =
  Database['public']['Tables']['announcements']['Update']

export async function listAnnouncements(): Promise<Announcement[]> {
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function createAnnouncement(
  input: Pick<AnnouncementInsert, 'title' | 'body'>,
): Promise<Announcement> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('stable_id')
    .eq('id', user.id)
    .single()
  if (profileError) throw profileError
  if (!profile.stable_id) throw new Error('No stable linked to your account')

  const { data, error } = await supabase
    .from('announcements')
    .insert({
      ...input,
      created_by: user.id,
      stable_id: profile.stable_id,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateAnnouncement(
  id: string,
  input: AnnouncementUpdate,
): Promise<Announcement> {
  const { data, error } = await supabase
    .from('announcements')
    .update(input)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteAnnouncement(id: string): Promise<void> {
  const { error } = await supabase.from('announcements').delete().eq('id', id)
  if (error) throw error
}

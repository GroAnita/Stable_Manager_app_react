import { supabase } from '../../lib/supabaseClient'
import type { Database } from '../../types/supabase'

export type Announcement = Database['public']['Tables']['announcements']['Row']
export type AnnouncementInsert =
  Database['public']['Tables']['announcements']['Insert']
export type AnnouncementUpdate =
  Database['public']['Tables']['announcements']['Update']

export type AnnouncementWithCounts = Announcement & {
  comments: { count: number }[]
  acknowledgments: { count: number }[]
}

export function countOf(rows: { count: number }[]): number {
  return rows[0]?.count ?? 0
}

export async function listAnnouncements(): Promise<AnnouncementWithCounts[]> {
  const { data, error } = await supabase
    .from('announcements')
    .select(
      '*, comments:announcement_comments(count), acknowledgments:announcement_acknowledgments(count)',
    )
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function listMyAcknowledgedAnnouncementIds(): Promise<string[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []
  const { data, error } = await supabase
    .from('announcement_acknowledgments')
    .select('announcement_id')
    .eq('user_id', user.id)
  if (error) throw error
  return data.map((row) => row.announcement_id)
}

export async function toggleAnnouncementAcknowledgment(
  announcementId: string,
  stableId: string,
  currentlyAcknowledged: boolean,
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')
  if (currentlyAcknowledged) {
    const { error } = await supabase
      .from('announcement_acknowledgments')
      .delete()
      .eq('announcement_id', announcementId)
      .eq('user_id', user.id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('announcement_acknowledgments').insert({
      announcement_id: announcementId,
      stable_id: stableId,
      user_id: user.id,
    })
    if (error) throw error
  }
}

export type AnnouncementAcknowledgment = {
  id: string
  created_at: string
  user: { full_name: string | null } | null
}

export async function listAnnouncementAcknowledgments(
  announcementId: string,
): Promise<AnnouncementAcknowledgment[]> {
  const { data, error } = await supabase
    .from('announcement_acknowledgments')
    .select('id, created_at, user:profiles(full_name)')
    .eq('announcement_id', announcementId)
    .order('created_at')
  if (error) throw error
  return data
}

export type AnnouncementComment = {
  id: string
  body: string
  created_at: string
  author_id: string
  author: { full_name: string | null } | null
}

export async function listAnnouncementComments(
  announcementId: string,
): Promise<AnnouncementComment[]> {
  const { data, error } = await supabase
    .from('announcement_comments')
    .select('id, body, created_at, author_id, author:profiles(full_name)')
    .eq('announcement_id', announcementId)
    .order('created_at')
  if (error) throw error
  return data
}

export async function createAnnouncementComment(
  announcementId: string,
  stableId: string,
  body: string,
): Promise<AnnouncementComment> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')
  const { data, error } = await supabase
    .from('announcement_comments')
    .insert({
      announcement_id: announcementId,
      stable_id: stableId,
      author_id: user.id,
      body,
    })
    .select('id, body, created_at, author_id, author:profiles(full_name)')
    .single()
  if (error) throw error
  return data
}

export async function deleteAnnouncementComment(id: string): Promise<void> {
  const { error } = await supabase
    .from('announcement_comments')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export async function createAnnouncement(
  input: Pick<AnnouncementInsert, 'title' | 'body' | 'category'>,
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

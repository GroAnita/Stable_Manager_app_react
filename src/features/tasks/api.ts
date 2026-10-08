import { supabase } from '../../lib/supabaseClient'
import type { Database } from '../../types/supabase'

export type Task = Database['public']['Tables']['tasks']['Row']
export type TaskInsert = Database['public']['Tables']['tasks']['Insert']
export type TaskUpdate = Database['public']['Tables']['tasks']['Update']

export type TaskListItem = Task & {
  horse: Pick<Database['public']['Tables']['horses']['Row'], 'id' | 'name'> | null
  assignee: Pick<
    Database['public']['Tables']['profiles']['Row'],
    'id' | 'full_name'
  > | null
}

export async function listTasks(): Promise<TaskListItem[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select(
      '*, horse:horses(id, name), assignee:profiles(id, full_name)',
    )
    .order('due_date', { ascending: true, nullsFirst: false })
  if (error) throw error
  return data
}

export async function createTask(input: TaskInsert): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .insert(input)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateTask(
  id: string,
  input: TaskUpdate,
): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .update(input)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from('tasks').delete().eq('id', id)
  if (error) throw error
}

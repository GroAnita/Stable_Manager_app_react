import { supabase } from '../../lib/supabaseClient'
import type { Database } from '../../types/supabase'

export type DocumentRow = Database['public']['Tables']['documents']['Row']
export type DocumentType = Database['public']['Enums']['document_type']

export type HorseDocument = DocumentRow & { signedUrl: string | null }

const SIGNED_URL_TTL_SECONDS = 60 * 60

async function withSignedUrl(doc: DocumentRow): Promise<HorseDocument> {
  const { data } = await supabase.storage
    .from('documents')
    .createSignedUrl(doc.file_url, SIGNED_URL_TTL_SECONDS)
  return { ...doc, signedUrl: data?.signedUrl ?? null }
}

export async function listHorseDocuments(
  horseId: string,
): Promise<HorseDocument[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('horse_id', horseId)
    .order('uploaded_at', { ascending: false })
  if (error) throw error
  return Promise.all(data.map(withSignedUrl))
}

export async function uploadHorseDocument({
  horseId,
  stableId,
  documentType,
  file,
}: {
  horseId: string
  stableId: string
  documentType: DocumentType
  file: File
}): Promise<HorseDocument> {
  const path = `${stableId}/${horseId}/${Date.now()}-${file.name}`
  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(path, file)
  if (uploadError) throw uploadError

  const { data, error } = await supabase
    .from('documents')
    .insert({
      stable_id: stableId,
      horse_id: horseId,
      document_type: documentType,
      file_url: path,
    })
    .select()
    .single()
  if (error) throw error
  return withSignedUrl(data)
}

export async function deleteHorseDocument(doc: DocumentRow): Promise<void> {
  const { error: storageError } = await supabase.storage
    .from('documents')
    .remove([doc.file_url])
  if (storageError) throw storageError
  const { error } = await supabase.from('documents').delete().eq('id', doc.id)
  if (error) throw error
}

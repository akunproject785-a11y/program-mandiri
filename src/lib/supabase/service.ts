import 'server-only'
import { createClient } from '@supabase/supabase-js'

/**
 * Client Supabase dengan SERVICE ROLE — HANYA untuk operasi server-terpercaya:
 * admin auth (create/update/delete user) dan Storage (upload foto siswa).
 * Melewati RLS. JANGAN pernah dipakai / diekspor ke browser.
 */
export function createSupabaseServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error('Konfigurasi Supabase (URL / service role key) belum lengkap')
  }
  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

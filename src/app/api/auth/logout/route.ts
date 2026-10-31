import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/** POST /api/auth/logout — signOut Supabase Auth + hapus cookie sesi */
export async function POST() {
  try {
    const supabase = await createSupabaseServerClient()
    await supabase.auth.signOut()
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[auth/logout]', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

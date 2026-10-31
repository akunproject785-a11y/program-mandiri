import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'

/** GET /api/auth/session — PUBLIK. Return {user: UserInfo | null} */
export async function GET() {
  try {
    const user = await getSessionUser()
    return NextResponse.json({ user })
  } catch (e) {
    console.error('[auth/session]', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

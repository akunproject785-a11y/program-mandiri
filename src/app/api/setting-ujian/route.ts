import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, requireAuth } from '@/lib/auth'
import { bacaUjianAktif, KEY_UJIAN_AKTIF } from '../_lib/ujian'

/**
 * GET /api/setting-ujian — status aktivasi menu Ujian musyrif.
 * Dipakai dashboard untuk menentukan tampil/sembunyinya menu Ujian musyrif.
 */
export async function GET() {
  try {
    const auth = await requireAuth()
    if (auth.response) return auth.response
    return NextResponse.json({ aktif: await bacaUjianAktif() })
  } catch (e) {
    console.error('[setting-ujian GET]', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

/** PATCH /api/setting-ujian — admin mengaktifkan/menonaktifkan menu Ujian. Body: { aktif: boolean } */
export async function PATCH(request: Request) {
  try {
    const auth = await requireAdmin()
    if (auth.response) return auth.response

    const body = (await request.json().catch(() => null)) as { aktif?: boolean } | null
    if (typeof body?.aktif !== 'boolean') {
      return NextResponse.json({ error: 'aktif wajib boolean' }, { status: 400 })
    }

    await db.setting.upsert({
      where: { key: KEY_UJIAN_AKTIF },
      create: { key: KEY_UJIAN_AKTIF, value: body.aktif ? '1' : '0' },
      update: { value: body.aktif ? '1' : '0' },
    })

    return NextResponse.json({ aktif: body.aktif })
  } catch (e) {
    console.error('[setting-ujian PATCH]', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

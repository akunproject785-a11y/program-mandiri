import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, requireAuth } from '@/lib/auth'
import { bacaTahunAjaran, bacaUjianAktif, KEY_UJIAN_AKTIF } from '../_lib/ujian'

/**
 * GET /api/setting-ujian — status aktivasi menu Ujian musyrif + tahun ajaran aktif.
 * Dipakai dashboard untuk menentukan tampil/sembunyinya menu Ujian musyrif.
 */
export async function GET() {
  try {
    const auth = await requireAuth()
    if (auth.response) return auth.response
    const [aktif, tahunAjaran] = await Promise.all([bacaUjianAktif(), bacaTahunAjaran()])
    return NextResponse.json({ aktif, tahunAjaran })
  } catch (e) {
    console.error('[setting-ujian GET]', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

/**
 * PATCH /api/setting-ujian — admin mengaktifkan/menonaktifkan menu Ujian. Body: { aktif: boolean }
 * Syarat: menu Ujian hanya bisa diaktifkan bila ada tahun ajaran aktif
 * (dikelola di /api/ujian/tahun-ajaran — tambah dulu, baru aktifkan).
 */
export async function PATCH(request: Request) {
  try {
    const auth = await requireAdmin()
    if (auth.response) return auth.response

    const body = (await request.json().catch(() => null)) as { aktif?: boolean } | null
    if (typeof body?.aktif !== 'boolean') {
      return NextResponse.json({ error: 'aktif wajib boolean' }, { status: 400 })
    }

    // Aktivasi menu butuh tahun ajaran aktif — tanpa itu tidak ada data yang dipakai.
    if (body.aktif === true && !(await bacaTahunAjaran())) {
      return NextResponse.json(
        { error: 'Tambah dan aktifkan tahun ajaran terlebih dahulu sebelum mengaktifkan Ujian' },
        { status: 400 }
      )
    }

    await db.setting.upsert({
      where: { key: KEY_UJIAN_AKTIF },
      create: { key: KEY_UJIAN_AKTIF, value: body.aktif ? '1' : '0' },
      update: { value: body.aktif ? '1' : '0' },
    })

    const [aktifAkhir, tahunAjaran] = await Promise.all([bacaUjianAktif(), bacaTahunAjaran()])
    return NextResponse.json({ aktif: aktifAkhir, tahunAjaran })
  } catch (e) {
    console.error('[setting-ujian PATCH]', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

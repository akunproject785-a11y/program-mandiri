import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, requireAuth } from '@/lib/auth'
import { bacaTahunAjaran, bacaUjianAktif, KEY_TAHUN_AJARAN, KEY_UJIAN_AKTIF } from '../_lib/ujian'

/** Batas panjang teks tahun ajaran (mis. "2026/2027"). */
const MAX_PANJANG_TA = 30

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
 * PATCH /api/setting-ujian — admin mengatur tahun ajaran dan/atau aktivasi menu Ujian.
 * Body: { aktif?: boolean, tahunAjaran?: string }
 * Syarat: menu Ujian hanya bisa diaktifkan bila tahun ajaran sudah diisi.
 * Mengganti tahun ajaran memindahkan data yang digunakan (TP & ujian) ke data
 * tahun ajaran baru; data tahun ajaran sebelumnya tetap tersimpan sebagai arsip.
 */
export async function PATCH(request: Request) {
  try {
    const auth = await requireAdmin()
    if (auth.response) return auth.response

    const body = (await request.json().catch(() => null)) as {
      aktif?: boolean
      tahunAjaran?: string
    } | null
    if (!body || (typeof body.aktif !== 'boolean' && typeof body.tahunAjaran !== 'string')) {
      return NextResponse.json({ error: 'Berikan aktif (boolean) atau tahunAjaran (string)' }, { status: 400 })
    }

    // Simpan tahun ajaran bila dikirim.
    let taAkhir = await bacaTahunAjaran()
    if (typeof body.tahunAjaran === 'string') {
      const ta = body.tahunAjaran.trim().slice(0, MAX_PANJANG_TA)
      if (!ta) {
        return NextResponse.json({ error: 'Tahun ajaran tidak boleh kosong' }, { status: 400 })
      }
      await db.setting.upsert({
        where: { key: KEY_TAHUN_AJARAN },
        create: { key: KEY_TAHUN_AJARAN, value: ta },
        update: { value: ta },
      })
      taAkhir = ta
    }

    // Aktivasi menu butuh tahun ajaran terisi — tanpa tahun ajaran tidak ada data yang dipakai.
    if (body.aktif === true && !taAkhir) {
      return NextResponse.json(
        { error: 'Isi tahun ajaran terlebih dahulu sebelum mengaktifkan Ujian' },
        { status: 400 }
      )
    }

    if (typeof body.aktif === 'boolean') {
      await db.setting.upsert({
        where: { key: KEY_UJIAN_AKTIF },
        create: { key: KEY_UJIAN_AKTIF, value: body.aktif ? '1' : '0' },
        update: { value: body.aktif ? '1' : '0' },
      })
    }

    const aktifAkhir = await bacaUjianAktif()
    return NextResponse.json({ aktif: aktifAkhir, tahunAjaran: taAkhir })
  } catch (e) {
    console.error('[setting-ujian PATCH]', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

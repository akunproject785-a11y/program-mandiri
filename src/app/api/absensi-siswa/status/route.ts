import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { getHalaqohIdsForMusyrif } from '@/app/api/_lib/shared'
import { wibNow } from '@/app/api/absensi/_lib'

/**
 * GET /api/absensi-siswa/status — status absensi siswa HARI INI (WIB) untuk semua
 * halaqoh binaan musyrif. Dipakai menu "Absen Siswa" utk kartu halaqoh + pemicu
 * notifikasi pengingat absen saat halaqoh dibuka.
 */
export async function GET() {
  try {
    const auth = await requireAuth()
    if (auth.response) return auth.response
    if (auth.user.role !== 'musyrif' || !auth.user.musyrifId) {
      return NextResponse.json(
        { error: 'Hanya musyrif yang memiliki halaqoh binaan' },
        { status: 403 }
      )
    }
    const musyrifId = auth.user.musyrifId

    const scopeIds = await getHalaqohIdsForMusyrif(musyrifId)
    if (scopeIds.length === 0) {
      return NextResponse.json({ tanggalServer: wibNow().tanggal, items: [] })
    }

    const tanggal = wibNow().tanggal
    const rows = await db.halaqoh.findMany({
      where: { id: { in: scopeIds } },
      orderBy: { nama: 'asc' },
      select: {
        id: true,
        nama: true,
        program: { select: { nama: true } },
        _count: { select: { siswa: true } },
        absensi: { where: { tanggal }, select: { siswaId: true }, distinct: ['siswaId'] },
      },
    })

    return NextResponse.json({
      tanggalServer: tanggal,
      items: rows.map((h) => ({
        id: h.id,
        nama: h.nama,
        programNama: h.program.nama,
        jumlahSiswa: h._count.siswa,
        jumlahAbsen: h.absensi.length,
      })),
    })
  } catch (e) {
    console.error('[absensi-siswa/status GET]', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

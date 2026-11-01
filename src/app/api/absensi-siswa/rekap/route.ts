import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { getHalaqohIdsForMusyrif } from '@/app/api/_lib/shared'

/**
 * GET /api/absensi-siswa/rekap?bulan=1-12&tahun=YYYY&halaqohId=?
 * Jumlah kehadiran per siswa dalam satu bulan (HADIR/SAKIT/IZIN/ALPA).
 * Dipakai Rekapan Bulanan (Rekap Setoran → tab Rekapan Bulanan) untuk menambahkan
 * kolom absensi pada laporan. Scoping mengikuti rekap setoran:
 * - musyrif: hanya siswa halaqoh binaannya
 * - admin: semua (atau filter halaqohId)
 */
export async function GET(request: Request) {
  try {
    const auth = await requireAuth()
    if (auth.response) return auth.response
    const user = auth.user

    const url = new URL(request.url)
    const now = new Date()
    const bulanParam = parseInt(url.searchParams.get('bulan') || '', 10)
    const tahunParam = parseInt(url.searchParams.get('tahun') || '', 10)
    const bulan = Number.isFinite(bulanParam) ? bulanParam : now.getMonth() + 1
    const tahun = Number.isFinite(tahunParam) ? tahunParam : now.getFullYear()
    if (bulan < 1 || bulan > 12 || tahun < 2000 || tahun > 2100) {
      return NextResponse.json({ error: 'Bulan atau tahun tidak valid' }, { status: 400 })
    }
    const halaqohFilter = url.searchParams.get('halaqohId') || undefined

    const mm = String(bulan).padStart(2, '0')
    const lastDay = new Date(Date.UTC(tahun, bulan, 0)).getUTCDate()
    const where: Prisma.AbsensiSiswaWhereInput = {
      tanggal: { gte: `${tahun}-${mm}-01`, lte: `${tahun}-${mm}-${String(lastDay).padStart(2, '0')}` },
    }

    // Scoping: konsisten dengan rekap setoran — berdasarkan halaqoh TERKINI siswa.
    const siswaWhere: Prisma.SiswaWhereInput = {}
    if (user.role === 'musyrif' && user.musyrifId) {
      const scopeIds = await getHalaqohIdsForMusyrif(user.musyrifId)
      siswaWhere.halaqohId = { in: scopeIds }
    }
    if (halaqohFilter) {
      siswaWhere.halaqohId = halaqohFilter
    }
    if (Object.keys(siswaWhere).length > 0) {
      where.siswa = siswaWhere
    }

    const rows = await db.absensiSiswa.findMany({
      where,
      select: {
        siswaId: true,
        status: true,
        siswa: {
          select: {
            nis: true,
            nama: true,
            kelas: true,
            halaqoh: { select: { nama: true } },
            program: { select: { nama: true } },
          },
        },
      },
    })

    // Agregasi per siswa di memori (volume kecil: maks ±100 siswa × 31 hari).
    const map = new Map<
      string,
      {
        siswaId: string
        nis: string
        nama: string
        kelas: string
        halaqohNama: string | null
        programNama: string
        hadir: number
        sakit: number
        izin: number
        alpa: number
      }
    >()
    for (const r of rows) {
      let item = map.get(r.siswaId)
      if (!item) {
        item = {
          siswaId: r.siswaId,
          nis: r.siswa.nis,
          nama: r.siswa.nama,
          kelas: r.siswa.kelas,
          halaqohNama: r.siswa.halaqoh?.nama ?? null,
          programNama: r.siswa.program.nama,
          hadir: 0,
          sakit: 0,
          izin: 0,
          alpa: 0,
        }
        map.set(r.siswaId, item)
      }
      if (r.status === 'HADIR') item.hadir += 1
      else if (r.status === 'SAKIT') item.sakit += 1
      else if (r.status === 'IZIN') item.izin += 1
      else if (r.status === 'ALPA') item.alpa += 1
    }

    // Urut NIS angka-aware — konsisten dengan rekap setoran.
    const items = [...map.values()].sort((a, b) =>
      a.nis.localeCompare(b.nis, 'id', { numeric: true })
    )

    return NextResponse.json({ bulan, tahun, items })
  } catch (e) {
    console.error('[absensi-siswa/rekap GET]', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

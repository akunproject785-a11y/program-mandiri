import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import {
  getHalaqohIdsForMusyrif,
  mapSetoranFlat,
  setoranInclude,
} from '@/app/api/_lib/shared'
import type { RekapBulananSiswa, SetoranItem } from '@/lib/types'

/** Nama bulan Indonesia (indeks 0-11). */
const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

/** Include tambahan: butuh kelas & nama halaqoh siswa untuk baris rekap. */
const rekapInclude = {
  ...setoranInclude,
  siswa: {
    select: {
      nama: true,
      nis: true,
      kelas: true,
      halaqoh: { select: { nama: true } },
    },
  },
} satisfies Prisma.SetoranInclude

type RekapSetoranRow = Prisma.SetoranGetPayload<{ include: typeof rekapInclude }>

/** Urut NIS secara angka-aware (20259 < 2025010 walau string), konsisten dengan Data Siswa. */
function bandingNis(a: string, b: string): number {
  return a.localeCompare(b, 'id', { numeric: true })
}

/** Urutan kronologis: tanggal (string YYYY-MM-DD aman disort leksikal), lalu waktu dibuat. */
function bandingKronologis(a: RekapSetoranRow, b: RekapSetoranRow): number {
  if (a.tanggal !== b.tanggal) return a.tanggal < b.tanggal ? -1 : 1
  return a.createdAt.getTime() - b.createdAt.getTime()
}

/** GET /api/setoran/rekap-bulanan — auth.
 *  Rekap satu bulan per siswa (urut NIS):
 *  - awal  = setoran pertama bulan itu   (tanggal terkecil, tiebreak createdAt)
 *  - akhir = setoran terakhir bulan itu  (tanggal terbesar, tiebreak createdAt)
 *  - totalBaris = penjumlahan field jumlahBaris semua setoran bulan itu
 *  Query: bulan (1-12), tahun (2000-2100), halaqohId (opsional).
 *  Musyrif hanya menerima rekap siswa halaqoh binaannya / rekamannya sendiri. */
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
    const halaqohId = url.searchParams.get('halaqohId') || undefined

    // Tanggal disimpan string YYYY-MM-DD → banding leksikal aman.
    const mm = String(bulan).padStart(2, '0')
    const lastDay = new Date(Date.UTC(tahun, bulan, 0)).getUTCDate()
    const from = `${tahun}-${mm}-01`
    const to = `${tahun}-${mm}-${String(lastDay).padStart(2, '0')}`

    const where: Prisma.SetoranWhereInput = { tanggal: { gte: from, lte: to } }
    if (halaqohId) where.siswa = { halaqohId }

    // Scoping musyrif: setoran siswa halaqoh binaannya ATAU yang dia catat sendiri.
    if (user.role === 'musyrif' && user.musyrifId) {
      const scopeIds = await getHalaqohIdsForMusyrif(user.musyrifId)
      where.AND = [
        {
          OR: [
            { siswa: { halaqohId: { in: scopeIds } } },
            { musyrifId: user.musyrifId },
          ],
        },
      ]
    }

    const rows = await db.setoran.findMany({
      where,
      include: rekapInclude,
      orderBy: [{ tanggal: 'asc' }, { createdAt: 'asc' }],
    })

    // Kelompokkan per siswa.
    interface Group {
      nis: string
      nama: string
      kelas: string
      halaqohNama: string | null
      programNama: string
      items: RekapSetoranRow[]
    }
    const groups = new Map<string, Group>()
    for (const row of rows) {
      let g = groups.get(row.siswaId)
      if (!g) {
        g = {
          nis: row.siswa?.nis ?? '',
          nama: row.siswa?.nama ?? '',
          kelas: row.siswa?.kelas ?? '',
          halaqohNama: row.siswa?.halaqoh?.nama ?? null,
          programNama: row.program?.nama ?? '',
          items: [],
        }
        groups.set(row.siswaId, g)
      }
      g.items.push(row)
    }

    let totalSetoran = 0
    let totalBaris = 0
    const rekap: RekapBulananSiswa[] = []
    for (const [siswaId, g] of groups) {
      const items = [...g.items].sort(bandingKronologis)
      const jumlahSetoran = items.length
      const totalBarisSiswa = items.reduce((acc, r) => acc + (r.jumlahBaris ?? 0), 0)
      totalSetoran += jumlahSetoran
      totalBaris += totalBarisSiswa
      const awal: SetoranItem | null = items.length ? mapSetoranFlat(items[0]) : null
      const akhir: SetoranItem | null = items.length
        ? mapSetoranFlat(items[items.length - 1])
        : null
      rekap.push({
        siswaId,
        nis: g.nis,
        nama: g.nama,
        kelas: g.kelas,
        halaqohNama: g.halaqohNama,
        programNama: g.programNama,
        jumlahSetoran,
        totalBaris: totalBarisSiswa,
        awal,
        akhir,
      })
    }
    rekap.sort((a, b) => bandingNis(a.nis, b.nis))

    return NextResponse.json({
      bulan,
      tahun,
      labelBulan: `${NAMA_BULAN[bulan - 1]} ${tahun}`,
      jumlahSiswa: rekap.length,
      totalSetoran,
      totalBaris,
      rekap,
    })
  } catch (e) {
    console.error('[setoran rekap-bulanan GET]', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

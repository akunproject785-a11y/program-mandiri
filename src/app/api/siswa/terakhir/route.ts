import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import {
  getHalaqohIdsForMusyrif,
  mapSetoranFlat,
  setoranInclude,
} from '@/app/api/_lib/shared'
import type { TerakhirMap } from '@/lib/types'

/** Nama jenis setoran dari satu baris setoran. */
function jenisOf(s: { tipe: string; menuSetoran: string | null }): string {
  if (s.tipe === 'C' || s.tipe === 'D') return s.menuSetoran || 'Setoran'
  if (s.tipe === 'B') return 'Materi'
  return 'Anaba'
}

/**
 * GET /api/siswa/terakhir — auth.
 * Query opsional: halaqohId, siswaId.
 *
 * Return { terakhir: TerakhirMap } dengan map siswaId →
 * { terakhir: SetoranItem|null, perJenis: [{jenis, setoran}], total }.
 * perJenis memuat catatan terakhir untuk SEMUA jenis setoran siswa
 * (Ziyadah/Murojaah/Tilawah utk tipe C/D; Anaba utk tipe A; Materi utk tipe B)
 * — dipakai musyrif untuk melanjutkan setoran dari titik terakhir.
 *
 * Scoping: musyrif hanya menerima siswa dari halaqoh yang dia bina.
 */
export async function GET(request: Request) {
  try {
    const auth = await requireAuth()
    if (auth.response) return auth.response
    const user = auth.user

    const url = new URL(request.url)
    const halaqohIdParam = url.searchParams.get('halaqohId') || undefined
    const siswaIdParam = url.searchParams.get('siswaId') || undefined

    // 1) Scope daftar siswa (filter + scoping musyrif)
    const whereSiswa: Prisma.SiswaWhereInput = {}
    if (halaqohIdParam) whereSiswa.halaqohId = halaqohIdParam
    if (siswaIdParam) whereSiswa.id = siswaIdParam
    if (user.role === 'musyrif' && user.musyrifId) {
      const scopeIds = await getHalaqohIdsForMusyrif(user.musyrifId)
      whereSiswa.AND = [{ halaqohId: { in: scopeIds } }]
    }

    const siswaRows = await db.siswa.findMany({
      where: whereSiswa,
      select: { id: true },
    })
    const ids = siswaRows.map((r) => r.id)

    const map: TerakhirMap = {}
    if (ids.length === 0) {
      return NextResponse.json({ terakhir: map })
    }

    // 2) Setoran terbaru dulu → entri pertama yang ditemui per siswa / per jenis
    //    adalah catatan terakhirnya.
    const rows = await db.setoran.findMany({
      where: { siswaId: { in: ids } },
      orderBy: [{ tanggal: 'desc' }, { createdAt: 'desc' }],
      take: 3000,
      include: setoranInclude,
    })

    // 3) Total setoran per siswa (bisa lebih besar dari take di atas)
    const counts = await db.setoran.groupBy({
      by: ['siswaId'],
      _count: { _all: true },
      where: { siswaId: { in: ids } },
    })
    const countMap = new Map(counts.map((c) => [c.siswaId, c._count._all]))

    for (const id of ids) {
      map[id] = { terakhir: null, perJenis: [], total: countMap.get(id) ?? 0 }
    }

    const seenJenis = new Map<string, Set<string>>()
    for (const row of rows) {
      const info = map[row.siswaId]
      if (!info) continue

      if (!info.terakhir) {
        info.terakhir = mapSetoranFlat(row)
      }
      let seen = seenJenis.get(row.siswaId)
      if (!seen) {
        seen = new Set()
        seenJenis.set(row.siswaId, seen)
      }
      const jenis = jenisOf(row)
      if (!seen.has(jenis)) {
        seen.add(jenis)
        info.perJenis.push({ jenis, setoran: mapSetoranFlat(row) })
      }
    }

    return NextResponse.json({ terakhir: map })
  } catch (e) {
    console.error('[siswa-terakhir GET]', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

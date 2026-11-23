import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { bacaUjianAktif } from '../../_lib/ujian'
import { isTanggalValid } from '../../absensi/_lib'
import type { Prisma } from '@prisma/client'

/** Include data relasi untuk pemetaan UjianItem (dengan breakdown nilai per TP). */
const ujianInclude = {
  siswa: { select: { nama: true, halaqoh: { select: { nama: true } } } },
  musyrif: { select: { namaLengkap: true } },
  nilaiTp: { orderBy: { tp: { urutan: 'asc' } }, select: { tpId: true, nilai: true, tp: { select: { teks: true } } } },
} satisfies Prisma.UjianInclude

type UjianWithRelasi = Prisma.UjianGetPayload<{ include: typeof ujianInclude }>

function mapUjian(u: UjianWithRelasi) {
  return {
    id: u.id,
    musyrifId: u.musyrifId,
    musyrifNama: u.musyrif?.namaLengkap ?? '',
    siswaId: u.siswaId,
    siswaNama: u.siswa?.nama ?? '',
    halaqohNama: u.siswa?.halaqoh?.nama ?? null,
    tanggal: u.tanggal,
    jenis: u.jenis,
    bab: u.bab,
    nilai: u.nilai,
    catatan: u.catatan,
    nilaiTp: u.nilaiTp.map((n) => ({ tpId: n.tpId, teks: n.tp.teks, nilai: n.nilai })),
  }
}

/**
 * GET /api/ujian/admin — rekapan ujian per musyrif untuk admin.
 * Tanpa query  : ringkasan per musyrif (total, siswa diujikan, rata-rata, terakhir)
 *                untuk SEMUA musyrif yang terdaftar (yang belum mengujikan tetap
 *                muncul dengan total 0, agar kelengkapan terlihat).
 * ?musyrifId=… : detail daftar ujian musyrif tsb.
 * ?dari=&sampai= : filter rentang tanggal (YYYY-MM-DD), opsional.
 */
export async function GET(request: Request) {
  try {
    const auth = await requireAdmin()
    if (auth.response) return auth.response

    const url = new URL(request.url)
    const musyrifId = url.searchParams.get('musyrifId') || null
    const dari = url.searchParams.get('dari') || ''
    const sampai = url.searchParams.get('sampai') || ''

    const tanggalFilter: { gte?: string; lte?: string } = {}
    if (dari && isTanggalValid(dari)) tanggalFilter.gte = dari
    if (sampai && isTanggalValid(sampai)) tanggalFilter.lte = sampai
    const pakaiRentang = Boolean(tanggalFilter.gte || tanggalFilter.lte)

    const aktif = await bacaUjianAktif()

    if (musyrifId) {
      const detail = await db.ujian.findMany({
        where: {
          musyrifId,
          ...(pakaiRentang ? { tanggal: tanggalFilter } : {}),
        },
        orderBy: [{ tanggal: 'desc' }, { createdAt: 'desc' }],
        take: 300,
        include: ujianInclude,
      })
      return NextResponse.json({ aktif, rekap: [], detail: detail.map(mapUjian) })
    }

    // Ringkasan per musyrif: semua musyrif + agregat ujiannya (left join style).
    const [musyrifRows, ujianRows] = await Promise.all([
      db.musyrif.findMany({ orderBy: { namaLengkap: 'asc' }, select: { id: true, namaLengkap: true } }),
      db.ujian.findMany({
        where: pakaiRentang ? { tanggal: tanggalFilter } : {},
        select: { musyrifId: true, siswaId: true, nilai: true, tanggal: true },
      }),
    ])

    const agg = new Map<string, { siswa: Set<string>; totalNilai: number; total: number; terakhir: string | null }>()
    for (const u of ujianRows) {
      const cur = agg.get(u.musyrifId) ?? { siswa: new Set<string>(), totalNilai: 0, total: 0, terakhir: null }
      cur.siswa.add(u.siswaId)
      cur.totalNilai += u.nilai
      cur.total += 1
      if (!cur.terakhir || u.tanggal > cur.terakhir) cur.terakhir = u.tanggal
      agg.set(u.musyrifId, cur)
    }

    const rekap = musyrifRows.map((m) => {
      const a = agg.get(m.id)
      return {
        musyrifId: m.id,
        musyrifNama: m.namaLengkap,
        total: a?.total ?? 0,
        siswaDiujikan: a?.siswa.size ?? 0,
        rataNilai: a && a.total > 0 ? Math.round((a.totalNilai / a.total) * 10) / 10 : null,
        terakhir: a?.terakhir ?? null,
      }
    })

    return NextResponse.json({ aktif, rekap, detail: null })
  } catch (e) {
    console.error('[ujian/admin GET]', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import {
  getHalaqohIdsForMusyrif,
  isTipeValid,
  mapSetoranFlat,
  setoranInclude,
} from '@/app/api/_lib/shared'
import type { HalaqohSayaItem, TipeInputan } from '@/lib/types'

/**
 * GET /api/summary — auth.
 * Admin: statistik global. Musyrif: HANYA data yang berhubungan dengannya
 * (siswa/halaqoh/setoran ter-scope + daftar halaqoh binaan + program yang diampu).
 */
export async function GET() {
  try {
    const auth = await requireAuth()
    if (auth.response) return auth.response
    const user = auth.user

    const now = new Date()
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    let siswaWhere: Prisma.SiswaWhereInput = {}
    let setoranWhere: Prisma.SetoranWhereInput = {}
    let totalHalaqoh: number
    let halaqohSaya: HalaqohSayaItem[] = []
    let programDiampu: number | undefined

    if (user.role === 'musyrif' && user.musyrifId) {
      const scopeIds = await getHalaqohIdsForMusyrif(user.musyrifId)
      siswaWhere = { halaqohId: { in: scopeIds } }
      setoranWhere = {
        OR: [
          { siswa: { halaqohId: { in: scopeIds } } },
          { musyrifId: user.musyrifId },
        ],
      }
      totalHalaqoh = await db.halaqoh.count({
        where: { musyrif: { some: { musyrifId: user.musyrifId } } },
      })

      // Daftar halaqoh binaan musyrif ini (+ program & jumlah siswa tiap halaqoh)
      const halaqohRows = await db.halaqoh.findMany({
        where: { musyrif: { some: { musyrifId: user.musyrifId } } },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          kode: true,
          nama: true,
          programId: true,
          program: { select: { nama: true, tipeInputan: true } },
          _count: { select: { siswa: true } },
        },
      })
      halaqohSaya = halaqohRows.map((h) => ({
        id: h.id,
        kode: h.kode,
        nama: h.nama,
        programNama: h.program.nama,
        tipeInputan: h.program.tipeInputan as TipeInputan,
        jumlahSiswa: h._count.siswa,
      }))
      programDiampu = new Set(halaqohRows.map((h) => h.programId)).size
    } else {
      totalHalaqoh = await db.halaqoh.count()
    }

    const [totalSiswa, totalMusyrif, totalProgram, totalSetoran, setoranBulanIni, grouped, programGrouped] =
      await Promise.all([
        db.siswa.count({ where: siswaWhere }),
        db.musyrif.count(),
        db.program.count(),
        db.setoran.count({ where: setoranWhere }),
        db.setoran.count({
          where: { AND: [setoranWhere, { tanggal: { startsWith: ym } }] },
        }),
        db.setoran.groupBy({
          by: ['tipe'],
          _count: { _all: true },
          where: setoranWhere,
        }),
        db.setoran.groupBy({
          by: ['programId'],
          _count: { _all: true },
          where: setoranWhere,
        }),
      ])

    const perTipe = { A: 0, B: 0, C: 0, D: 0 }
    for (const g of grouped) {
      if (isTipeValid(g.tipe)) {
        perTipe[g.tipe] = g._count._all
      }
    }

    // Distribusi setoran per program kelas (urut jumlah terbanyak)
    const progIds = programGrouped
      .map((g) => g.programId)
      .filter((id): id is string => typeof id === 'string' && id.length > 0)
    const progRows = progIds.length
      ? await db.program.findMany({ where: { id: { in: progIds } }, select: { id: true, nama: true } })
      : []
    const progNama = new Map(progRows.map((p) => [p.id, p.nama]))
    const perProgram = progIds
      .map((id) => ({
        id,
        nama: progNama.get(id) ?? 'Program',
        jumlah: programGrouped.find((g) => g.programId === id)?._count._all ?? 0,
      }))
      .sort((a, b) => b.jumlah - a.jumlah)

    const recentRows = await db.setoran.findMany({
      where: setoranWhere,
      orderBy: [{ tanggal: 'desc' }, { createdAt: 'desc' }],
      take: 8,
      include: setoranInclude,
    })

    return NextResponse.json({
      summary: {
        totalSiswa,
        totalMusyrif,
        totalHalaqoh,
        totalProgram,
        totalSetoran,
        setoranBulanIni,
        perTipe,
        perProgram,
        recentSetoran: recentRows.map(mapSetoranFlat),
        // Khusus musyrif (undefined otomatis dibuang dari JSON untuk admin)
        halaqohSaya: halaqohSaya.length > 0 ? halaqohSaya : undefined,
        programDiampu,
      },
    })
  } catch (e) {
    console.error('[summary]', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

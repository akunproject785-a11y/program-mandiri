import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { getHalaqohIdsForMusyrif } from '../../_lib/shared'
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

/** Minimal TP tersimpan sebelum musyrif boleh mencatat ujian siswa. */
export const MIN_TP_UJIAN = 2

/**
 * GET /api/ujian/musyrif — daftar ujian milik musyrif (dengan breakdown per TP)
 * + daftar TP miliknya + roster siswa halaqoh binaan.
 */
export async function GET() {
  try {
    const auth = await requireAuth()
    if (auth.response) return auth.response
    if (auth.user.role !== 'musyrif' || !auth.user.musyrifId) {
      return NextResponse.json({ error: 'Hanya musyrif yang dapat mengakses menu Ujian' }, { status: 403 })
    }
    const musyrifId = auth.user.musyrifId
    const scopeIds = await getHalaqohIdsForMusyrif(musyrifId)

    const [aktif, items, siswaRows, tpRows] = await Promise.all([
      bacaUjianAktif(),
      db.ujian.findMany({
        where: { musyrifId },
        orderBy: [{ tanggal: 'desc' }, { createdAt: 'desc' }],
        take: 200,
        include: ujianInclude,
      }),
      db.siswa.findMany({
        where: { halaqohId: { in: scopeIds } },
        orderBy: { nama: 'asc' },
        select: { id: true, nama: true, kelas: true, halaqoh: { select: { nama: true } } },
      }),
      db.tpUjian.findMany({
        where: { musyrifId },
        orderBy: [{ urutan: 'asc' }, { createdAt: 'asc' }],
        select: { id: true, teks: true, _count: { select: { nilaiTp: true } } },
      }),
    ])

    return NextResponse.json({
      aktif,
      items: items.map(mapUjian),
      siswa: siswaRows.map((s) => ({
        id: s.id,
        nama: s.nama,
        kelas: s.kelas,
        halaqohNama: s.halaqoh?.nama ?? '',
      })),
      tp: tpRows.map((t) => ({ id: t.id, teks: t.teks, dipakai: t._count.nilaiTp > 0 })),
    })
  } catch (e) {
    console.error('[ujian/musyrif GET]', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

/**
 * POST /api/ujian/musyrif — catat hasil ujian siswa berdasarkan TP milik musyrif.
 * Body: { siswaId, tanggal, jenis, bab?, catatan?, nilaiTp: { tpId, nilai }[] }
 * Syarat: menu Ujian aktif, siswa halaqoh binaan, minimal 2 TP tersimpan, dan
 * SEMUA TP milik musyrif wajib punya nilai 0–100 (set tpId === set TP musyrif).
 * Ujian.nilai disimpan sebagai rata-rata (dibulatkan) dari nilai per TP.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireAuth()
    if (auth.response) return auth.response
    if (auth.user.role !== 'musyrif' || !auth.user.musyrifId) {
      return NextResponse.json({ error: 'Hanya musyrif yang dapat mencatat ujian' }, { status: 403 })
    }
    const musyrifId = auth.user.musyrifId

    if (!(await bacaUjianAktif())) {
      return NextResponse.json(
        { error: 'Menu Ujian sedang dinonaktifkan admin' },
        { status: 403 }
      )
    }

    const body = (await request.json().catch(() => null)) as {
      siswaId?: string
      tanggal?: string
      jenis?: string
      bab?: string
      catatan?: string
      nilaiTp?: { tpId?: string; nilai?: number | string }[]
    } | null

    if (!body || !body.siswaId || !isTanggalValid(body.tanggal) || !body.jenis?.trim()) {
      return NextResponse.json(
        { error: 'Siswa, tanggal, dan jenis ujian wajib diisi' },
        { status: 400 }
      )
    }

    // TP milik musyrif — minimal 2 dan semua wajib dinilai.
    const tpRows = await db.tpUjian.findMany({
      where: { musyrifId },
      orderBy: [{ urutan: 'asc' }, { createdAt: 'asc' }],
      select: { id: true },
    })
    if (tpRows.length < MIN_TP_UJIAN) {
      return NextResponse.json(
        { error: `Input minimal ${MIN_TP_UJIAN} Tujuan Pembelajaran (TP) sebelum mencatat ujian` },
        { status: 400 }
      )
    }

    const tpIds = new Set(tpRows.map((t) => t.id))
    const nilaiMasuk = Array.isArray(body.nilaiTp) ? body.nilaiTp : []
    if (nilaiMasuk.length !== tpRows.length) {
      return NextResponse.json(
        { error: 'Semua TP wajib memiliki nilai sebelum ujian disimpan' },
        { status: 400 }
      )
    }
    const nilaiPerTp = new Map<string, number>()
    for (const n of nilaiMasuk) {
      const nilai = Number(n?.nilai)
      if (!n?.tpId || !tpIds.has(n.tpId) || nilaiPerTp.has(n.tpId)) {
        return NextResponse.json({ error: 'Daftar nilai TP tidak valid' }, { status: 400 })
      }
      if (!Number.isInteger(nilai) || nilai < 0 || nilai > 100) {
        return NextResponse.json({ error: 'Nilai TP harus angka bulat 0–100' }, { status: 400 })
      }
      nilaiPerTp.set(n.tpId, nilai)
    }
    const rata = Math.round([...nilaiPerTp.values()].reduce((a, b) => a + b, 0) / nilaiPerTp.size)

    // Siswa harus berada di salah satu halaqoh binaan musyrif.
    const scopeIds = await getHalaqohIdsForMusyrif(musyrifId)
    const siswa = await db.siswa.findUnique({
      where: { id: body.siswaId },
      select: { id: true, halaqohId: true, nama: true },
    })
    if (!siswa || !siswa.halaqohId || !scopeIds.includes(siswa.halaqohId)) {
      return NextResponse.json(
        { error: 'Siswa bukan anggota halaqoh binaan Anda' },
        { status: 403 }
      )
    }

    const created = await db.$transaction(async (tx) => {
      const ujian = await tx.ujian.create({
        data: {
          musyrifId,
          siswaId: siswa.id,
          tanggal: body.tanggal,
          jenis: body.jenis.trim().slice(0, 100),
          bab: body.bab?.trim() ? body.bab.trim().slice(0, 200) : null,
          nilai: rata,
          catatan: body.catatan?.trim() ? body.catatan.trim().slice(0, 300) : null,
        },
        include: ujianInclude,
      })
      await tx.nilaiTp.createMany({
        data: [...nilaiPerTp.entries()].map(([tpId, nilai]) => ({ ujianId: ujian.id, tpId, nilai })),
      })
      return ujian
    })

    return NextResponse.json({ ujian: mapUjian(created) }, { status: 201 })
  } catch (e) {
    console.error('[ujian/musyrif POST]', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

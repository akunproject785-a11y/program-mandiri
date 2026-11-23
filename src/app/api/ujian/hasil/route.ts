import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { bacaTahunAjaran, bacaUjianAktif } from '../../_lib/ujian'
import type { Prisma } from '@prisma/client'

/** Include data relasi untuk pemetaan detail ujian (sama dengan /api/ujian/musyrif). */
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
 * GET /api/ujian/hasil — rekap nilai ujian seluruh siswa binaan musyrif untuk
 * menu "Hasil Ujian" (dashboard musyrif), dikelompokkan per siswa dan DIURUT
 * dari nilai tertinggi. Setiap baris membawa detail seluruh ujian siswa
 * (dengan breakdown nilai per TP) sebagai bahan cetak raport; 3 teratas layak
 * cetak sertifikat (ditentukan di UI berdasarkan urutan).
 * Data hanya milik tahun ajaran aktif; menu kosong bila Ujian nonaktif.
 */
export async function GET() {
  try {
    const auth = await requireAuth()
    if (auth.response) return auth.response
    if (auth.user.role !== 'musyrif' || !auth.user.musyrifId) {
      return NextResponse.json({ error: 'Hanya musyrif yang dapat mengakses Hasil Ujian' }, { status: 403 })
    }
    const musyrifId = auth.user.musyrifId
    const [aktif, tahunAjaran, musyrif] = await Promise.all([
      bacaUjianAktif(),
      bacaTahunAjaran(),
      db.musyrif.findUnique({ where: { id: musyrifId }, select: { namaLengkap: true } }),
    ])
    if (!aktif || !tahunAjaran) {
      return NextResponse.json({ aktif, tahunAjaran, musyrifNama: musyrif?.namaLengkap ?? '', items: [] })
    }

    const rows = await db.ujian.findMany({
      where: { musyrifId, tahunAjaran },
      orderBy: [{ tanggal: 'desc' }, { createdAt: 'desc' }],
      take: 500,
      include: ujianInclude,
    })

    // Kelompokkan per siswa: jumlah ujian, total nilai, dan detail lengkap.
    const perSiswa = new Map<
      string,
      { siswaNama: string; halaqohNama: string; total: number; detail: ReturnType<typeof mapUjian>[] }
    >()
    for (const u of rows) {
      const sekarang = perSiswa.get(u.siswaId)
      const item = mapUjian(u)
      if (sekarang) {
        sekarang.total += u.nilai
        sekarang.detail.push(item)
      } else {
        perSiswa.set(u.siswaId, {
          siswaNama: item.siswaNama,
          halaqohNama: item.halaqohNama ?? '',
          total: u.nilai,
          detail: [item],
        })
      }
    }

    const items = [...perSiswa.entries()]
      .map(([siswaId, s]) => ({
        siswaId,
        siswaNama: s.siswaNama,
        halaqohNama: s.halaqohNama,
        jumlahUjian: s.detail.length,
        rataNilai: Math.round(s.total / s.detail.length),
        detail: s.detail,
      }))
      .sort((a, b) => b.rataNilai - a.rataNilai || a.siswaNama.localeCompare(b.siswaNama))

    return NextResponse.json({ aktif, tahunAjaran, musyrifNama: musyrif?.namaLengkap ?? '', items })
  } catch (e) {
    console.error('[ujian/hasil GET]', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { getHalaqohIdsForMusyrif } from '@/app/api/_lib/shared'

const TANGGAL_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * GET /api/absensi-siswa/harian?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Seluruh record absensi siswa pada rentang tanggal (tanpa from/to = semua).
 * Dipakai menu Rekap Setoran (tab Daftar Setoran) untuk menyisipkan status absen
 * per baris setoran dan menyusun teks share WhatsApp per siswa (termasuk siswa
 * yang hadir namun belum setoran).
 * Scoping: musyrif hanya siswa halaqoh binaannya (halaqoh TERKINI siswa —
 * konsisten dengan endpoint rekap), admin semua.
 */
export async function GET(request: Request) {
  try {
    const auth = await requireAuth()
    if (auth.response) return auth.response
    const user = auth.user

    const url = new URL(request.url)
    const from = url.searchParams.get('from') || undefined
    const to = url.searchParams.get('to') || undefined
    if ((from && !TANGGAL_RE.test(from)) || (to && !TANGGAL_RE.test(to))) {
      return NextResponse.json({ error: 'Tanggal tidak valid' }, { status: 400 })
    }

    const where: Prisma.AbsensiSiswaWhereInput = {}
    if (from || to) {
      where.tanggal = { gte: from, lte: to }
    }

    if (user.role === 'musyrif' && user.musyrifId) {
      const scopeIds = await getHalaqohIdsForMusyrif(user.musyrifId)
      where.siswa = { halaqohId: { in: scopeIds } }
    }

    const rows = await db.absensiSiswa.findMany({
      where,
      orderBy: [{ tanggal: 'asc' }],
      select: {
        siswaId: true,
        tanggal: true,
        status: true,
        keterangan: true,
      },
    })

    return NextResponse.json({ items: rows })
  } catch (e) {
    console.error('[absensi-siswa/harian GET]', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

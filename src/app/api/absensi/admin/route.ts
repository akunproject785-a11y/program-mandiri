import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { isStatusAbsensi, isTanggalValid, mapAbsensi } from '../_lib'

/**
 * GET /api/absensi/admin?status=PENDING|ACC|TOLAK&dari=YYYY-MM-DD&sampai=YYYY-MM-DD
 * Daftar absensi seluruh musyrif (maks 500 terbaru) untuk dashboard admin.
 */
export async function GET(request: Request) {
  try {
    const auth = await requireAdmin()
    if (auth.response) return auth.response

    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const dari = url.searchParams.get('dari')
    const sampai = url.searchParams.get('sampai')

    const where: Prisma.AbsensiMusyrifWhereInput = {}
    if (isStatusAbsensi(status)) where.status = status
    if (dari || sampai) {
      where.tanggal = {}
      if (isTanggalValid(dari)) where.tanggal.gte = dari
      if (isTanggalValid(sampai)) where.tanggal.lte = sampai
    }

    const items = await db.absensiMusyrif.findMany({
      where,
      orderBy: [{ tanggal: 'desc' }, { jam: 'desc' }],
      take: 500,
      include: { musyrif: { select: { namaLengkap: true } } },
    })

    return NextResponse.json({ items: items.map(mapAbsensi) })
  } catch (e) {
    console.error('[absensi/admin GET]', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

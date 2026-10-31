import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

/** GET /api/stats — PUBLIK. Jumlah total untuk statistik landing page */
export async function GET() {
  try {
    const [siswa, musyrif, halaqoh, setoran] = await Promise.all([
      db.siswa.count(),
      db.musyrif.count(),
      db.halaqoh.count(),
      db.setoran.count(),
    ])
    return NextResponse.json({ stats: { siswa, musyrif, halaqoh, setoran } })
  } catch (e) {
    console.error('[stats]', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

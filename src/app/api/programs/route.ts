import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, requireAuth } from '@/lib/auth'
import { isUniqueViolation, nextKode } from '@/app/api/_lib/shared'

/** GET /api/programs — auth. Urut createdAt asc.
 *  Query opsional: scope=assigned → musyrif hanya menerima program yang dia
 *  menjadi pembina halaqoh-nya (dasar menu Input Setoran musyrif). */
export async function GET(request: Request) {
  try {
    const auth = await requireAuth()
    if (auth.response) return auth.response
    const user = auth.user

    const url = new URL(request.url)
    const scope = url.searchParams.get('scope')

    if (scope === 'assigned' && user.role === 'musyrif' && user.musyrifId) {
      const assigned = await db.program.findMany({
        where: {
          halaqoh: {
            some: { musyrif: { some: { musyrifId: user.musyrifId } } },
          },
        },
        orderBy: { createdAt: 'asc' },
      })
      return NextResponse.json({ programs: assigned })
    }

    const programs = await db.program.findMany({ orderBy: { createdAt: 'asc' } })
    return NextResponse.json({ programs })
  } catch (e) {
    console.error('[programs GET]', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

/** POST /api/programs — admin. Kode auto-generate PGM-001, PGM-002, ... */
export async function POST(request: Request) {
  try {
    const auth = await requireAdmin()
    if (auth.response) return auth.response

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const nama = typeof body.nama === 'string' ? body.nama.trim() : ''
    const tipeInputan = body.tipeInputan
    const targetHafalan =
      typeof body.targetHafalan === 'string' ? body.targetHafalan.trim() : ''

    if (!nama || !targetHafalan) {
      return NextResponse.json(
        { error: 'Nama program dan target hafalan wajib diisi' },
        { status: 400 }
      )
    }
    if (tipeInputan !== 'A' && tipeInputan !== 'B' && tipeInputan !== 'C' && tipeInputan !== 'D') {
      return NextResponse.json(
        { error: 'Tipe inputan harus A, B, C, atau D' },
        { status: 400 }
      )
    }

    const kode = await nextKode('PGM')
    const program = await db.program.create({
      data: { kode, nama, tipeInputan, targetHafalan },
    })
    return NextResponse.json({ program })
  } catch (e) {
    if (isUniqueViolation(e)) {
      return NextResponse.json(
        { error: 'Kode program sudah ada, silakan coba lagi' },
        { status: 409 }
      )
    }
    console.error('[programs POST]', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

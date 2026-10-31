import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

type RouteParams = { params: Promise<{ id: string }> }

/** PUT /api/programs/:id — admin */
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const auth = await requireAdmin()
    if (auth.response) return auth.response
    const { id } = await params

    const existing = await db.program.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Program tidak ditemukan' }, { status: 404 })
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const data: { nama?: string; tipeInputan?: string; targetHafalan?: string } = {}

    if (body.nama !== undefined) {
      const nama = String(body.nama).trim()
      if (!nama) {
        return NextResponse.json({ error: 'Nama program tidak boleh kosong' }, { status: 400 })
      }
      data.nama = nama
    }
    if (body.tipeInputan !== undefined) {
      const t = body.tipeInputan
      if (t !== 'A' && t !== 'B' && t !== 'C' && t !== 'D') {
        return NextResponse.json(
          { error: 'Tipe inputan harus A, B, C, atau D' },
          { status: 400 }
        )
      }
      data.tipeInputan = t
    }
    if (body.targetHafalan !== undefined) {
      const targetHafalan = String(body.targetHafalan).trim()
      if (!targetHafalan) {
        return NextResponse.json(
          { error: 'Target hafalan tidak boleh kosong' },
          { status: 400 }
        )
      }
      data.targetHafalan = targetHafalan
    }

    const program = await db.program.update({ where: { id }, data })
    return NextResponse.json({ program })
  } catch (e) {
    console.error('[programs/:id PUT]', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

/** DELETE /api/programs/:id — admin. 409 jika masih dipakai halaqoh/siswa */
export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const auth = await requireAdmin()
    if (auth.response) return auth.response
    const { id } = await params

    const existing = await db.program.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Program tidak ditemukan' }, { status: 404 })
    }

    const [halaqohCount, siswaCount] = await Promise.all([
      db.halaqoh.count({ where: { programId: id } }),
      db.siswa.count({ where: { programId: id } }),
    ])
    if (halaqohCount > 0 || siswaCount > 0) {
      return NextResponse.json(
        {
          error:
            'Program masih memiliki halaqoh/siswa. Hapus atau pindahkan data terkait terlebih dahulu.',
        },
        { status: 409 }
      )
    }

    await db.program.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[programs/:id DELETE]', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

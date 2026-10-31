import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { halaqohInclude, mapHalaqoh } from '@/app/api/_lib/shared'

type RouteParams = { params: Promise<{ id: string }> }

/** PUT /api/halaqoh/:id — admin. Replace relasi musyrif jika musyrifIds dikirim */
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const auth = await requireAdmin()
    if (auth.response) return auth.response
    const { id } = await params

    const existing = await db.halaqoh.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Halaqoh tidak ditemukan' }, { status: 404 })
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const data: { nama?: string; programId?: string } = {}

    if (body.nama !== undefined) {
      const nama = String(body.nama).trim()
      if (!nama) {
        return NextResponse.json({ error: 'Nama halaqoh tidak boleh kosong' }, { status: 400 })
      }
      data.nama = nama
    }
    if (body.programId !== undefined) {
      const programId = String(body.programId).trim()
      if (!programId) {
        return NextResponse.json({ error: 'Program wajib dipilih' }, { status: 400 })
      }
      const program = await db.program.findUnique({ where: { id: programId } })
      if (!program) {
        return NextResponse.json({ error: 'Program tidak ditemukan' }, { status: 400 })
      }
      data.programId = programId
    }

    // Replace relasi musyrif jika musyrifIds dikirim
    if (body.musyrifIds !== undefined) {
      const musyrifIds = Array.isArray(body.musyrifIds) ? body.musyrifIds : null
      if (musyrifIds === null) {
        return NextResponse.json(
          { error: 'Daftar musyrif tidak valid (harus berupa array)' },
          { status: 400 }
        )
      }
      const uniqueIds = [
        ...new Set(
          musyrifIds
            .filter((v): v is string => typeof v === 'string' && v.trim() !== '')
            .map((v) => v.trim())
        ),
      ]
      if (uniqueIds.length > 0) {
        const musyrifCount = await db.musyrif.count({ where: { id: { in: uniqueIds } } })
        if (musyrifCount !== uniqueIds.length) {
          return NextResponse.json(
            { error: 'Beberapa musyrif tidak ditemukan' },
            { status: 400 }
          )
        }
      }
      await db.$transaction([
        db.halaqohMusyrif.deleteMany({ where: { halaqohId: id } }),
        db.halaqohMusyrif.createMany({
          data: uniqueIds.map((musyrifId) => ({ halaqohId: id, musyrifId })),
        }),
      ])
    }

    if (Object.keys(data).length > 0) {
      await db.halaqoh.update({ where: { id }, data })
    }

    const halaqoh = await db.halaqoh.findUnique({
      where: { id },
      include: halaqohInclude,
    })
    if (!halaqoh) {
      return NextResponse.json({ error: 'Halaqoh tidak ditemukan' }, { status: 404 })
    }
    return NextResponse.json({ halaqoh: mapHalaqoh(halaqoh) })
  } catch (e) {
    console.error('[halaqoh/:id PUT]', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

/** DELETE /api/halaqoh/:id — admin. 409 jika masih ada siswa */
export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const auth = await requireAdmin()
    if (auth.response) return auth.response
    const { id } = await params

    const existing = await db.halaqoh.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Halaqoh tidak ditemukan' }, { status: 404 })
    }

    const siswaCount = await db.siswa.count({ where: { halaqohId: id } })
    if (siswaCount > 0) {
      return NextResponse.json(
        { error: 'Halaqoh masih memiliki siswa. Pindahkan siswa terlebih dahulu.' },
        { status: 409 }
      )
    }

    await db.halaqoh.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[halaqoh/:id DELETE]', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

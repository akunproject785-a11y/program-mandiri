import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { isUniqueViolation, mapSiswa, siswaInclude } from '@/app/api/_lib/shared'

type RouteParams = { params: Promise<{ id: string }> }

/** PUT /api/siswa/:id — admin. halaqohId kosong = keluar dari halaqoh */
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const auth = await requireAdmin()
    if (auth.response) return auth.response
    const { id } = await params

    const existing = await db.siswa.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Siswa tidak ditemukan' }, { status: 404 })
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const data: {
      nis?: string
      kelas?: string
      nama?: string
      programId?: string
      halaqohId?: string | null
    } = {}

    if (body.nis !== undefined) {
      const nis = String(body.nis).trim()
      if (!nis) {
        return NextResponse.json({ error: 'NIS tidak boleh kosong' }, { status: 400 })
      }
      if (nis !== existing.nis) {
        const dupNis = await db.siswa.findUnique({ where: { nis } })
        if (dupNis) {
          return NextResponse.json({ error: 'NIS sudah terdaftar' }, { status: 409 })
        }
      }
      data.nis = nis
    }
    if (body.kelas !== undefined) {
      const kelas = String(body.kelas).trim()
      if (!kelas) {
        return NextResponse.json({ error: 'Kelas tidak boleh kosong' }, { status: 400 })
      }
      data.kelas = kelas
    }
    if (body.nama !== undefined) {
      const nama = String(body.nama).trim()
      if (!nama) {
        return NextResponse.json({ error: 'Nama tidak boleh kosong' }, { status: 400 })
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
    if (body.halaqohId !== undefined) {
      const halaqohIdRaw = String(body.halaqohId ?? '').trim()
      if (halaqohIdRaw === '') {
        data.halaqohId = null
      } else {
        const halaqoh = await db.halaqoh.findUnique({ where: { id: halaqohIdRaw } })
        if (!halaqoh) {
          return NextResponse.json({ error: 'Halaqoh tidak ditemukan' }, { status: 400 })
        }
        data.halaqohId = halaqoh.id
      }
    }

    await db.siswa.update({ where: { id }, data })

    const siswa = await db.siswa.findUnique({
      where: { id },
      include: siswaInclude,
    })
    if (!siswa) {
      return NextResponse.json({ error: 'Siswa tidak ditemukan' }, { status: 404 })
    }
    return NextResponse.json({ siswa: mapSiswa(siswa) })
  } catch (e) {
    if (isUniqueViolation(e)) {
      return NextResponse.json({ error: 'NIS sudah terdaftar' }, { status: 409 })
    }
    console.error('[siswa/:id PUT]', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

/** DELETE /api/siswa/:id — admin. 409 jika masih punya setoran */
export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const auth = await requireAdmin()
    if (auth.response) return auth.response
    const { id } = await params

    const existing = await db.siswa.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Siswa tidak ditemukan' }, { status: 404 })
    }

    const setoranCount = await db.setoran.count({ where: { siswaId: id } })
    if (setoranCount > 0) {
      return NextResponse.json(
        { error: 'Siswa masih memiliki data setoran. Hapus setoran terlebih dahulu.' },
        { status: 409 }
      )
    }

    await db.siswa.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[siswa/:id DELETE]', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

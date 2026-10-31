import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { requireAdmin, requireAuth } from '@/lib/auth'
import {
  getHalaqohIdsForMusyrif,
  isUniqueViolation,
  mapSiswa,
  siswaInclude,
} from '@/app/api/_lib/shared'

/** GET /api/siswa — auth. Urut nama asc.
 *  Query opsional: halaqohId → filter halaqoh.
 *  Musyrif hanya menerima siswa dari halaqoh yang dia bina. */
export async function GET(request: Request) {
  try {
    const auth = await requireAuth()
    if (auth.response) return auth.response
    const user = auth.user

    const url = new URL(request.url)
    const halaqohIdParam = url.searchParams.get('halaqohId') || undefined

    const where: Prisma.SiswaWhereInput = {}
    if (halaqohIdParam) where.halaqohId = halaqohIdParam
    if (user.role === 'musyrif' && user.musyrifId) {
      const scopeIds = await getHalaqohIdsForMusyrif(user.musyrifId)
      where.AND = [{ halaqohId: { in: scopeIds } }]
    }

    const siswa = await db.siswa.findMany({
      where,
      orderBy: { nama: 'asc' },
      include: siswaInclude,
    })
    return NextResponse.json({ siswa: siswa.map(mapSiswa) })
  } catch (e) {
    console.error('[siswa GET]', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

/** POST /api/siswa — admin. 409 jika NIS duplikat */
export async function POST(request: Request) {
  try {
    const auth = await requireAdmin()
    if (auth.response) return auth.response

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const nis = typeof body.nis === 'string' ? body.nis.trim() : ''
    const kelas = typeof body.kelas === 'string' ? body.kelas.trim() : ''
    const nama = typeof body.nama === 'string' ? body.nama.trim() : ''
    const programId = typeof body.programId === 'string' ? body.programId.trim() : ''
    const halaqohIdRaw = typeof body.halaqohId === 'string' ? body.halaqohId.trim() : ''

    if (!nis || !kelas || !nama || !programId) {
      return NextResponse.json(
        { error: 'NIS, kelas, nama, dan program wajib diisi' },
        { status: 400 }
      )
    }

    const dupNis = await db.siswa.findUnique({ where: { nis } })
    if (dupNis) {
      return NextResponse.json({ error: 'NIS sudah terdaftar' }, { status: 409 })
    }

    const program = await db.program.findUnique({ where: { id: programId } })
    if (!program) {
      return NextResponse.json({ error: 'Program tidak ditemukan' }, { status: 400 })
    }

    let halaqohId: string | null = null
    if (halaqohIdRaw !== '') {
      const halaqoh = await db.halaqoh.findUnique({ where: { id: halaqohIdRaw } })
      if (!halaqoh) {
        return NextResponse.json({ error: 'Halaqoh tidak ditemukan' }, { status: 400 })
      }
      halaqohId = halaqoh.id
    }

    const created = await db.siswa.create({
      data: { nis, kelas, nama, programId, halaqohId },
    })

    const siswa = await db.siswa.findUnique({
      where: { id: created.id },
      include: siswaInclude,
    })
    if (!siswa) {
      return NextResponse.json({ error: 'Gagal menambahkan siswa' }, { status: 500 })
    }
    return NextResponse.json({ siswa: mapSiswa(siswa) })
  } catch (e) {
    if (isUniqueViolation(e)) {
      return NextResponse.json({ error: 'NIS sudah terdaftar' }, { status: 409 })
    }
    console.error('[siswa POST]', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { requireAdmin, requireAuth } from '@/lib/auth'
import {
  getHalaqohIdsForMusyrif,
  halaqohInclude,
  isUniqueViolation,
  mapHalaqoh,
  nextKode,
} from '@/app/api/_lib/shared'

/** GET /api/halaqoh — auth. Urut createdAt asc.
 *  Query opsional: programId → filter program.
 *  Musyrif otomatis hanya menerima halaqoh yang dia bina. */
export async function GET(request: Request) {
  try {
    const auth = await requireAuth()
    if (auth.response) return auth.response
    const user = auth.user

    const url = new URL(request.url)
    const programId = url.searchParams.get('programId') || undefined

    const where: Prisma.HalaqohWhereInput = {}
    if (programId) where.programId = programId

    if (user.role === 'musyrif' && user.musyrifId) {
      const scopeIds = await getHalaqohIdsForMusyrif(user.musyrifId)
      where.id = { in: scopeIds }
    }

    const halaqoh = await db.halaqoh.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      include: halaqohInclude,
    })
    return NextResponse.json({ halaqoh: halaqoh.map(mapHalaqoh) })
  } catch (e) {
    console.error('[halaqoh GET]', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

/** POST /api/halaqoh — admin. Kode auto-generate HLQ-001, HLQ-002, ... */
export async function POST(request: Request) {
  try {
    const auth = await requireAdmin()
    if (auth.response) return auth.response

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const nama = typeof body.nama === 'string' ? body.nama.trim() : ''
    const programId = typeof body.programId === 'string' ? body.programId.trim() : ''
    const musyrifIds = Array.isArray(body.musyrifIds) ? body.musyrifIds : null

    if (!nama || !programId) {
      return NextResponse.json(
        { error: 'Nama halaqoh dan program wajib diisi' },
        { status: 400 }
      )
    }
    if (musyrifIds === null) {
      return NextResponse.json(
        { error: 'Daftar musyrif tidak valid (harus berupa array)' },
        { status: 400 }
      )
    }

    const program = await db.program.findUnique({ where: { id: programId } })
    if (!program) {
      return NextResponse.json({ error: 'Program tidak ditemukan' }, { status: 400 })
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

    const kode = await nextKode('HLQ')
    const created = await db.halaqoh.create({
      data: {
        kode,
        nama,
        programId,
        musyrif: { create: uniqueIds.map((musyrifId) => ({ musyrifId })) },
      },
    })

    const halaqoh = await db.halaqoh.findUnique({
      where: { id: created.id },
      include: halaqohInclude,
    })
    if (!halaqoh) {
      return NextResponse.json({ error: 'Gagal membuat halaqoh' }, { status: 500 })
    }
    return NextResponse.json({ halaqoh: mapHalaqoh(halaqoh) })
  } catch (e) {
    if (isUniqueViolation(e)) {
      return NextResponse.json(
        { error: 'Kode halaqoh sudah ada, silakan coba lagi' },
        { status: 409 }
      )
    }
    console.error('[halaqoh POST]', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

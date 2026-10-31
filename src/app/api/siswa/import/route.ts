import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { isUniqueViolation } from '@/app/api/_lib/shared'

const MAX_ROWS = 1000

interface ImportRow {
  nis: string
  nama: string
  kelas: string
  program: string
  halaqoh: string
}

interface RowResult {
  row: number
  nis: string
  nama: string
  status: 'ok' | 'error'
  reason?: string
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

/** POST /api/siswa/import — admin. Import massal data siswa.
 *  Body: { rows: [{ nis, nama, kelas, program, halaqoh }] } (program & halaqoh = NAMA).
 *  Validasi per baris: field wajib, program/halaqoh cocok dengan DB,
 *  halaqoh harus milik program tsb, NIS unik (DB + dalam batch).
 *  Baris valid diimpor, baris gagal dilaporkan. */
export async function POST(request: Request) {
  try {
    const auth = await requireAdmin()
    if (auth.response) return auth.response

    const body = (await request.json().catch(() => ({}))) as { rows?: unknown }
    const rawRows = Array.isArray(body.rows) ? body.rows : []
    if (rawRows.length === 0) {
      return NextResponse.json({ error: 'Tidak ada data untuk diimpor' }, { status: 400 })
    }
    if (rawRows.length > MAX_ROWS) {
      return NextResponse.json(
        { error: `Maksimal ${MAX_ROWS} baris per import` },
        { status: 400 }
      )
    }

    // Normalisasi input mentah
    const rows: ImportRow[] = rawRows.map((r) => {
      const o = (r ?? {}) as Record<string, unknown>
      return {
        nis: str(o.nis),
        nama: str(o.nama),
        kelas: str(o.kelas),
        program: str(o.program),
        halaqoh: str(o.halaqoh),
      }
    })

    // Muat referensi program & halaqoh sekaligus
    const [programs, halaqohList, existingSiswa] = await Promise.all([
      db.program.findMany({ select: { id: true, nama: true } }),
      db.halaqoh.findMany({ select: { id: true, nama: true, programId: true } }),
      db.siswa.findMany({ select: { nis: true } }),
    ])

    const findProgram = (name: string) => {
      const exact = programs.find((p) => p.nama === name)
      if (exact) return exact
      const lower = name.toLowerCase()
      return programs.find((p) => p.nama.toLowerCase() === lower)
    }
    const findHalaqoh = (name: string) => {
      const exact = halaqohList.find((h) => h.nama === name)
      if (exact) return exact
      const lower = name.toLowerCase()
      return halaqohList.find((h) => h.nama.toLowerCase() === lower)
    }

    const existingNis = new Set(existingSiswa.map((s) => s.nis))
    const batchNis = new Set<string>()
    const results: RowResult[] = []
    const toCreate: { nis: string; nama: string; kelas: string; programId: string; halaqohId: string | null }[] = []

    rows.forEach((row, idx) => {
      const rowNo = idx + 1 // nomor baris data (setelah header)
      const fail = (reason: string) =>
        results.push({ row: rowNo, nis: row.nis, nama: row.nama, status: 'error', reason })

      if (!row.nis && !row.nama && !row.kelas && !row.program) return // baris kosong: lewati
      if (!row.nis) return fail('NIS kosong')
      if (!row.nama) return fail('Nama kosong')
      if (!row.kelas) return fail('Kelas kosong')
      if (!row.program) return fail('Program kosong')

      if (existingNis.has(row.nis)) return fail(`NIS ${row.nis} sudah terdaftar di database`)
      if (batchNis.has(row.nis)) return fail(`NIS ${row.nis} duplikat dalam data import`)

      const program = findProgram(row.program)
      if (!program) return fail(`Program "${row.program}" tidak ditemukan`)

      let halaqohId: string | null = null
      if (row.halaqoh) {
        const halaqoh = findHalaqoh(row.halaqoh)
        if (!halaqoh) return fail(`Halaqoh "${row.halaqoh}" tidak ditemukan`)
        if (halaqoh.programId !== program.id) {
          return fail(`Halaqoh "${row.halaqoh}" bukan milik program "${program.nama}"`)
        }
        halaqohId = halaqoh.id
      }

      batchNis.add(row.nis)
      toCreate.push({
        nis: row.nis,
        nama: row.nama,
        kelas: row.kelas,
        programId: program.id,
        halaqohId,
      })
      results.push({ row: rowNo, nis: row.nis, nama: row.nama, status: 'ok' })
    })

    let imported = 0
    if (toCreate.length > 0) {
      await db.$transaction(async (tx) => {
        for (const data of toCreate) {
          await tx.siswa.create({ data })
          imported += 1
        }
      })
    }

    const failed = results.filter((r) => r.status === 'error').length
    return NextResponse.json({ imported, failed, results })
  } catch (e) {
    if (isUniqueViolation(e)) {
      return NextResponse.json({ error: 'NIS sudah terdaftar' }, { status: 409 })
    }
    console.error('[siswa import POST]', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

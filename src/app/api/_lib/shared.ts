import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import type { HalaqohItem, SetoranItem, SiswaItem, TipeInputan } from '@/lib/types'

/** Ambil daftar id halaqoh yang dibina seorang musyrif (untuk scoping) */
export async function getHalaqohIdsForMusyrif(musyrifId: string): Promise<string[]> {
  const rows = await db.halaqohMusyrif.findMany({
    where: { musyrifId },
    select: { halaqohId: true },
  })
  return rows.map((r) => r.halaqohId)
}

/** Kode auto-increment: PGM-001 / HLQ-001 (cari max existing, +1, padStart 3) */
export async function nextKode(prefix: 'PGM' | 'HLQ'): Promise<string> {
  const rows =
    prefix === 'PGM'
      ? await db.program.findMany({ select: { kode: true } })
      : await db.halaqoh.findMany({ select: { kode: true } })
  let max = 0
  for (const row of rows) {
    const m = /(\d+)$/.exec(row.kode)
    if (m) {
      const n = parseInt(m[1], 10)
      if (Number.isFinite(n) && n > max) max = n
    }
  }
  return `${prefix}-${String(max + 1).padStart(3, '0')}`
}

// ===== Setoran =====

export const setoranInclude = {
  siswa: { select: { nama: true, nis: true } },
  program: { select: { nama: true } },
  musyrif: { select: { namaLengkap: true } },
} satisfies Prisma.SetoranInclude

export type SetoranWithRelations = Prisma.SetoranGetPayload<{ include: typeof setoranInclude }>

/** Map Setoran (dengan relasi) → bentuk FLAT SetoranItem sesuai kontrak */
export function mapSetoranFlat(s: SetoranWithRelations): SetoranItem {
  return {
    id: s.id,
    tipe: s.tipe as TipeInputan,
    tanggal: s.tanggal,
    hari: s.hari,
    siswaId: s.siswaId,
    siswaNama: s.siswa?.nama ?? '',
    siswaNis: s.siswa?.nis ?? '',
    programNama: s.program?.nama ?? '',
    musyrifId: s.musyrifId,
    musyrifNama: s.musyrif?.namaLengkap ?? null,
    menuSetoran: s.menuSetoran,
    juz: s.juz,
    surat: s.surat,
    ayat: s.ayat,
    anaba: s.anaba,
    halaman: s.halaman,
    halamanMushaf: s.halamanMushaf,
    jumlahBaris: s.jumlahBaris,
    nilaiKelancaran: s.nilaiKelancaran,
    kualitasBacaan: s.kualitasBacaan,
    nilai: s.nilai,
    materiBelajar: s.materiBelajar,
    catatanMusyrif: s.catatanMusyrif,
  }
}

// ===== Siswa =====

export const siswaInclude = {
  program: { select: { nama: true, tipeInputan: true } },
  halaqoh: { select: { nama: true } },
} satisfies Prisma.SiswaInclude

export type SiswaWithRelations = Prisma.SiswaGetPayload<{ include: typeof siswaInclude }>

export function mapSiswa(s: SiswaWithRelations): SiswaItem {
  return {
    id: s.id,
    nis: s.nis,
    kelas: s.kelas,
    nama: s.nama,
    programId: s.programId,
    programNama: s.program?.nama ?? '',
    tipeInputan: (s.program?.tipeInputan ?? '') as TipeInputan,
    halaqohId: s.halaqohId,
    halaqohNama: s.halaqoh?.nama ?? null,
    fotoUrl: s.fotoUrl,
  }
}

// ===== Halaqoh =====

export const halaqohInclude = {
  program: { select: { nama: true } },
  musyrif: { include: { musyrif: { select: { id: true, namaLengkap: true } } } },
  _count: { select: { siswa: true } },
} satisfies Prisma.HalaqohInclude

export type HalaqohWithRelations = Prisma.HalaqohGetPayload<{ include: typeof halaqohInclude }>

export function mapHalaqoh(h: HalaqohWithRelations): HalaqohItem {
  return {
    id: h.id,
    kode: h.kode,
    nama: h.nama,
    programId: h.programId,
    programNama: h.program?.nama ?? '',
    musyrif: h.musyrif.map((hm) => ({
      id: hm.musyrif?.id ?? '',
      namaLengkap: hm.musyrif?.namaLengkap ?? '',
    })),
    jumlahSiswa: h._count?.siswa ?? 0,
  }
}

// ===== Parser body sederhana =====

/** String → trim; kosong/null → null */
export function toStrOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

/** Angka (atau string angka) → Int; kosong/tidak valid → null */
export function toIntOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : parseInt(String(v).trim(), 10)
  return Number.isFinite(n) ? n : null
}

export function isTipeValid(t: unknown): t is TipeInputan {
  return t === 'A' || t === 'B' || t === 'C' || t === 'D'
}

/** Deteksi error unique constraint Prisma (P2002) */
export function isUniqueViolation(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: unknown }).code === 'P2002'
}

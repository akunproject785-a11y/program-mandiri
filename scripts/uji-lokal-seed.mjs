/**
 * Seed DB uji lokal (SQLite) — mirror data produksi untuk alur musyrif Amanda:
 * Program PGM-001 + Halaqoh Khadijah + 11 siswa, TANPA absen/setoran hari ini
 * (keadaan "belum diabsen" untuk menguji gerbang popup).
 *
 * Sumber: scripts/uji-lokal-data/*.json (hasil tarikan API produksi via sesi
 * amanda) + authUserId hasil password grant Supabase.
 * Jalankan: bun scripts/uji-lokal-seed.mjs  (setelah prisma generate sqlite)
 */
import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const dir = join(dirname(fileURLToPath(import.meta.url)), 'uji-lokal-data')
const baca = (f) => JSON.parse(readFileSync(join(dir, f), 'utf8'))

const AUTH_USER_ID = '5e1c0174-f193-4115-9f02-30e3ef834193' // amanda@quranmandiri.id
const MUSYRIF_ID = 'cmvqs22ju0004om0aq00wehdv'

const db = new PrismaClient()

async function main() {
  const program = baca('progs.json').programs[0]
  const halaqoh = baca('halaqoh.json').halaqoh[0]
  const siswa = baca('siswa.json').siswa

  await db.halaqohMusyrif.deleteMany({})
  await db.absensiSiswa.deleteMany({})
  await db.setoran.deleteMany({})
  await db.siswa.deleteMany({})
  await db.halaqoh.deleteMany({})
  await db.program.deleteMany({})
  await db.musyrif.deleteMany({})
  await db.admin.deleteMany({})
  await db.setting.deleteMany({})

  await db.program.create({
    data: {
      id: program.id,
      kode: program.kode,
      nama: program.nama,
      tipeInputan: program.tipeInputan,
      targetHafalan: program.targetHafalan,
    },
  })
  await db.halaqoh.create({
    data: { id: halaqoh.id, kode: halaqoh.kode, nama: halaqoh.nama, programId: program.id },
  })
  await db.musyrif.create({
    data: {
      id: MUSYRIF_ID,
      nik: 'UJI-AMANDA-01',
      namaLengkap: 'Ustadzah Amanda Putri',
      email: 'amanda@quranmandiri.id',
      username: 'amanda',
      authUserId: AUTH_USER_ID,
    },
  })
  await db.halaqohMusyrif.create({
    data: { halaqohId: halaqoh.id, musyrifId: MUSYRIF_ID },
  })
  for (const s of siswa) {
    await db.siswa.create({
      data: {
        id: s.id,
        nis: s.nis,
        nama: s.nama,
        kelas: s.kelas,
        programId: s.programId,
        halaqohId: s.halaqohId,
        fotoUrl: s.fotoUrl ?? null,
      },
    })
  }
  console.log(`seed selesai: 1 program, 1 halaqoh, 1 musyrif, ${siswa.length} siswa, 0 absen/setoran`)
}

main()
  .catch((e) => {
    console.error('seed gagal:', e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())

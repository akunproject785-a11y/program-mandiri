import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import type { SettingsData } from '@/lib/types'

/** Nilai default (sama dengan prisma/seed.ts) */
const DEFAULT_SETTINGS: SettingsData = {
  heroBadge: "Tahfidz Al-Qur'an",
  heroTitle: "Program Qur'an Mandiri",
  heroSubtitle:
    'Membangun Generasi Penghafal Al-Qur\u2019an yang Mandiri, Berilmu, dan Berakhlak Mulia',
  heroDescription:
    'Platform pencatatan setoran tahfidz yang terpadu — kelola program kelas, halaqoh, musyrif, dan data siswa dalam satu dashboard yang mudah digunakan.',
  aboutTitle: 'Tentang Program',
  aboutText:
    "Program Qur'an Mandiri adalah program pembinaan hafalan Al-Qur'an yang terstruktur. Setiap pertemuan, musyrif mencatat setoran hafalan santri melalui form yang telah disesuaikan dengan tipe program masing-masing, lengkap dengan penilaian kelancaran, kualitas bacaan, dan catatan pembinaan. Seluruh rekapitulasi dapat dipantau secara real-time untuk memastikan target hafalan tercapai.",
}

const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS) as (keyof SettingsData)[]

/** Baca semua row Setting, merge dengan default → SettingsData */
async function readSettings(): Promise<SettingsData> {
  const merged: SettingsData = { ...DEFAULT_SETTINGS }
  const rows = await db.setting.findMany()
  for (const row of rows) {
    if ((SETTING_KEYS as string[]).includes(row.key)) {
      merged[row.key as keyof SettingsData] = row.value
    }
  }
  return merged
}

/** GET /api/settings — PUBLIK (untuk landing page) */
export async function GET() {
  try {
    const settings = await readSettings()
    return NextResponse.json({ settings })
  } catch (e) {
    console.error('[settings GET]', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

/** PUT /api/settings — admin. Body: partial SettingsData (whitelist key) */
export async function PUT(request: Request) {
  try {
    const auth = await requireAdmin()
    if (auth.response) return auth.response

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    for (const key of SETTING_KEYS) {
      const value = body[key]
      if (value === undefined || value === null) continue
      await db.setting.upsert({
        where: { key },
        create: { key, value: String(value) },
        update: { value: String(value) },
      })
    }

    const settings = await readSettings()
    return NextResponse.json({ settings })
  } catch (e) {
    console.error('[settings PUT]', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

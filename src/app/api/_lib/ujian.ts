import { db } from '@/lib/db'

/** Key Setting yang menyimpan status aktivasi menu Ujian musyrif ('1' aktif). */
export const KEY_UJIAN_AKTIF = 'ujian_musyrif_aktif'

/** Key Setting tahun ajaran aktif untuk data ujian (mis. '2026/2027'; '' = belum diatur). */
export const KEY_TAHUN_AJARAN = 'ujian_tahun_ajaran'

/** Baca status aktivasi menu Ujian dari tabel Setting. */
export async function bacaUjianAktif(): Promise<boolean> {
  const row = await db.setting.findUnique({ where: { key: KEY_UJIAN_AKTIF } })
  return row?.value === '1'
}

/** Baca tahun ajaran aktif untuk data ujian ('' berarti belum diatur admin). */
export async function bacaTahunAjaran(): Promise<string> {
  const row = await db.setting.findUnique({ where: { key: KEY_TAHUN_AJARAN } })
  return row?.value ?? ''
}

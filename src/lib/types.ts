export type Role = 'admin' | 'musyrif'

export type TipeInputan = 'A' | 'B' | 'C' | 'D'

export interface UserInfo {
  id: string
  name: string
  role: Role
  musyrifId?: string
}

export interface Program {
  id: string
  kode: string
  nama: string
  tipeInputan: TipeInputan
  targetHafalan: string
}

export interface MusyrifItem {
  id: string
  nik: string
  namaLengkap: string
  email: string
  username: string | null
}

export interface HalaqohItem {
  id: string
  kode: string
  nama: string
  programId: string
  programNama: string
  musyrif: { id: string; namaLengkap: string }[]
  jumlahSiswa: number
}

export interface SiswaItem {
  id: string
  nis: string
  kelas: string
  nama: string
  programId: string
  programNama: string
  tipeInputan: TipeInputan
  halaqohId: string | null
  halaqohNama: string | null
  fotoUrl: string | null
}

export interface SetoranItem {
  id: string
  tipe: TipeInputan
  tanggal: string
  hari: string
  siswaId: string
  siswaNama: string
  siswaNis: string
  programNama: string
  /** ID musyrif pencatat (null jika dicatat admin) — dipakai untuk izin edit/hapus. */
  musyrifId: string | null
  musyrifNama: string | null
  // field umum per tipe
  menuSetoran?: string | null
  juz?: number | null
  surat?: string | null
  ayat?: string | null
  anaba?: string | null
  halaman?: string | null
  halamanMushaf?: string | null
  jumlahBaris?: number | null
  nilaiKelancaran?: string | null
  kualitasBacaan?: string | null
  nilai?: string | null
  materiBelajar?: string | null
  catatanMusyrif?: string | null
}

// ===== Setoran terakhir per siswa (semua jenis) =====

/** Satu entri catatan terakhir untuk satu jenis setoran. */
export interface TerakhirJenisEntry {
  /** Nama jenis: menu setoran untuk tipe C/D ('Ziyadah'|'Murojaah'|'Tilawah'), 'Anaba' untuk tipe A, 'Materi' untuk tipe B. */
  jenis: string
  setoran: SetoranItem
}

/** Info setoran terakhir seorang siswa — agar musyrif tahu titik lanjutan setoran. */
export interface SiswaTerakhirInfo {
  /** Setoran terakhir keseluruhan (tanggal paling baru). */
  terakhir: SetoranItem | null
  /** Catatan terakhir untuk SETIAP jenis setoran, urut dari yang terbaru. */
  perJenis: TerakhirJenisEntry[]
  /** Total setoran yang pernah dicatat untuk siswa ini. */
  total: number
}

/** Map siswaId → info setoran terakhir. */
export type TerakhirMap = Record<string, SiswaTerakhirInfo>

export interface SettingsData {
  heroBadge: string
  heroTitle: string
  heroSubtitle: string
  heroDescription: string
  aboutTitle: string
  aboutText: string
}

/** Halaqoh binaan milik seorang musyrif (untuk ringkasan musyrif). */
export interface HalaqohSayaItem {
  id: string
  kode: string
  nama: string
  programNama: string
  tipeInputan: TipeInputan
  jumlahSiswa: number
}

/** Distribusi setoran per program kelas (pengganti distribusi per tipe). */
export interface PerProgramItem {
  id: string
  nama: string
  jumlah: number
}

export interface SummaryData {
  totalSiswa: number
  totalMusyrif: number
  totalHalaqoh: number
  totalProgram: number
  totalSetoran: number
  setoranBulanIni: number
  perTipe: { A: number; B: number; C: number; D: number }
  /** Distribusi setoran per program kelas (urut jumlah terbanyak). */
  perProgram: PerProgramItem[]
  recentSetoran: SetoranItem[]
  /** Khusus musyrif: daftar halaqoh binaannya (tidak ada pada respons admin). */
  halaqohSaya?: HalaqohSayaItem[]
  /** Khusus musyrif: jumlah program unik yang diampu (tidak ada pada respons admin). */
  programDiampu?: number
}

export interface StatsData {
  siswa: number
  musyrif: number
  halaqoh: number
  setoran: number
}

// ===== Rekapan bulanan per siswa =====

/** Satu baris rekap bulanan untuk satu siswa (urut NIS dari server). */
export interface RekapBulananSiswa {
  siswaId: string
  nis: string
  nama: string
  kelas: string
  halaqohNama: string | null
  programNama: string
  /** Jumlah catatan setoran pada bulan terpilih. */
  jumlahSetoran: number
  /** Penjumlahan field "jumlahBaris" seluruh setoran pada bulan terpilih. */
  totalBaris: number
  /** Setoran AWAL bulan: catatan pertama bulan terpilih (urut tanggal, lalu waktu dibuat). */
  awal: SetoranItem | null
  /** Setoran AKHIR bulan: catatan terakhir bulan terpilih. */
  akhir: SetoranItem | null
}

/** Respons GET /api/setoran/rekap-bulanan. */
export interface RekapBulananData {
  bulan: number
  tahun: number
  /** Label bulan, mis. "Oktober 2026". */
  labelBulan: string
  /** Jumlah siswa yang memiliki setoran pada bulan terpilih. */
  jumlahSiswa: number
  totalSetoran: number
  totalBaris: number
  rekap: RekapBulananSiswa[]
}

// ===== Konstanta bersama =====

export const TIPE_OPTIONS: TipeInputan[] = ['A', 'B', 'C', 'D']

export const TIPE_LABEL: Record<TipeInputan, string> = {
  A: 'Type A — Tahsin Anaba',
  B: 'Type B — Materi Belajar',
  C: 'Type C — Tahfidz Juz 30',
  D: 'Type D — Murojaah Juz',
}

export const MENU_SETORAN_C = ['Ziyadah', 'Murojaah', 'Tilawah']
export const MENU_SETORAN_D = ['Murojaah', 'Ziyadah', 'Tilawah']

export const NILAI_OPTIONS = [
  'A - Sangat Baik',
  'B - Baik',
  'C - Cukup',
  'D - Perlu Bimbingan',
]

export const HARI_INDO = [
  'Minggu',
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu',
]

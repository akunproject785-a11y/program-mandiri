'use client'

/**
 * Section "Input Setoran" (khusus musyrif) — alur bertahap:
 *  1. Ikon Program yang DITUGASKAN ke akun musyrif ini (via halaqoh binaan)
 *  2. Pilih Halaqoh binaan pada program tersebut
 *  3. Daftar siswa halaqoh — setiap siswa menampilkan CATATAN SETORAN
 *     TERAKHIR untuk SEMUA jenis (Ziyadah/Murojaah/Tilawah/Anaba/Materi)
 *     agar musyrif tahu titik lanjutan setoran.
 *
 * Input setoran siswa dibuka dalam bentuk POPUP (SetoranSiswaPopup) berisi
 * panel "Setoran Terakhir — semua jenis" (dengan aksi edit/hapus catatan yang
 * direkam sendiri) + form dinamis sesuai tipe program.
 *
 * Setiap langkah komponennya terpisah & termount ulang saat dipilih, sehingga
 * state fetch selalu segar tanpa reset manual.
 */
import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  BookMarked,
  Check,
  ChevronRight,
  FileText,
  FolderOpen,
  History,
  Network,
  RotateCcw,
  Search,
  Star,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { api } from '@/lib/client'
import { cn } from '@/lib/utils'
import {
  type HalaqohItem,
  type Program,
  type SiswaItem,
  type SiswaTerakhirInfo,
  type TipeInputan,
  type TerakhirMap,
  type UserInfo,
} from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  EmptyState,
  LoadingBlock,
  SectionHeader,
} from '@/components/dashboard/ui-helpers'
import SetoranTerakhirList from '@/components/dashboard/setoran-terakhir'
import SetoranSiswaPopup from '@/components/dashboard/setoran-siswa-popup'

const TIPE_ICON: Record<TipeInputan, LucideIcon> = {
  A: FileText,
  B: BookMarked,
  C: Star,
  D: RotateCcw,
}

const STEPS = [
  { n: 1, label: 'Program' },
  { n: 2, label: 'Halaqoh' },
  { n: 3, label: 'Siswa' },
] as const

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.charAt(0) ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? '') : (parts[0]?.charAt(1) ?? '')
  return (first + last).toUpperCase() || '?'
}

/** Tombol kartu pilihan (program/halaqoh) — area sentuh & hover jelas. */
function PickCard({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full min-h-11 flex-col rounded-xl border bg-card p-4 text-left shadow-sm transition-all hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
    </button>
  )
}

/** Langkah 1: ikon program yang ditugaskan untuk musyrif ini. */
function ProgramStep({ onSelect }: { onSelect: (p: Program) => void }) {
  const [programs, setPrograms] = useState<Program[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let mounted = true
    api<{ programs: Program[] }>('/api/programs?scope=assigned')
      .then((data) => {
        if (mounted) setPrograms(data.programs)
      })
      .catch((err: Error) => {
        if (mounted) setError(err.message)
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [reloadKey])

  if (loading) return <LoadingBlock label="Memuat program…" />

  if (error) {
    return (
      <EmptyState
        icon={<AlertTriangle />}
        title="Gagal memuat program"
        description={error}
      >
        <Button onClick={() => setReloadKey((k) => k + 1)} className="min-h-11 sm:min-h-9">
          Coba Lagi
        </Button>
      </EmptyState>
    )
  }

  if (programs.length === 0) {
    return (
      <EmptyState
        icon={<FolderOpen />}
        title="Belum ada program yang ditugaskan"
        description="Anda belum menjadi pembina halaqoh pada program mana pun. Hubungi admin untuk penugasan melalui menu Data Halaqoh."
      />
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {programs.map((p) => {
        const Icon = TIPE_ICON[p.tipeInputan] ?? FolderOpen
        return (
          <PickCard key={p.id} onClick={() => onSelect(p)}>
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <p className="mt-3 font-semibold leading-snug">{p.nama}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{p.kode}</p>
            <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
              Target: {p.targetHafalan}
            </p>
          </PickCard>
        )
      })}
    </div>
  )
}

/** Langkah 2: pilihan halaqoh binaan pada program terpilih. */
function HalaqohStep({
  program,
  onBack,
  onSelect,
}: {
  program: Program
  onBack: () => void
  onSelect: (h: HalaqohItem) => void
}) {
  const [halaqoh, setHalaqoh] = useState<HalaqohItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let mounted = true
    api<{ halaqoh: HalaqohItem[] }>(`/api/halaqoh?programId=${encodeURIComponent(program.id)}`)
      .then((data) => {
        if (mounted) setHalaqoh(data.halaqoh)
      })
      .catch((err: Error) => {
        if (mounted) setError(err.message)
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [reloadKey, program.id])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold">Pilih Halaqoh</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Halaqoh binaan Anda pada program <span className="font-medium">{program.nama}</span>.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onBack} className="min-h-11 sm:min-h-9">
          <ArrowLeft className="h-4 w-4" />
          Ganti Program
        </Button>
      </div>

      {loading ? (
        <LoadingBlock label="Memuat halaqoh…" />
      ) : error ? (
        <EmptyState icon={<AlertTriangle />} title="Gagal memuat halaqoh" description={error}>
          <Button onClick={() => setReloadKey((k) => k + 1)} className="min-h-11 sm:min-h-9">
            Coba Lagi
          </Button>
        </EmptyState>
      ) : halaqoh.length === 0 ? (
        <EmptyState
          icon={<Network />}
          title="Belum ada halaqoh binaan"
          description={`Anda belum membina halaqoh pada program ${program.nama}. Hubungi admin untuk penugasan.`}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {halaqoh.map((h) => (
            <PickCard key={h.id} onClick={() => onSelect(h)}>
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
                  <Users className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{h.nama}</p>
                  <p className="text-xs text-muted-foreground">{h.kode}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <Badge variant="secondary" className="font-normal">
                  {h.jumlahSiswa} siswa
                </Badge>
                <span className="text-xs text-muted-foreground inline-flex items-center gap-0.5">
                  Pilih <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                </span>
              </div>
            </PickCard>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Langkah 3: daftar siswa halaqoh (dengan pencarian). Setiap siswa menampilkan
 * catatan setoran terakhir SEMUA jenis; klik siswa → popup input setoran.
 */
function SiswaStep({
  halaqoh,
  onBack,
  onSelect,
}: {
  halaqoh: HalaqohItem
  onBack: () => void
  onSelect: (s: SiswaItem, terakhir: SiswaTerakhirInfo | null) => void
}) {
  const [siswaList, setSiswaList] = useState<SiswaItem[]>([])
  const [terakhirMap, setTerakhirMap] = useState<TerakhirMap>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [search, setSearch] = useState('')

  useEffect(() => {
    let mounted = true
    const qHalaqoh = `halaqohId=${encodeURIComponent(halaqoh.id)}`
    Promise.all([
      api<{ siswa: SiswaItem[] }>(`/api/siswa?${qHalaqoh}`),
      api<{ terakhir: TerakhirMap }>(`/api/siswa/terakhir?${qHalaqoh}`),
    ])
      .then(([s, t]) => {
        if (!mounted) return
        setSiswaList(s.siswa)
        setTerakhirMap(t.terakhir ?? {})
      })
      .catch((err: Error) => {
        if (mounted) setError(err.message)
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [reloadKey, halaqoh.id])

  const q = search.trim().toLowerCase()
  const filtered = q
    ? siswaList.filter((s) => s.nama.toLowerCase().includes(q) || s.nis.includes(q))
    : siswaList

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold">Pilih Siswa</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Siswa halaqoh <span className="font-medium">{halaqoh.nama}</span>. Klik siswa untuk
            membuka popup input setoran.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onBack} className="min-h-11 sm:min-h-9">
          <ArrowLeft className="h-4 w-4" />
          Ganti Halaqoh
        </Button>
      </div>

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari nama atau NIS…"
          aria-label="Cari siswa"
          className="min-h-11 pl-9"
        />
      </div>

      {loading ? (
        <LoadingBlock label="Memuat siswa…" />
      ) : error ? (
        <EmptyState icon={<AlertTriangle />} title="Gagal memuat siswa" description={error}>
          <Button onClick={() => setReloadKey((k) => k + 1)} className="min-h-11 sm:min-h-9">
            Coba Lagi
          </Button>
        </EmptyState>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title={q ? 'Tidak ada siswa yang cocok' : 'Belum ada siswa'}
          description={
            q
              ? 'Coba kata kunci lain (nama atau NIS).'
              : 'Halaqoh ini belum memiliki siswa. Admin dapat menambahkannya melalui menu Data Siswa.'
          }
        />
      ) : (
        <div className="rounded-xl border bg-card shadow-sm">
          <ul className="max-h-96 divide-y overflow-y-auto [scrollbar-width:thin]">
            {filtered.map((s) => {
              const terakhir = terakhirMap[s.id] ?? null
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(s, terakhir)}
                    className="flex w-full min-h-11 items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:bg-muted/60 sm:px-4"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                      {getInitials(s.nama)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="truncate text-sm font-medium">{s.nama}</span>
                        {terakhir && terakhir.total > 0 ? (
                          <Badge variant="secondary" className="font-normal">
                            <History className="h-3 w-3" aria-hidden />
                            {terakhir.total} setoran
                          </Badge>
                        ) : null}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        NIS {s.nis} • {s.kelas}
                      </span>
                      {/* Catatan setoran terakhir — SEMUA jenis (Ziyadah/Murojaah/Tilawah/…) */}
                      <SetoranTerakhirList info={terakhir} variant="row" />
                    </span>
                    <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden />
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

export default function InputSetoranSection({ user }: { user: UserInfo }) {
  const [step, setStep] = useState(1)
  const [program, setProgram] = useState<Program | null>(null)
  const [halaqoh, setHalaqoh] = useState<HalaqohItem | null>(null)

  // Popup input setoran siswa
  const [popupOpen, setPopupOpen] = useState(false)
  const [popupSiswa, setPopupSiswa] = useState<SiswaItem | null>(null)
  const [popupTerakhir, setPopupTerakhir] = useState<SiswaTerakhirInfo | null>(null)
  /** Naikkan setiap setoran tersimpan → daftar siswa termount ulang & data terakhir segar. */
  const [savedKey, setSavedKey] = useState(0)

  const goToStep = (n: number) => {
    if (n >= step) return
    if (n <= 1) setProgram(null)
    setHalaqoh(null)
    setStep(n)
  }

  const handleSelectProgram = (p: Program) => {
    setProgram(p)
    setHalaqoh(null)
    setStep(2)
  }

  const handleSelectHalaqoh = (h: HalaqohItem) => {
    setHalaqoh(h)
    setStep(3)
  }

  const handleSelectSiswa = (s: SiswaItem, terakhir: SiswaTerakhirInfo | null) => {
    setPopupSiswa(s)
    setPopupTerakhir(terakhir)
    setPopupOpen(true)
  }

  /** Setelah simpan: tutup popup & muat ulang daftar siswa (catatan terakhir diperbarui). */
  const handleSaved = () => {
    setPopupOpen(false)
    setPopupSiswa(null)
    setPopupTerakhir(null)
    setSavedKey((k) => k + 1)
  }

  const stepSub: Record<number, string> = {
    1: 'Program yang ditugaskan untuk akun Anda.',
    2: program ? `Halaqoh binaan Anda pada program ${program.nama}.` : '',
    3: halaqoh
      ? `Siswa pada halaqoh ${halaqoh.nama}. Catatan setoran terakhir semua jenis ditampilkan agar Anda tahu titik lanjutan.`
      : '',
  }

  return (
    <>
      <SectionHeader
        title="Input Setoran"
        description="Catat setoran siswa: pilih program, halaqoh, lalu klik siswa — form input terbuka dalam popup."
      />

      {/* Stepper */}
      <ol
        className="mt-4 flex items-center gap-1 overflow-x-auto pb-1"
        aria-label={`Langkah input setoran: ${step} dari ${STEPS.length}`}
      >
        {STEPS.map((s, i) => {
          const done = step > s.n
          const active = step === s.n
          const clickable = s.n < step
          return (
            <li key={s.n} className="flex shrink-0 items-center gap-1">
              {i > 0 ? (
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" aria-hidden />
              ) : null}
              <button
                type="button"
                disabled={!clickable}
                onClick={() => goToStep(s.n)}
                aria-current={active ? 'step' : undefined}
                className={cn(
                  'flex min-h-9 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : done
                      ? 'bg-primary/10 text-primary hover:bg-primary/20'
                      : 'bg-muted text-muted-foreground'
                )}
              >
                {done ? (
                  <Check className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <span
                    className={cn(
                      'grid h-4 w-4 place-items-center rounded-full text-[10px] font-bold',
                      active ? 'bg-primary-foreground/20' : 'bg-muted-foreground/15'
                    )}
                  >
                    {s.n}
                  </span>
                )}
                <span className="whitespace-nowrap">{s.label}</span>
              </button>
            </li>
          )
        })}
      </ol>

      <p className="mt-2 text-sm text-muted-foreground" aria-live="polite">
        {stepSub[step]}
      </p>

      {/* Konten langkah */}
      <div className="mt-4">
        {step === 1 ? <ProgramStep onSelect={handleSelectProgram} /> : null}
        {step === 2 && program ? (
          <HalaqohStep
            key={program.id}
            program={program}
            onBack={() => goToStep(1)}
            onSelect={handleSelectHalaqoh}
          />
        ) : null}
        {step === 3 && halaqoh ? (
          <SiswaStep
            key={`${halaqoh.id}-${savedKey}`}
            halaqoh={halaqoh}
            onBack={() => goToStep(2)}
            onSelect={handleSelectSiswa}
          />
        ) : null}
      </div>

      {/* POPUP input setoran siswa */}
      <SetoranSiswaPopup
        open={popupOpen}
        onOpenChange={(open) => {
          if (!open) {
            setPopupOpen(false)
            setPopupSiswa(null)
            setPopupTerakhir(null)
          }
        }}
        siswa={popupSiswa}
        terakhir={popupTerakhir}
        onSaved={handleSaved}
        onDataChanged={() => setSavedKey((k) => k + 1)}
        user={user}
      />
    </>
  )
}

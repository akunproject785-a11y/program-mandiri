'use client'

/**
 * Section Rekap Setoran dengan 2 tab:
 * - "Daftar Setoran": filter (halaqoh/program/siswa/rentang tanggal),
 *   daftar setoran (tabel desktop, kartu mobile),
 *   dan 2 cara berbagi: Cetak PDF (window.print + layout A4) dan Bagikan WhatsApp
 *   (popup review + salin teks + navigator.share/wa.me).
 * - "Rekapan Bulanan": rekap per siswa satu bulan (setoran awal & akhir bulan,
 *   jumlah baris ditotal, urut NIS) — komponen RekapanBulananView.
 * Type (tipe form A/B/C/D) TIDAK difilter maupun ditampilkan — Program sudah
 * mewakilinya; tipe hanya menentukan jenis form input setoran.
 *
 * Edit & hapus setoran: admin dapat mengelola SEMUA catatan; musyrif hanya
 * catatan yang dia rekam sendiri (tombol ikon pensil/sampah per baris).
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  Inbox,
  MessageCircle,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/client'
import {
  describeSetoran,
  formatTanggalIndo,
  formatTanggalPendek,
  todayISO,
} from '@/lib/format'
import {
  type HalaqohItem,
  type Program,
  type SetoranItem,
  type SiswaItem,
  type UserInfo,
} from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ConfirmDialog,
  EmptyState,
  LoadingBlock,
  NilaiBadge,
  SectionHeader,
} from '@/components/dashboard/ui-helpers'
import SetoranFormDialog from '@/components/dashboard/setoran-form-dialog'
import SetoranEditDialog from '@/components/dashboard/setoran-edit-dialog'
import WaShareDialog from '@/components/dashboard/wa-share-dialog'
import RekapanBulananView from '@/components/dashboard/rekapan-bulanan'

const ALL = 'ALL'

/** Tombol aksi Edit & Hapus untuk satu baris setoran yang boleh dikelola. */
function AksiButtons({
  nama,
  onEdit,
  onDelete,
}: {
  nama: string
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="flex items-center justify-end gap-0.5">
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Edit setoran ${nama}`}
        title="Edit setoran"
        onClick={onEdit}
        className="text-muted-foreground hover:text-foreground"
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Hapus setoran ${nama}`}
        title="Hapus setoran"
        onClick={onDelete}
        className="text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  )
}

interface FilterState {
  halaqohId: string
  programId: string
  siswaId: string
  from: string
  to: string
}

const DEFAULT_FILTERS: FilterState = {
  halaqohId: ALL,
  programId: ALL,
  siswaId: ALL,
  from: '',
  to: '',
}

/** Dropdown filter kecil dengan label di atasnya. */
function FilterSelect({
  label,
  value,
  onValueChange,
  children,
}: {
  label: string
  value: string
  onValueChange: (value: string) => void
  children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger aria-label={`Filter ${label}`} className="w-full min-h-11">
          <SelectValue placeholder={label} />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </div>
  )
}

/** Teks tambahan chip untuk kartu mobile (menu setoran / materi belajar). */
function chipMateri(item: SetoranItem): string | null {
  if (item.tipe === 'B') return item.materiBelajar ? `Materi: ${item.materiBelajar}` : null
  if (item.tipe === 'C' || item.tipe === 'D')
    return item.menuSetoran ? `Menu: ${item.menuSetoran}` : null
  if (item.tipe === 'A') return item.anaba ? `Materi: ${item.anaba}` : null
  return null
}

/** Nilai singkat untuk teks WA: "A - Sangat Baik" → "A". */
function nilaiPendek(item: SetoranItem): string {
  const raw = item.tipe === 'B' ? item.nilai : item.nilaiKelancaran
  return raw ? raw.split(' - ')[0] ?? raw : ''
}

/** CSS khusus cetak: sembunyikan seluruh halaman, tampilkan hanya area laporan A4. */
const PRINT_CSS = `
@media print {
  @page { size: A4; margin: 12mm; }
  body:has(#tahfidz-print-area) * { visibility: hidden !important; }
  body:has(#tahfidz-print-area) #tahfidz-print-area,
  body:has(#tahfidz-print-area) #tahfidz-print-area * { visibility: visible !important; }
  #tahfidz-print-area {
    position: absolute !important;
    left: 0 !important;
    top: 0 !important;
    width: 100% !important;
    color: #000 !important;
    background: #fff !important;
  }
  #tahfidz-print-area table { border-collapse: collapse; width: 100%; }
  #tahfidz-print-area th, #tahfidz-print-area td {
    border: 0.6pt solid #9ca3af;
    padding: 4px 6px;
    text-align: left;
    vertical-align: top;
  }
  #tahfidz-print-area thead th { background: #f3f4f6; }
}
`

export default function RekapanSection({ user }: { user: UserInfo }) {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS)
  const [halaqohList, setHalaqohList] = useState<HalaqohItem[]>([])
  const [programList, setProgramList] = useState<Program[]>([])
  const [siswaList, setSiswaList] = useState<SiswaItem[]>([])
  const [setoran, setSetoran] = useState<SetoranItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<SetoranItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SetoranItem | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [waOpen, setWaOpen] = useState(false)
  /** Tab aktif: daftar setoran (default) atau rekapan bulanan per siswa. */
  const [mode, setMode] = useState<'daftar' | 'bulanan'>('daftar')

  const isAdmin = user.role === 'admin'

  /** Izin kelola (edit/hapus) satu setoran: admin semua, musyrif hanya rekamannya sendiri. */
  const canManage = (item: SetoranItem) =>
    isAdmin || (user.musyrifId != null && item.musyrifId === user.musyrifId)

  // Data master untuk dropdown filter (gagal → dropdown kosong, tanpa blocker).
  useEffect(() => {
    let mounted = true
    api<{ halaqoh: HalaqohItem[] }>('/api/halaqoh')
      .then((d) => {
        if (mounted) setHalaqohList(d.halaqoh)
      })
      .catch(() => {
        /* filter halaqoh tetap kosong jika gagal dimuat */
      })
    api<{ programs: Program[] }>('/api/programs')
      .then((d) => {
        if (mounted) setProgramList(d.programs)
      })
      .catch(() => {
        /* filter program tetap kosong jika gagal dimuat */
      })
    api<{ siswa: SiswaItem[] }>('/api/siswa')
      .then((d) => {
        if (mounted) setSiswaList(d.siswa)
      })
      .catch(() => {
        /* filter siswa tetap kosong jika gagal dimuat */
      })
    return () => {
      mounted = false
    }
  }, [])

  // Ambil data setoran setiap filter berubah (atau setelah refresh).
  useEffect(() => {
    let mounted = true
    const params = new URLSearchParams()
    if (filters.halaqohId !== ALL) params.set('halaqohId', filters.halaqohId)
    if (filters.programId !== ALL) params.set('programId', filters.programId)
    if (filters.siswaId !== ALL) params.set('siswaId', filters.siswaId)
    if (filters.from) params.set('from', filters.from)
    if (filters.to) params.set('to', filters.to)
    const qs = params.toString()
    api<{ setoran: SetoranItem[] }>(`/api/setoran${qs ? `?${qs}` : ''}`)
      .then((d) => {
        if (!mounted) return
        setSetoran(d.setoran)
        setError(null)
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
  }, [filters, refreshKey])

  /** Ringkasan filter aktif untuk header laporan cetak & teks WA. */
  const filterRingkas = useMemo(() => {
    const periode =
      filters.from || filters.to
        ? `${filters.from ? formatTanggalIndo(filters.from) : 'awal'} s.d. ${filters.to ? formatTanggalIndo(filters.to) : 'sekarang'}`
        : 'Semua tanggal'
    const parts: string[] = [`Periode: ${periode}`]
    if (filters.halaqohId !== ALL)
      parts.push(`Halaqoh: ${halaqohList.find((h) => h.id === filters.halaqohId)?.nama ?? '-'}`)
    if (filters.programId !== ALL)
      parts.push(`Program: ${programList.find((p) => p.id === filters.programId)?.nama ?? '-'}`)
    if (filters.siswaId !== ALL)
      parts.push(`Siswa: ${siswaList.find((s) => s.id === filters.siswaId)?.nama ?? '-'}`)
    return parts.join(' • ')
  }, [filters, halaqohList, programList, siswaList])

  const updateFilter = (patch: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...patch }))
    setLoading(true)
  }

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS)
    setLoading(true)
  }

  const retry = () => {
    setError(null)
    setLoading(true)
    setRefreshKey((k) => k + 1)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api(`/api/setoran/${deleteTarget.id}`, { method: 'DELETE' })
      toast.success('Setoran dihapus')
      setDeleteTarget(null)
      setRefreshKey((k) => k + 1)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Terjadi kesalahan. Silakan coba lagi.'
      )
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  /** Teks rekap siap kirim WhatsApp (dipotong bila sangat panjang). */
  const buildWAText = useCallback((): string => {
    const lines: string[] = []
    lines.push('*REKAP SETORAN TAHFIDZ*')
    lines.push("Program Qur'an Mandiri")
    lines.push('')
    lines.push(filterRingkas)
    lines.push('')
    setoran.forEach((item, i) => {
      const nilai = nilaiPendek(item)
      lines.push(
        `${i + 1}. ${formatTanggalPendek(item.tanggal)} • ${item.siswaNama} (${item.programNama}): ${describeSetoran(item)}${nilai ? ` — Nilai ${nilai}` : ''}`
      )
    })
    lines.push('')
    lines.push(`Total: ${setoran.length} setoran`)
    lines.push('')
    lines.push("_Dikirim dari aplikasi Program Qur'an Mandiri_")
    const text = lines.join('\n')
    // WhatsApp menerima ±65.000 karakter; jaga aman.
    return text.length > 3000 ? text.slice(0, 3000) + '\n\n…(data dipotong, cetak PDF untuk laporan lengkap)' : text
  }, [setoran, filterRingkas])

  /** Teks final untuk popup review WA — dihitung ulang saat data/filter berubah. */
  const waText = useMemo(() => buildWAText(), [buildWAText])

  const canShare = !loading && !error && setoran.length > 0

  /** Tampilkan kolom aksi jika admin, atau jika ada rekaman yang bisa dikelola musyrif ini. */
  const showAksi = isAdmin || setoran.some(canManage)

  return (
    <>
      <SectionHeader
        title="Rekap Setoran"
        description="Rekap setoran hafalan — daftar catatan, rekap bulanan per siswa, cetak PDF, atau bagikan ke grup WhatsApp."
      >
        {isAdmin ? (
          <Button
            variant="outline"
            onClick={() => setDialogOpen(true)}
            className="min-h-11 sm:min-h-9"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Catat Setoran
          </Button>
        ) : null}
        {mode === 'daftar' ? (
          <>
            <Button
              variant="outline"
              disabled={!canShare}
              onClick={() => window.print()}
              title="Cetak / simpan laporan sebagai PDF"
              className="min-h-11 sm:min-h-9"
            >
              <Printer className="h-4 w-4" aria-hidden />
              Cetak PDF
            </Button>
            <Button
              disabled={!canShare}
              onClick={() => setWaOpen(true)}
              title="Review hasil rekap, salin teks, lalu bagikan ke grup WhatsApp"
              className="min-h-11 bg-[#25D366] text-white hover:bg-[#1eb85a] sm:min-h-9"
            >
              <MessageCircle className="h-4 w-4" aria-hidden />
              Bagikan WhatsApp
            </Button>
          </>
        ) : null}
      </SectionHeader>

      {/* Tab: Daftar Setoran | Rekapan Bulanan */}
      <Tabs
        value={mode}
        onValueChange={(v) => setMode(v as 'daftar' | 'bulanan')}
        className="mt-4"
      >
        <TabsList className="print:hidden">
          <TabsTrigger value="daftar">Daftar Setoran</TabsTrigger>
          <TabsTrigger value="bulanan">Rekapan Bulanan</TabsTrigger>
        </TabsList>

        <TabsContent value="daftar" className="mt-4">
          {/* Filter bar */}
          <Card className="gap-0 p-4 print:hidden">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <FilterSelect
            label="Halaqoh"
            value={filters.halaqohId}
            onValueChange={(v) => updateFilter({ halaqohId: v })}
          >
            <SelectItem value={ALL}>Semua Halaqoh</SelectItem>
            {halaqohList.map((h) => (
              <SelectItem key={h.id} value={h.id}>
                {h.nama}
              </SelectItem>
            ))}
          </FilterSelect>
          <FilterSelect
            label="Program"
            value={filters.programId}
            onValueChange={(v) => updateFilter({ programId: v })}
          >
            <SelectItem value={ALL}>Semua Program</SelectItem>
            {programList.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.nama}
              </SelectItem>
            ))}
          </FilterSelect>
          <FilterSelect
            label="Siswa"
            value={filters.siswaId}
            onValueChange={(v) => updateFilter({ siswaId: v })}
          >
            <SelectItem value={ALL}>Semua Siswa</SelectItem>
            {siswaList.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.nama} — {s.nis}
              </SelectItem>
            ))}
          </FilterSelect>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Dari</Label>
            <Input
              type="date"
              aria-label="Dari tanggal"
              value={filters.from}
              onChange={(e) => updateFilter({ from: e.target.value })}
              className="min-h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Sampai</Label>
            <Input
              type="date"
              aria-label="Sampai tanggal"
              value={filters.to}
              onChange={(e) => updateFilter({ to: e.target.value })}
              className="min-h-11"
            />
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={resetFilters}
            className="min-h-11 text-muted-foreground sm:min-h-8"
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            Reset
          </Button>
        </div>
      </Card>

      {/* Data setoran */}
      {loading ? (
        <Card className="mt-4 gap-0 py-0 print:hidden">
          <LoadingBlock label="Memuat data setoran…" />
        </Card>
      ) : error ? (
        <Card className="mt-4 gap-0 py-0 print:hidden">
          <EmptyState
            icon={<AlertTriangle />}
            title="Gagal memuat data setoran"
            description={error}
          >
            <Button onClick={retry} className="min-h-11 sm:min-h-9">
              Coba Lagi
            </Button>
          </EmptyState>
        </Card>
      ) : setoran.length === 0 ? (
        <Card className="mt-4 gap-0 py-0 print:hidden">
          <EmptyState
            icon={<Inbox />}
            title="Belum ada data setoran"
            description={
              isAdmin
                ? 'Setoran yang dicatat akan tampil di sini. Mulai dengan mencatat setoran baru.'
                : 'Setoran yang Anda catat melalui menu Input Setoran akan tampil di sini.'
            }
          >
            {isAdmin ? (
              <Button onClick={() => setDialogOpen(true)} className="min-h-11 sm:min-h-9">
                <Plus className="h-4 w-4" aria-hidden />
                Catat Setoran
              </Button>
            ) : null}
          </EmptyState>
        </Card>
      ) : (
        <>
          {/* Chip total (Type tidak ditampilkan — Program sudah mewakili) */}
          <div className="mt-4 flex flex-wrap items-center gap-2 print:hidden">
            <span className="rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground">
              Total: {setoran.length} setoran
            </span>
          </div>

          {/* Tabel desktop */}
          <Card className="mt-2 hidden max-h-[70vh] gap-0 overflow-auto py-0 [scrollbar-width:thin] md:block print:hidden">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Siswa</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead>Jenis Setoran</TableHead>
                  <TableHead>Nilai</TableHead>
                  <TableHead>Musyrif</TableHead>
                  {showAksi ? (
                    <TableHead className="sticky right-0 border-l bg-card text-right">Aksi</TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {setoran.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <p className="font-medium">{formatTanggalIndo(item.tanggal)}</p>
                      <p className="text-xs text-muted-foreground">{item.hari}</p>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{item.siswaNama}</p>
                      <p className="text-xs text-muted-foreground">NIS {item.siswaNis}</p>
                    </TableCell>
                    <TableCell className="text-sm">{item.programNama}</TableCell>
                    <TableCell>
                      <p className="mt-1 max-w-[260px] truncate text-xs text-muted-foreground">
                        {describeSetoran(item)}
                      </p>
                    </TableCell>
                    <TableCell>
                      <NilaiBadge nilai={item.tipe === 'B' ? item.nilai : item.nilaiKelancaran} />
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="max-w-[150px] truncate" title={item.musyrifNama ?? undefined}>
                        {item.musyrifNama ?? '—'}
                      </div>
                    </TableCell>
                    {showAksi ? (
                      <TableCell className="sticky right-0 bg-card text-right">
                        {canManage(item) ? (
                          <AksiButtons
                            nama={item.siswaNama}
                            onEdit={() => setEditTarget(item)}
                            onDelete={() => setDeleteTarget(item)}
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground" title="Hanya pencatat atau admin yang dapat mengubah">
                            —
                          </span>
                        )}
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Kartu mobile */}
          <div className="mt-2 grid gap-3 md:hidden print:hidden">
            {setoran.map((item) => (
              <Card key={item.id} className="gap-0 p-4">
                <div className="flex items-center justify-end">
                  <span className="text-xs text-muted-foreground">
                    {formatTanggalIndo(item.tanggal)} • {item.hari}
                  </span>
                </div>
                <p className="mt-2 font-medium">{item.siswaNama}</p>
                <p className="text-xs text-muted-foreground">
                  NIS {item.siswaNis} • {item.programNama}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{describeSetoran(item)}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <NilaiBadge nilai={item.tipe === 'B' ? item.nilai : item.nilaiKelancaran} />
                  {chipMateri(item) ? (
                    <span className="rounded-md bg-secondary px-2 py-1 text-xs text-secondary-foreground">
                      {chipMateri(item)}
                    </span>
                  ) : null}
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">Musyrif: {item.musyrifNama ?? '—'}</p>
                  {canManage(item) ? (
                    <AksiButtons
                      nama={item.siswaNama}
                      onEdit={() => setEditTarget(item)}
                      onDelete={() => setDeleteTarget(item)}
                    />
                  ) : null}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
        </TabsContent>

        <TabsContent value="bulanan" className="mt-4">
          <RekapanBulananView user={user} halaqohList={halaqohList} />
        </TabsContent>
      </Tabs>

      {/* Dialog catat setoran (admin) */}
      {isAdmin ? (
        <SetoranFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSaved={() => setRefreshKey((k) => k + 1)}
        />
      ) : null}

      {/* Dialog edit setoran (admin: semua, musyrif: rekamannya sendiri) */}
      <SetoranEditDialog
        open={editTarget !== null}
        onOpenChange={(o) => {
          if (!o) setEditTarget(null)
        }}
        setoran={editTarget}
        onSaved={() => setRefreshKey((k) => k + 1)}
      />

      {/* Dialog review share WhatsApp (pratinjau + salin teks + bagikan) */}
      <WaShareDialog open={waOpen} onOpenChange={setWaOpen} text={waText} />

      {/* Konfirmasi hapus */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => {
          if (!o) setDeleteTarget(null)
        }}
        title="Hapus setoran ini?"
        description="Data tidak dapat dikembalikan."
        confirmText="Hapus"
        loading={deleting}
        onConfirm={handleDelete}
      />

      {/* ====== AREA CETAK PDF (hanya tampil saat print) ====== */}
      <style>{PRINT_CSS}</style>
      {mode === 'daftar' && canShare ? (
        <div id="tahfidz-print-area" className="hidden print:block">
          {/* Kepala laporan */}
          <div className="text-center">
            <p className="text-[13px] font-bold uppercase tracking-widest">
              Rekap Setoran Tahfidz
            </p>
            <p className="mt-0.5 text-[12px] font-semibold">Program Qur&apos;an Mandiri</p>
            <p className="mx-auto mt-1 max-w-full text-[10px] text-gray-600">{filterRingkas}</p>
          </div>

          {/* Ringkasan */}
          <p className="mt-3 text-[11px]">
            <span className="font-semibold">Total: {setoran.length} setoran</span>
          </p>

          {/* Tabel laporan */}
          <table className="mt-2 text-[10px]">
            <thead>
              <tr>
                <th className="w-8">No</th>
                <th className="w-24">Tanggal</th>
                <th className="w-36">Siswa</th>
                <th className="w-24">Halaqoh</th>
                <th className="w-24">Program</th>
                <th>Jenis Setoran</th>
                <th className="w-24">Nilai</th>
                <th className="w-28">Musyrif</th>
              </tr>
            </thead>
            <tbody>
              {setoran.map((item, i) => (
                <tr key={item.id}>
                  <td>{i + 1}</td>
                  <td>
                    {formatTanggalPendek(item.tanggal)}
                    <br />
                    <span className="text-gray-500">{item.hari}</span>
                  </td>
                  <td>
                    <span className="font-semibold">{item.siswaNama}</span>
                    <br />
                    <span className="text-gray-500">
                      NIS {item.siswaNis} — {item.programNama}
                    </span>
                  </td>
                  <td>
                    {siswaList.find((s) => s.id === item.siswaId)?.halaqohNama ?? '-'}
                  </td>
                  <td>{item.programNama}</td>
                  <td>{describeSetoran(item)}</td>
                  <td>{item.tipe === 'B' ? item.nilai : item.nilaiKelancaran}</td>
                  <td>{item.musyrifNama ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Tanda tangan */}
          <div className="mt-8 flex justify-end">
            <div className="text-center text-[11px]">
              <p>{formatTanggalIndo(todayISO())}</p>
              <p>Pembina Halaqoh</p>
              <div className="h-14" aria-hidden />
              <p className="font-semibold underline">( {user.name} )</p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

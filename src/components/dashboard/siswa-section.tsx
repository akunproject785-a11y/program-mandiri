'use client'

/**
 * Section Data Siswa (admin): CRUD data santri beserta program & halaqoh binaan.
 * Opsi halaqoh pada form hanya menampilkan halaqoh dari program yang dipilih.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import {
  AlertTriangle,
  GraduationCap,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/client'
import { compressImageFile, formatBytes } from '@/lib/image-compress'
import type { HalaqohItem, Program, SiswaItem } from '@/lib/types'
import SiswaImportDialog from '@/components/dashboard/siswa-import-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
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
import {
  ConfirmDialog,
  EmptyState,
  Field,
  LoadingBlock,
  SectionHeader,
} from '@/components/dashboard/ui-helpers'

/** Sentinel untuk opsi "tanpa halaqoh" (value="" tidak boleh pada SelectItem). */
const HALAQOH_NONE = 'NONE'
/** Sentinel opsi "semua" pada filter. */
const FILTER_ALL = 'ALL'

function getInitials(nama: string): string {
  const parts = nama.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.charAt(0) ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? '') : ''
  return (first + last).toUpperCase() || '?'
}

/** Urut NIS secara angka-aware (20259 < 2025010 walau string). */
function bandingNis(a: string, b: string): number {
  return a.localeCompare(b, 'id', { numeric: true })
}

// programId memakai '' (bukan undefined) agar Select selalu terkontrol (tanpa warning React);
// halaqohId memakai sentinel 'NONE' pada Select (value="" tidak boleh pada SelectItem).
interface SiswaFormState {
  nis: string
  nama: string
  kelas: string
  programId: string | ''
  halaqohId: string | null
}

const EMPTY_SISWA_FORM: SiswaFormState = {
  nis: '',
  nama: '',
  kelas: '',
  programId: '',
  halaqohId: null,
}

export default function SiswaSection() {
  // ===== Data list (siswa + programs + halaqoh untuk form) =====
  const [siswa, setSiswa] = useState<SiswaItem[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [halaqohList, setHalaqohList] = useState<HalaqohItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let mounted = true
    Promise.all([
      api<{ siswa: SiswaItem[] }>('/api/siswa'),
      api<{ programs: Program[] }>('/api/programs'),
      api<{ halaqoh: HalaqohItem[] }>('/api/halaqoh'),
    ])
      .then(([s, p, h]) => {
        if (!mounted) return
        setSiswa(s.siswa)
        setPrograms(p.programs)
        setHalaqohList(h.halaqoh)
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
  }, [refreshKey])

  const refresh = useCallback(() => {
    setError(null)
    setLoading(true)
    setRefreshKey((k) => k + 1)
  }, [])

  // ===== Filter + urutan NIS =====
  const [fCari, setFCari] = useState('')
  const [fProgram, setFProgram] = useState<string>(FILTER_ALL)
  const [fHalaqoh, setFHalaqoh] = useState<string>(FILTER_ALL)
  const [fKelas, setFKelas] = useState<string>(FILTER_ALL)

  const adaFilter =
    fCari.trim() !== '' || fProgram !== FILTER_ALL || fHalaqoh !== FILTER_ALL || fKelas !== FILTER_ALL

  const resetFilter = () => {
    setFCari('')
    setFProgram(FILTER_ALL)
    setFHalaqoh(FILTER_ALL)
    setFKelas(FILTER_ALL)
  }

  // Daftar kelas unik (urut angka-aware) untuk dropdown filter.
  const kelasOptions = useMemo(
    () =>
      Array.from(new Set(siswa.map((s) => s.kelas))).sort((a, b) =>
        a.localeCompare(b, 'id', { numeric: true })
      ),
    [siswa]
  )

  // Opsi halaqoh pada filter mengikuti program yang dipilih (kalau aktif).
  const filterHalaqohOptions = useMemo(
    () => (fProgram === FILTER_ALL ? halaqohList : halaqohList.filter((h) => h.programId === fProgram)),
    [halaqohList, fProgram]
  )

  const handleFilterProgram = (value: string) => {
    setFProgram(value)
    // Halaqoh terpilih tidak lagi valid bila keluar dari program tersebut.
    if (value !== FILTER_ALL && fHalaqoh !== FILTER_ALL && fHalaqoh !== HALAQOH_NONE) {
      const masihCocok = halaqohList.some(
        (h) => h.id === fHalaqoh && h.programId === value
      )
      if (!masihCocok) setFHalaqoh(FILTER_ALL)
    }
  }

  const siswaTampil = useMemo(() => {
    const term = fCari.trim().toLowerCase()
    return siswa
      .filter((s) => {
        if (term && !`${s.nis} ${s.nama}`.toLowerCase().includes(term)) return false
        if (fProgram !== FILTER_ALL && s.programId !== fProgram) return false
        if (fHalaqoh === HALAQOH_NONE) {
          if (s.halaqohId !== null) return false
        } else if (fHalaqoh !== FILTER_ALL && s.halaqohId !== fHalaqoh) {
          return false
        }
        if (fKelas !== FILTER_ALL && s.kelas !== fKelas) return false
        return true
      })
      .sort((a, b) => bandingNis(a.nis, b.nis))
  }, [siswa, fCari, fProgram, fHalaqoh, fKelas])

  // ===== Dialog import massal =====
  const [importOpen, setImportOpen] = useState(false)

  // ===== Dialog tambah/edit =====
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<SiswaItem | null>(null)
  const [form, setForm] = useState<SiswaFormState>(EMPTY_SISWA_FORM)
  const [saving, setSaving] = useState(false)

  const openForm = (item: SiswaItem | null) => {
    setEditing(item)
    if (item) {
      // Guard: jika halaqoh tersimpan tidak cocok dengan program siswa, reset ke kosong.
      const halaqohValid = item.halaqohId
        ? halaqohList.some((h) => h.id === item.halaqohId && h.programId === item.programId)
        : true
      setForm({
        nis: item.nis,
        nama: item.nama,
        kelas: item.kelas,
        programId: item.programId,
        halaqohId: halaqohValid ? item.halaqohId : null,
      })
    } else {
      setForm(EMPTY_SISWA_FORM)
    }
    setFormOpen(true)
  }

  // Ganti program: reset halaqoh bila halaqoh terpilih tidak cocok dengan program baru.
  const handleProgramChange = (programId: string) => {
    setForm((prev) => {
      const stillValid =
        prev.halaqohId &&
        halaqohList.some((h) => h.id === prev.halaqohId && h.programId === programId)
      return { ...prev, programId, halaqohId: stillValid ? prev.halaqohId : null }
    })
  }

  const handleHalaqohChange = (value: string) => {
    setForm((prev) => ({ ...prev, halaqohId: value === HALAQOH_NONE ? null : value }))
  }

  const filteredHalaqoh = form.programId
    ? halaqohList.filter((h) => h.programId === form.programId)
    : []

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!form.nis.trim() || !form.nama.trim() || !form.kelas.trim()) {
      toast.error('NIS, nama lengkap, dan kelas wajib diisi.')
      return
    }
    if (!form.programId) {
      toast.error('Pilih program kelas tahfidz terlebih dahulu.')
      return
    }
    const programId: string = form.programId
    setSaving(true)
    const body = {
      nis: form.nis.trim(),
      kelas: form.kelas.trim(),
      nama: form.nama.trim(),
      programId,
      halaqohId: form.halaqohId,
    }
    try {
      if (editing) {
        await api<{ siswa: SiswaItem }>(`/api/siswa/${editing.id}`, { method: 'PUT', body })
        toast.success('Siswa berhasil diperbarui')
      } else {
        await api<{ siswa: SiswaItem }>('/api/siswa', { method: 'POST', body })
        toast.success('Siswa berhasil ditambahkan')
      }
      setFormOpen(false)
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan siswa')
    } finally {
      setSaving(false)
    }
  }

  // ===== Dialog hapus =====
  const [deleteTarget, setDeleteTarget] = useState<SiswaItem | null>(null)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api<{ ok: boolean }>(`/api/siswa/${deleteTarget.id}`, { method: 'DELETE' })
      toast.success('Siswa berhasil dihapus')
      setDeleteTarget(null)
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menghapus siswa')
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  // ===== Upload foto siswa (Supabase Storage) =====
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [uploadTargetId, setUploadTargetId] = useState<string | null>(null)
  const [uploadingFoto, setUploadingFoto] = useState(false)

  const openFotoPicker = (id: string) => {
    setUploadTargetId(id)
    fileInputRef.current?.click()
  }

  const handleFotoChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    const targetId = uploadTargetId
    setUploadTargetId(null)
    if (!file || !targetId) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Format foto harus JPG, PNG, atau WebP.')
      return
    }
    setUploadingFoto(true)
    try {
      // Kompres di browser dulu (sama seperti selfie absen): 720px JPEG ±100 KB —
      // hemat storage & egress, dan foto kamera >2 MB tetap bisa dipakai.
      const hasil = await compressImageFile(file)
      const fd = new FormData()
      fd.append('file', hasil.blob, 'foto.jpg')
      const res = await fetch(`/api/siswa/${targetId}/foto`, {
        method: 'POST',
        body: fd,
        cache: 'no-store',
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Gagal mengunggah foto')
      toast.success(
        `Foto siswa berhasil diunggah (${formatBytes(hasil.originalSize)} → ${formatBytes(hasil.compressedSize)})`
      )
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal mengunggah foto')
    } finally {
      setUploadingFoto(false)
    }
  }

  const renderAvatar = (item: SiswaItem, className = 'h-9 w-9') =>
    item.fotoUrl ? (
      <img
        src={item.fotoUrl}
        alt={`Foto ${item.nama}`}
        className={`${className} shrink-0 rounded-full object-cover`}
      />
    ) : (
      <span
        className={`${className} grid shrink-0 place-items-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary`}
        aria-hidden
      >
        {getInitials(item.nama)}
      </span>
    )

  // ===== Aksi baris (tabel & kartu) =====
  const renderActions = (item: SiswaItem) => (
    <div className="flex justify-end gap-1">
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 sm:h-8 sm:w-8"
        aria-label={`Unggah foto siswa ${item.nama}`}
        title="Unggah foto"
        disabled={uploadingFoto}
        onClick={() => openFotoPicker(item.id)}
      >
        {uploadingFoto && uploadTargetId === item.id ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ImagePlus className="h-4 w-4" />
        )}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 sm:h-8 sm:w-8"
        aria-label={`Edit siswa ${item.nama}`}
        onClick={() => openForm(item)}
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 sm:h-8 sm:w-8 text-destructive hover:text-destructive"
        aria-label={`Hapus siswa ${item.nama}`}
        onClick={() => setDeleteTarget(item)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  )

  const emptyState = siswa.length === 0 ? (
    <EmptyState
      icon={<GraduationCap />}
      title="Belum ada siswa"
      description="Tambahkan data santri lalu tempatkan pada program kelas dan halaqoh binaan."
    >
      <div className="flex flex-wrap justify-center gap-2">
        <Button variant="outline" onClick={() => setImportOpen(true)}>
          <Upload className="h-4 w-4" />
          Import Massal
        </Button>
        <Button onClick={() => openForm(null)}>
          <Plus className="h-4 w-4" />
          Tambah Siswa
        </Button>
      </div>
    </EmptyState>
  ) : (
    <EmptyState
      icon={<Search />}
      title="Tidak ada siswa yang cocok"
      description="Coba ubah kata kunci pencarian atau reset filter."
    >
      <Button variant="outline" onClick={resetFilter}>
        <X className="h-4 w-4" />
        Reset Filter
      </Button>
    </EmptyState>
  )

  return (
    <>
      <SectionHeader
        title="Data Siswa"
        description="Data santri beserta program & halaqoh binaan."
      >
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => setImportOpen(true)}
            className="min-h-11 sm:min-h-9"
          >
            <Upload className="h-4 w-4" />
            Import Massal
          </Button>
          <Button onClick={() => openForm(null)} className="min-h-11 sm:min-h-9">
            <Plus className="h-4 w-4" />
            Tambah Siswa
          </Button>
        </div>
      </SectionHeader>

      {loading ? (
        <LoadingBlock label="Memuat siswa…" />
      ) : error ? (
        <EmptyState icon={<AlertTriangle />} title="Gagal memuat data siswa" description={error}>
          <Button onClick={refresh}>Coba Lagi</Button>
        </EmptyState>
      ) : (
        <div className="mt-6 space-y-6">
          {/* Baris filter + pencarian */}
          <Card className="p-4">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <div className="relative sm:col-span-2 lg:col-span-1">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  id="siswa-filter-cari"
                  value={fCari}
                  onChange={(e) => setFCari(e.target.value)}
                  placeholder="Cari NIS atau nama…"
                  aria-label="Cari NIS atau nama siswa"
                  className="h-11 pl-9 lg:h-9"
                />
              </div>
              <Select value={fProgram} onValueChange={handleFilterProgram}>
                <SelectTrigger aria-label="Filter program kelas" className="h-11 w-full lg:h-9">
                  <SelectValue placeholder="Semua Program" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={FILTER_ALL}>Semua Program</SelectItem>
                  {programs.map((program) => (
                    <SelectItem key={program.id} value={program.id}>
                      {program.nama}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={fHalaqoh} onValueChange={setFHalaqoh}>
                <SelectTrigger aria-label="Filter halaqoh" className="h-11 w-full lg:h-9">
                  <SelectValue placeholder="Semua Halaqoh" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={FILTER_ALL}>Semua Halaqoh</SelectItem>
                  <SelectItem value={HALAQOH_NONE}>Tanpa Halaqoh</SelectItem>
                  {filterHalaqohOptions.map((h) => (
                    <SelectItem key={h.id} value={h.id}>
                      {h.nama}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Select value={fKelas} onValueChange={setFKelas}>
                  <SelectTrigger aria-label="Filter kelas" className="h-11 w-full lg:h-9">
                    <SelectValue placeholder="Semua Kelas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={FILTER_ALL}>Semua Kelas</SelectItem>
                    {kelasOptions.map((k) => (
                      <SelectItem key={k} value={k}>
                        {k}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {adaFilter ? (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={resetFilter}
                    aria-label="Reset filter"
                    title="Reset filter"
                    className="h-11 w-11 shrink-0 lg:h-9 lg:w-9"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            </div>
          </Card>

          {/* Tabel desktop (>= md) */}
          <div className="hidden md:block">
            <Card>
              <CardHeader>
                <CardTitle>Daftar Siswa</CardTitle>
                <CardDescription>
                  {adaFilter
                    ? `${siswaTampil.length} dari ${siswa.length} santri cocok dengan filter — urut NIS.`
                    : `${siswa.length} santri terdaftar — urut NIS.`}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {siswaTampil.length === 0 ? (
                  emptyState
                ) : (
                  <div className="max-h-96 overflow-y-auto [scrollbar-width:thin]">
                    <Table>
                      <TableHeader className="sticky top-0 z-10 bg-card">
                        <TableRow>
                          <TableHead className="pl-4 sm:pl-6">NIS</TableHead>
                          <TableHead>Nama</TableHead>
                          <TableHead>Kelas</TableHead>
                          <TableHead>Program Kelas</TableHead>
                          <TableHead>Halaqoh Binaan</TableHead>
                          <TableHead className="pr-4 text-right sm:pr-6">Aksi</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {siswaTampil.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="py-3 pl-4 font-mono text-sm sm:pl-6">
                              {item.nis}
                            </TableCell>
                          <TableCell className="py-3 font-medium">
                            <span className="flex items-center gap-2">
                              {renderAvatar(item)}
                              <span className="truncate" title={item.nama}>
                                {item.nama}
                              </span>
                            </span>
                          </TableCell>
                            <TableCell className="py-3">
                              <Badge variant="outline">{item.kelas}</Badge>
                            </TableCell>
                            <TableCell className="py-3">
                              <span className="text-sm">{item.programNama}</span>
                            </TableCell>
                            <TableCell className="py-3 text-sm">
                              {item.halaqohNama ?? <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className="py-3 pr-4 sm:pr-6">
                              {renderActions(item)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Kartu mobile (< md) */}
          <div className="grid gap-3 md:hidden">
            {siswaTampil.length === 0 ? (
              <Card className="p-4">{emptyState}</Card>
            ) : (
              siswaTampil.map((item) => (
                <Card key={item.id} className="gap-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-start gap-2.5">
                      {renderAvatar(item, 'h-10 w-10')}
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant="outline" className="font-mono">
                            {item.nis}
                          </Badge>
                          <Badge variant="outline">{item.kelas}</Badge>
                        </div>
                        <p className="mt-1.5 truncate font-medium">{item.nama}</p>
                      </div>
                    </div>
                    {renderActions(item)}
                  </div>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>Program: {item.programNama}</p>
                    <p>
                      Halaqoh: {item.halaqohNama ?? <span className="italic">belum ada</span>}
                    </p>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      )}

      {/* Input file foto siswa (tersembunyi) */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFotoChange}
      />

      {/* Dialog tambah/edit siswa */}
      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          if (!open && saving) return
          setFormOpen(open)
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Siswa' : 'Tambah Siswa'}</DialogTitle>
            <DialogDescription>
              {editing
                ? `Perbarui data siswa NIS ${editing.nis}.`
                : 'Isi data santri beserta penempatan program dan halaqoh.'}
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <Field label="NIS" htmlFor="siswa-nis" required>
              <Input
                id="siswa-nis"
                inputMode="numeric"
                value={form.nis}
                onChange={(e) => setForm((prev) => ({ ...prev, nis: e.target.value }))}
                placeholder="cth: 2025001"
                required
                autoFocus
              />
            </Field>
            <Field label="Nama Lengkap" htmlFor="siswa-nama" required>
              <Input
                id="siswa-nama"
                value={form.nama}
                onChange={(e) => setForm((prev) => ({ ...prev, nama: e.target.value }))}
                placeholder="cth: Abdullah ibnu Ahmad"
                required
              />
            </Field>
            <Field label="Kelas" htmlFor="siswa-kelas" required>
              <Input
                id="siswa-kelas"
                value={form.kelas}
                onChange={(e) => setForm((prev) => ({ ...prev, kelas: e.target.value }))}
                placeholder="cth: 7A"
                required
              />
            </Field>
            <Field label="Program Kelas Tahfidz" htmlFor="siswa-program" required>
              <Select
                value={form.programId}
                onValueChange={handleProgramChange}
              >
                <SelectTrigger id="siswa-program" className="w-full">
                  <SelectValue placeholder="Pilih program kelas" />
                </SelectTrigger>
                <SelectContent>
                  {programs.map((program) => (
                    <SelectItem key={program.id} value={program.id}>
                      {program.nama}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field
              label="Halaqoh Binaan"
              htmlFor="siswa-halaqoh"
              hint="Opsional — daftar hanya menampilkan halaqoh dari program yang dipilih."
            >
              <Select
                value={form.halaqohId ?? HALAQOH_NONE}
                onValueChange={handleHalaqohChange}
                disabled={!form.programId}
              >
                <SelectTrigger id="siswa-halaqoh" className="w-full">
                  <SelectValue placeholder="— Pilih Halaqoh —" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={HALAQOH_NONE}>— Pilih Halaqoh —</SelectItem>
                  {filteredHalaqoh.map((h) => (
                    <SelectItem key={h.id} value={h.id}>
                      {h.nama}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setFormOpen(false)}
                disabled={saving}
                className="min-h-11 sm:min-h-9"
              >
                Batal
              </Button>
              <Button type="submit" disabled={saving} className="min-h-11 sm:min-h-9">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {editing ? 'Simpan Perubahan' : 'Tambah Siswa'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog import massal */}
      <SiswaImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        programs={programs}
        halaqohList={halaqohList}
        existingNis={siswa.map((s) => s.nis)}
        onSuccess={refresh}
      />

      {/* Dialog konfirmasi hapus */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null)
        }}
        title="Hapus Siswa"
        description={
          deleteTarget
            ? `Hapus siswa "${deleteTarget.nama}" (NIS ${deleteTarget.nis})? Tindakan ini tidak dapat dibatalkan.`
            : undefined
        }
        loading={deleting}
        onConfirm={handleDelete}
      />
    </>
  )
}

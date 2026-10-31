'use client'

/**
 * Section Data Halaqoh (admin): CRUD halaqoh per program kelas,
 * satu halaqoh bisa dibina lebih dari satu musyrif.
 */
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { AlertTriangle, Loader2, Pencil, Plus, Trash2, Users } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/client'
import type { HalaqohItem, MusyrifItem, Program } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import {
  ConfirmDialog,
  EmptyState,
  Field,
  LoadingBlock,
  SectionHeader,
} from '@/components/dashboard/ui-helpers'

// programId memakai '' (bukan undefined) agar Select selalu terkontrol (tanpa warning React).
interface HalaqohFormState {
  nama: string
  programId: string | ''
}

const EMPTY_HALAQOH_FORM: HalaqohFormState = { nama: '', programId: '' }

export default function HalaqohSection() {
  // ===== Data list (halaqoh + programs + musyrif untuk form) =====
  const [halaqoh, setHalaqoh] = useState<HalaqohItem[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [musyrifList, setMusyrifList] = useState<MusyrifItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let mounted = true
    Promise.all([
      api<{ halaqoh: HalaqohItem[] }>('/api/halaqoh'),
      api<{ programs: Program[] }>('/api/programs'),
      api<{ musyrif: MusyrifItem[] }>('/api/musyrif'),
    ])
      .then(([h, p, m]) => {
        if (!mounted) return
        setHalaqoh(h.halaqoh)
        setPrograms(p.programs)
        setMusyrifList(m.musyrif)
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

  // ===== Dialog tambah/edit =====
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<HalaqohItem | null>(null)
  const [form, setForm] = useState<HalaqohFormState>(EMPTY_HALAQOH_FORM)
  const [selectedMusyrifIds, setSelectedMusyrifIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const openForm = (item: HalaqohItem | null) => {
    setEditing(item)
    setForm(item ? { nama: item.nama, programId: item.programId } : EMPTY_HALAQOH_FORM)
    setSelectedMusyrifIds(item ? item.musyrif.map((m) => m.id) : [])
    setFormOpen(true)
  }

  const toggleMusyrif = (id: string, checked: boolean) => {
    setSelectedMusyrifIds((prev) =>
      checked ? [...prev, id] : prev.filter((v) => v !== id)
    )
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!form.nama.trim()) {
      toast.error('Nama halaqoh wajib diisi.')
      return
    }
    if (!form.programId) {
      toast.error('Pilih program kelas terlebih dahulu.')
      return
    }
    const programId: string = form.programId
    if (selectedMusyrifIds.length === 0) {
      toast.error('Pilih minimal satu musyrif pembina.')
      return
    }
    setSaving(true)
    const body = {
      nama: form.nama.trim(),
      programId,
      musyrifIds: selectedMusyrifIds,
    }
    try {
      if (editing) {
        await api<{ halaqoh: HalaqohItem }>(`/api/halaqoh/${editing.id}`, { method: 'PUT', body })
        toast.success('Halaqoh berhasil diperbarui')
      } else {
        await api<{ halaqoh: HalaqohItem }>('/api/halaqoh', { method: 'POST', body })
        toast.success('Halaqoh berhasil ditambahkan')
      }
      setFormOpen(false)
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan halaqoh')
    } finally {
      setSaving(false)
    }
  }

  // ===== Dialog hapus =====
  const [deleteTarget, setDeleteTarget] = useState<HalaqohItem | null>(null)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api<{ ok: boolean }>(`/api/halaqoh/${deleteTarget.id}`, { method: 'DELETE' })
      toast.success('Halaqoh berhasil dihapus')
      setDeleteTarget(null)
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menghapus halaqoh')
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  // ===== Chips musyrif (maks 2 + sisanya diringkas) =====
  const renderMusyrifChips = (item: HalaqohItem) => (
    <div className="flex flex-wrap items-center gap-1">
      {item.musyrif.slice(0, 2).map((m) => (
        <Badge key={m.id} variant="secondary" className="max-w-40 truncate">
          {m.namaLengkap}
        </Badge>
      ))}
      {item.musyrif.length > 2 ? (
        <Badge variant="outline">+{item.musyrif.length - 2}</Badge>
      ) : null}
      {item.musyrif.length === 0 ? (
        <span className="text-sm text-muted-foreground">—</span>
      ) : null}
    </div>
  )

  // ===== Aksi baris (tabel & kartu) =====
  const renderActions = (item: HalaqohItem) => (
    <div className="flex justify-end gap-1">
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 sm:h-8 sm:w-8"
        aria-label={`Edit halaqoh ${item.nama}`}
        onClick={() => openForm(item)}
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 sm:h-8 sm:w-8 text-destructive hover:text-destructive"
        aria-label={`Hapus halaqoh ${item.nama}`}
        onClick={() => setDeleteTarget(item)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  )

  const emptyState = (
    <EmptyState
      icon={<Users />}
      title="Belum ada halaqoh"
      description="Buat kelompok halaqoh per program kelas dan tentukan musyrif pembinaannya."
    >
      <Button onClick={() => openForm(null)}>
        <Plus className="h-4 w-4" />
        Tambah Halaqoh
      </Button>
    </EmptyState>
  )

  return (
    <>
      <SectionHeader title="Data Halaqoh" description="Kelompok belajar per program kelas.">
        <Button onClick={() => openForm(null)} className="min-h-11 sm:min-h-9">
          <Plus className="h-4 w-4" />
          Tambah Halaqoh
        </Button>
      </SectionHeader>

      {loading ? (
        <LoadingBlock label="Memuat halaqoh…" />
      ) : error ? (
        <EmptyState icon={<AlertTriangle />} title="Gagal memuat data halaqoh" description={error}>
          <Button onClick={refresh}>Coba Lagi</Button>
        </EmptyState>
      ) : (
        <div className="mt-6 space-y-6">
          {/* Tabel desktop (>= md) */}
          <div className="hidden md:block">
            <Card>
              <CardHeader>
                <CardTitle>Daftar Halaqoh</CardTitle>
                <CardDescription>{halaqoh.length} halaqoh terdaftar.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {halaqoh.length === 0 ? (
                  emptyState
                ) : (
                  <div className="max-h-96 overflow-y-auto [scrollbar-width:thin]">
                    <Table>
                      <TableHeader className="sticky top-0 z-10 bg-card">
                        <TableRow>
                          <TableHead className="pl-4 sm:pl-6">Kode</TableHead>
                          <TableHead>Nama</TableHead>
                          <TableHead>Program</TableHead>
                          <TableHead>Musyrif Pembina</TableHead>
                          <TableHead>Jumlah Siswa</TableHead>
                          <TableHead className="pr-4 text-right sm:pr-6">Aksi</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {halaqoh.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="py-3 pl-4 sm:pl-6">
                              <Badge variant="outline" className="font-mono">
                                {item.kode}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-3 font-medium">{item.nama}</TableCell>
                            <TableCell className="py-3 text-sm">{item.programNama}</TableCell>
                            <TableCell className="py-3">{renderMusyrifChips(item)}</TableCell>
                            <TableCell className="py-3 text-sm tabular-nums">
                              {item.jumlahSiswa}
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
            {halaqoh.length === 0 ? (
              <Card className="p-4">{emptyState}</Card>
            ) : (
              halaqoh.map((item) => (
                <Card key={item.id} className="gap-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" className="font-mono">
                          {item.kode}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {item.jumlahSiswa} siswa
                        </span>
                      </div>
                      <p className="mt-1.5 font-medium">{item.nama}</p>
                      <p className="text-sm text-muted-foreground">{item.programNama}</p>
                    </div>
                    {renderActions(item)}
                  </div>
                  {renderMusyrifChips(item)}
                </Card>
              ))
            )}
          </div>
        </div>
      )}

      {/* Dialog tambah/edit halaqoh */}
      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          if (!open && saving) return
          setFormOpen(open)
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Halaqoh' : 'Tambah Halaqoh'}</DialogTitle>
            <DialogDescription>
              {editing
                ? `Perbarui data halaqoh ${editing.kode}.`
                : 'Halaqoh baru akan mendapatkan ID otomatis dari sistem.'}
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <Field
              label="ID Halaqoh"
              htmlFor="halaqoh-kode"
              hint={editing ? undefined : 'ID dibuat otomatis oleh sistem.'}
            >
              <Input
                id="halaqoh-kode"
                disabled
                value={editing ? editing.kode : 'Otomatis (HLQ-001, HLQ-002, …)'}
              />
            </Field>
            <Field label="Nama Halaqoh" htmlFor="halaqoh-nama" required>
              <Input
                id="halaqoh-nama"
                value={form.nama}
                onChange={(e) => setForm((prev) => ({ ...prev, nama: e.target.value }))}
                placeholder="cth: Halaqoh Al-Fatih"
                required
                autoFocus
              />
            </Field>
            <Field label="Program Kelas" htmlFor="halaqoh-program" required>
              <Select
                value={form.programId}
                onValueChange={(value) => setForm((prev) => ({ ...prev, programId: value }))}
              >
                <SelectTrigger id="halaqoh-program" className="w-full">
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
            <Field label="Musyrif Pembina (bisa lebih dari satu)" required>
              <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border p-3 [scrollbar-width:thin]">
                {musyrifList.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Belum ada musyrif terdaftar.</p>
                ) : (
                  musyrifList.map((m) => (
                    <div key={m.id} className="flex min-h-11 items-center gap-2">
                      <Checkbox
                        id={`halaqoh-musyrif-${m.id}`}
                        checked={selectedMusyrifIds.includes(m.id)}
                        onCheckedChange={(checked) => toggleMusyrif(m.id, checked === true)}
                      />
                      <Label
                        htmlFor={`halaqoh-musyrif-${m.id}`}
                        className="cursor-pointer font-normal"
                      >
                        {m.namaLengkap}
                      </Label>
                    </div>
                  ))
                )}
              </div>
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
                {editing ? 'Simpan Perubahan' : 'Tambah Halaqoh'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog konfirmasi hapus */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null)
        }}
        title="Hapus Halaqoh"
        description={
          deleteTarget
            ? `Hapus halaqoh "${deleteTarget.nama}" (${deleteTarget.kode})? Tindakan ini tidak dapat dibatalkan.`
            : undefined
        }
        loading={deleting}
        onConfirm={handleDelete}
      />
    </>
  )
}

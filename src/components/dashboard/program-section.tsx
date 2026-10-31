'use client'

/**
 * Section Program Kelas (admin): daftar program tahfidz + CRUD
 * (kode auto PGM-XXX oleh server, tipe form setoran A/B/C/D).
 */
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { AlertTriangle, FolderOpen, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/client'
import { TIPE_DESC } from '@/lib/format'
import { TIPE_LABEL, TIPE_OPTIONS, type Program, type TipeInputan } from '@/lib/types'
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
import { Textarea } from '@/components/ui/textarea'
import {
  ConfirmDialog,
  EmptyState,
  Field,
  LoadingBlock,
  SectionHeader,
  TipeBadge,
} from '@/components/dashboard/ui-helpers'

// tipeInputan memakai '' (bukan undefined) agar Select selalu terkontrol (tanpa warning React).
interface ProgramFormState {
  nama: string
  tipeInputan: TipeInputan | ''
  targetHafalan: string
}

const EMPTY_PROGRAM_FORM: ProgramFormState = {
  nama: '',
  tipeInputan: '',
  targetHafalan: '',
}

export default function ProgramSection() {
  // ===== Data list =====
  const [programs, setPrograms] = useState<Program[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let mounted = true
    api<{ programs: Program[] }>('/api/programs')
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
  }, [refreshKey])

  const refresh = useCallback(() => {
    setError(null)
    setLoading(true)
    setRefreshKey((k) => k + 1)
  }, [])

  // ===== Dialog tambah/edit =====
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Program | null>(null)
  const [form, setForm] = useState<ProgramFormState>(EMPTY_PROGRAM_FORM)
  const [saving, setSaving] = useState(false)

  const openForm = (program: Program | null) => {
    setEditing(program)
    setForm(
      program
        ? {
            nama: program.nama,
            tipeInputan: program.tipeInputan,
            targetHafalan: program.targetHafalan,
          }
        : EMPTY_PROGRAM_FORM
    )
    setFormOpen(true)
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!form.nama.trim()) {
      toast.error('Nama program wajib diisi.')
      return
    }
    if (!form.tipeInputan) {
      toast.error('Pilih tipe form setoran terlebih dahulu.')
      return
    }
    const tipeInputan: TipeInputan = form.tipeInputan
    setSaving(true)
    const body = {
      nama: form.nama.trim(),
      tipeInputan,
      targetHafalan: form.targetHafalan.trim(),
    }
    try {
      if (editing) {
        await api<{ program: Program }>(`/api/programs/${editing.id}`, { method: 'PUT', body })
        toast.success('Program berhasil diperbarui')
      } else {
        await api<{ program: Program }>('/api/programs', { method: 'POST', body })
        toast.success('Program berhasil ditambahkan')
      }
      setFormOpen(false)
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan program')
    } finally {
      setSaving(false)
    }
  }

  // ===== Dialog hapus =====
  const [deleteTarget, setDeleteTarget] = useState<Program | null>(null)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api<{ ok: boolean }>(`/api/programs/${deleteTarget.id}`, { method: 'DELETE' })
      toast.success('Program berhasil dihapus')
      setDeleteTarget(null)
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menghapus program')
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  // ===== Aksi baris (tabel & kartu) =====
  const renderActions = (program: Program) => (
    <div className="flex justify-end gap-1">
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 sm:h-8 sm:w-8"
        aria-label={`Edit program ${program.nama}`}
        onClick={() => openForm(program)}
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 sm:h-8 sm:w-8 text-destructive hover:text-destructive"
        aria-label={`Hapus program ${program.nama}`}
        onClick={() => setDeleteTarget(program)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  )

  const emptyState = (
    <EmptyState
      icon={<FolderOpen />}
      title="Belum ada program"
      description="Tambahkan program kelas untuk mulai mengelompokkan halaqoh dan siswa."
    >
      <Button onClick={() => openForm(null)}>
        <Plus className="h-4 w-4" />
        Tambah Program
      </Button>
    </EmptyState>
  )

  return (
    <>
      <SectionHeader
        title="Program Kelas"
        description="Kelola program tahfidz beserta tipe form setorannya."
      >
        <Button onClick={() => openForm(null)} className="min-h-11 sm:min-h-9">
          <Plus className="h-4 w-4" />
          Tambah Program
        </Button>
      </SectionHeader>

      {loading ? (
        <LoadingBlock label="Memuat program…" />
      ) : error ? (
        <EmptyState icon={<AlertTriangle />} title="Gagal memuat data program" description={error}>
          <Button onClick={refresh}>Coba Lagi</Button>
        </EmptyState>
      ) : (
        <div className="mt-6 space-y-6">
          {/* Tabel desktop (>= md) */}
          <div className="hidden md:block">
            <Card>
              <CardHeader>
                <CardTitle>Daftar Program</CardTitle>
                <CardDescription>{programs.length} program kelas terdaftar.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {programs.length === 0 ? (
                  emptyState
                ) : (
                  <div className="max-h-96 overflow-y-auto [scrollbar-width:thin]">
                    <Table>
                      <TableHeader className="sticky top-0 z-10 bg-card">
                        <TableRow>
                          <TableHead className="pl-4 sm:pl-6">Kode</TableHead>
                          <TableHead>Nama Program</TableHead>
                          <TableHead>Tipe</TableHead>
                          <TableHead>Target Hafalan</TableHead>
                          <TableHead className="pr-4 text-right sm:pr-6">Aksi</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {programs.map((program) => (
                          <TableRow key={program.id}>
                            <TableCell className="py-3 pl-4 sm:pl-6">
                              <Badge variant="outline" className="font-mono">
                                {program.kode}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-3 font-medium">{program.nama}</TableCell>
                            <TableCell className="py-3">
                              <TipeBadge tipe={program.tipeInputan} />
                              <span className="mt-0.5 block text-xs text-muted-foreground">
                                {TIPE_LABEL[program.tipeInputan]}
                              </span>
                            </TableCell>
                            <TableCell className="max-w-64 py-3 text-sm text-muted-foreground whitespace-normal">
                              {program.targetHafalan}
                            </TableCell>
                            <TableCell className="py-3 pr-4 sm:pr-6">
                              {renderActions(program)}
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
            {programs.length === 0 ? (
              <Card className="p-4">{emptyState}</Card>
            ) : (
              programs.map((program) => (
                <Card key={program.id} className="gap-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" className="font-mono">
                          {program.kode}
                        </Badge>
                        <TipeBadge tipe={program.tipeInputan} />
                      </div>
                      <p className="mt-1.5 font-medium">{program.nama}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {TIPE_LABEL[program.tipeInputan]}
                      </p>
                    </div>
                    {renderActions(program)}
                  </div>
                  {program.targetHafalan ? (
                    <p className="text-sm text-muted-foreground">
                      Target hafalan: {program.targetHafalan}
                    </p>
                  ) : null}
                </Card>
              ))
            )}
          </div>
        </div>
      )}

      {/* Dialog tambah/edit program */}
      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          if (!open && saving) return
          setFormOpen(open)
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Program' : 'Tambah Program'}</DialogTitle>
            <DialogDescription>
              {editing
                ? `Perbarui data program ${editing.kode}.`
                : 'Program baru akan mendapatkan ID otomatis dari sistem.'}
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <Field
              label="ID Program"
              htmlFor="program-kode"
              hint={editing ? undefined : 'ID dibuat otomatis oleh sistem.'}
            >
              <Input
                id="program-kode"
                disabled
                value={editing ? editing.kode : 'Otomatis (PGM-001, PGM-002, …)'}
              />
            </Field>
            <Field label="Nama Program" htmlFor="program-nama" required>
              <Input
                id="program-nama"
                value={form.nama}
                onChange={(e) => setForm((prev) => ({ ...prev, nama: e.target.value }))}
                placeholder="cth: Tahfidz Juz 30"
                required
                autoFocus
              />
            </Field>
            <Field label="Tipe Form Setoran" htmlFor="program-tipe" required>
              <>
                <Select
                  value={form.tipeInputan}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, tipeInputan: value as TipeInputan }))
                  }
                >
                  <SelectTrigger id="program-tipe" className="w-full">
                    <SelectValue placeholder="Pilih tipe form setoran" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPE_OPTIONS.map((tipe) => (
                      <SelectItem key={tipe} value={tipe}>
                        {TIPE_LABEL[tipe]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.tipeInputan ? (
                  <div className="rounded-md bg-secondary/50 p-3 text-xs text-muted-foreground">
                    {TIPE_DESC[form.tipeInputan]}
                  </div>
                ) : null}
              </>
            </Field>
            <Field label="Target Hafalan" htmlFor="program-target">
              <Textarea
                id="program-target"
                rows={2}
                value={form.targetHafalan}
                onChange={(e) => setForm((prev) => ({ ...prev, targetHafalan: e.target.value }))}
                placeholder="cth: Juz 30 dan Juz 1"
              />
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
                {editing ? 'Simpan Perubahan' : 'Tambah Program'}
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
        title="Hapus Program"
        description={
          deleteTarget
            ? `Hapus program "${deleteTarget.nama}" (${deleteTarget.kode})? Tindakan ini tidak dapat dibatalkan.`
            : undefined
        }
        loading={deleting}
        onConfirm={handleDelete}
      />
    </>
  )
}

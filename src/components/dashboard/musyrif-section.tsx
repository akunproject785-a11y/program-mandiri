'use client'

/**
 * Section Data Musyrif (admin): CRUD akun pembina halaqoh + reset password.
 */
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  AlertTriangle,
  IdCard,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/client'
import type { MusyrifItem } from '@/lib/types'
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

interface MusyrifFormState {
  nik: string
  namaLengkap: string
  email: string
  password: string
}

const EMPTY_MUSYRIF_FORM: MusyrifFormState = {
  nik: '',
  namaLengkap: '',
  email: '',
  password: '',
}

export default function MusyrifSection() {
  // ===== Data list =====
  const [musyrif, setMusyrif] = useState<MusyrifItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let mounted = true
    api<{ musyrif: MusyrifItem[] }>('/api/musyrif')
      .then((data) => {
        if (mounted) setMusyrif(data.musyrif)
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
  const [editing, setEditing] = useState<MusyrifItem | null>(null)
  const [form, setForm] = useState<MusyrifFormState>(EMPTY_MUSYRIF_FORM)
  const [saving, setSaving] = useState(false)

  const openForm = (item: MusyrifItem | null) => {
    setEditing(item)
    setForm(
      item
        ? { nik: item.nik, namaLengkap: item.namaLengkap, email: item.email, password: '' }
        : EMPTY_MUSYRIF_FORM
    )
    setFormOpen(true)
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!form.nik.trim() || !form.namaLengkap.trim() || !form.email.trim()) {
      toast.error('NIK, nama lengkap, dan email wajib diisi.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      toast.error('Format email tidak valid.')
      return
    }
    if (!editing && !form.password.trim()) {
      toast.error('Password wajib diisi untuk musyrif baru.')
      return
    }
    setSaving(true)
    const body: {
      nik: string
      namaLengkap: string
      email: string
      password?: string
    } = {
      nik: form.nik.trim(),
      namaLengkap: form.namaLengkap.trim(),
      email: form.email.trim().toLowerCase(),
    }
    // Password hanya dikirim saat edit jika diisi (kosong = tidak diubah).
    if (!editing || form.password.trim()) body.password = form.password.trim()
    try {
      if (editing) {
        await api<{ musyrif: MusyrifItem }>(`/api/musyrif/${editing.id}`, { method: 'PUT', body })
        toast.success('Musyrif berhasil diperbarui')
      } else {
        await api<{ musyrif: MusyrifItem }>('/api/musyrif', { method: 'POST', body })
        toast.success('Musyrif berhasil ditambahkan')
      }
      setFormOpen(false)
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan musyrif')
    } finally {
      setSaving(false)
    }
  }

  // ===== Dialog reset password =====
  const [resetTarget, setResetTarget] = useState<MusyrifItem | null>(null)
  const [resetPassword, setResetPassword] = useState('')
  const [resetSaving, setResetSaving] = useState(false)

  const closeResetDialog = useCallback(() => {
    setResetTarget(null)
    setResetPassword('')
  }, [])

  const handleResetSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!resetTarget) return
    if (resetPassword.length < 6) {
      toast.error('Password baru minimal 6 karakter.')
      return
    }
    setResetSaving(true)
    try {
      await api<{ ok: boolean }>(`/api/musyrif/${resetTarget.id}/reset-password`, {
        method: 'POST',
        body: { password: resetPassword },
      })
      toast.success('Password berhasil direset')
      closeResetDialog()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal mereset password')
      closeResetDialog()
    } finally {
      setResetSaving(false)
    }
  }

  // ===== Dialog hapus =====
  const [deleteTarget, setDeleteTarget] = useState<MusyrifItem | null>(null)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api<{ ok: boolean }>(`/api/musyrif/${deleteTarget.id}`, { method: 'DELETE' })
      toast.success('Musyrif berhasil dihapus')
      setDeleteTarget(null)
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menghapus musyrif')
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  // ===== Aksi baris (tabel & kartu) =====
  const renderActions = (item: MusyrifItem) => (
    <div className="flex justify-end gap-1">
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 sm:h-8 sm:w-8"
        aria-label={`Edit musyrif ${item.namaLengkap}`}
        onClick={() => openForm(item)}
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 sm:h-8 sm:w-8"
        aria-label={`Reset password musyrif ${item.namaLengkap}`}
        onClick={() => {
          setResetTarget(item)
          setResetPassword('')
        }}
      >
        <KeyRound className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 sm:h-8 sm:w-8 text-destructive hover:text-destructive"
        aria-label={`Hapus musyrif ${item.namaLengkap}`}
        onClick={() => setDeleteTarget(item)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  )

  const emptyState = (
    <EmptyState
      icon={<IdCard />}
      title="Belum ada musyrif"
      description="Tambahkan musyrif sebagai pembina halaqoh dengan akun login masing-masing."
    >
      <Button onClick={() => openForm(null)}>
        <Plus className="h-4 w-4" />
        Tambah Musyrif
      </Button>
    </EmptyState>
  )

  return (
    <>
      <SectionHeader title="Data Musyrif" description="Kelola akun pembina halaqoh.">
        <Button onClick={() => openForm(null)} className="min-h-11 sm:min-h-9">
          <Plus className="h-4 w-4" />
          Tambah Musyrif
        </Button>
      </SectionHeader>

      {loading ? (
        <LoadingBlock label="Memuat musyrif…" />
      ) : error ? (
        <EmptyState icon={<AlertTriangle />} title="Gagal memuat data musyrif" description={error}>
          <Button onClick={refresh}>Coba Lagi</Button>
        </EmptyState>
      ) : (
        <div className="mt-6 space-y-6">
          {/* Tabel desktop (>= md) */}
          <div className="hidden md:block">
            <Card>
              <CardHeader>
                <CardTitle>Daftar Musyrif</CardTitle>
                <CardDescription>{musyrif.length} akun pembina terdaftar.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {musyrif.length === 0 ? (
                  emptyState
                ) : (
                  <div className="max-h-96 overflow-y-auto [scrollbar-width:thin]">
                    <Table>
                      <TableHeader className="sticky top-0 z-10 bg-card">
                        <TableRow>
                          <TableHead className="pl-4 sm:pl-6">NIK</TableHead>
                          <TableHead>Nama Lengkap</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead className="pr-4 text-right sm:pr-6">Aksi</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {musyrif.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="py-3 pl-4 font-mono text-sm sm:pl-6">
                              {item.nik}
                            </TableCell>
                            <TableCell className="py-3 font-medium">{item.namaLengkap}</TableCell>
                            <TableCell className="py-3">
                              <Badge variant="outline" className="max-w-56 truncate">{item.email}</Badge>
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
            {musyrif.length === 0 ? (
              <Card className="p-4">{emptyState}</Card>
            ) : (
              musyrif.map((item) => (
                <Card key={item.id} className="gap-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-xs text-muted-foreground">NIK {item.nik}</p>
                      <p className="mt-1 font-medium">{item.namaLengkap}</p>
                    </div>
                    {renderActions(item)}
                  </div>
                  <div>
                    <Badge variant="outline" className="max-w-full truncate">{item.email}</Badge>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      )}

      {/* Dialog tambah/edit musyrif */}
      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          if (!open && saving) return
          setFormOpen(open)
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Musyrif' : 'Tambah Musyrif'}</DialogTitle>
            <DialogDescription>
              {editing
                ? `Perbarui akun musyrif ${editing.namaLengkap}.`
                : 'Musyrif baru dapat langsung login sebagai pembina halaqoh.'}
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <Field label="NIK" htmlFor="musyrif-nik" required>
              <Input
                id="musyrif-nik"
                inputMode="numeric"
                value={form.nik}
                onChange={(e) => setForm((prev) => ({ ...prev, nik: e.target.value }))}
                placeholder="cth: 32010003"
                required
                autoFocus
              />
            </Field>
            <Field label="Nama Lengkap" htmlFor="musyrif-nama" required>
              <Input
                id="musyrif-nama"
                value={form.namaLengkap}
                onChange={(e) => setForm((prev) => ({ ...prev, namaLengkap: e.target.value }))}
                placeholder="cth: Ust. Muhammad Ali"
                required
              />
            </Field>
            <Field label="Email" htmlFor="musyrif-email" required>
              <Input
                id="musyrif-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="cth: ali@quranmandiri.id"
                required
                autoComplete="off"
              />
            </Field>
            <Field
              label="Password"
              htmlFor="musyrif-password"
              required={!editing}
              hint={editing ? 'Kosongkan jika tidak ingin mengubah password.' : 'Minimal 6 karakter.'}
            >
              <Input
                id="musyrif-password"
                type="password"
                value={form.password}
                onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                required={!editing}
                autoComplete="new-password"
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
                {editing ? 'Simpan Perubahan' : 'Tambah Musyrif'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog reset password */}
      <Dialog
        open={resetTarget !== null}
        onOpenChange={(open) => {
          if (!open && resetSaving) return
          if (!open) closeResetDialog()
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Reset Password — {resetTarget?.namaLengkap ?? ''}
            </DialogTitle>
            <DialogDescription>
              Password baru akan langsung dipakai musyrif pada login berikutnya.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleResetSubmit}>
            <Field label="Password Baru" htmlFor="musyrif-reset-password" required hint="Minimal 6 karakter.">
              <Input
                id="musyrif-reset-password"
                type="password"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                minLength={6}
                required
                autoFocus
                autoComplete="new-password"
              />
            </Field>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={closeResetDialog}
                disabled={resetSaving}
                className="min-h-11 sm:min-h-9"
              >
                Batal
              </Button>
              <Button type="submit" disabled={resetSaving} className="min-h-11 sm:min-h-9">
                {resetSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Reset Password
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
        title="Hapus Musyrif"
        description={
          deleteTarget
            ? `Hapus musyrif ${deleteTarget.namaLengkap}? Musyrif akan dilepas dari semua halaqoh.`
            : undefined
        }
        loading={deleting}
        onConfirm={handleDelete}
      />
    </>
  )
}

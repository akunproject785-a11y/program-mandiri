'use client'

/**
 * POPUP (Dialog) input setoran untuk SATU siswa pada alur Input Setoran musyrif.
 *
 * Isi popup:
 *  1. Identitas siswa (NIS, kelas, program, halaqoh).
 *  2. Panel "Setoran Terakhir — semua jenis" (SetoranTerakhirList variant panel)
 *     sebagai konteks titik lanjutan sebelum mengisi form — lengkap dengan
 *     tombol EDIT & HAPUS pada catatan yang boleh dikelola (admin: semua;
 *     musyrif: rekamannya sendiri). Edit/hapus dilakukan langsung di popup ini
 *     tanpa menutup popup, dan panel diperbarui otomatis setelahnya.
 *  3. Form dinamis SetoranFormFields sesuai tipe program siswa (A/B/C/D).
 *
 * Seluruh isi termount ulang setiap popup dibuka (dirender hanya saat open) —
 * tidak perlu reset manual. `onDataChanged` dipanggil setelah ada edit/hapus
 * agar parent dapat menyegarkan daftar siswa di belakang popup.
 */
import { useState } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/client'
import type {
  SetoranItem,
  SiswaItem,
  SiswaTerakhirInfo,
  TerakhirMap,
  UserInfo,
} from '@/lib/types'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/dashboard/ui-helpers'
import SetoranTerakhirList from '@/components/dashboard/setoran-terakhir'
import SetoranFormFields from '@/components/dashboard/setoran-form-fields'
import SetoranEditDialog from '@/components/dashboard/setoran-edit-dialog'

export default function SetoranSiswaPopup({
  open,
  onOpenChange,
  siswa,
  terakhir,
  onSaved,
  onDataChanged,
  user,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  siswa: SiswaItem | null
  terakhir?: SiswaTerakhirInfo | null
  onSaved: () => void
  /** Dipanggil setelah setoran di-edit/dihapus (popup tetap terbuka). */
  onDataChanged?: () => void
  /** User login — untuk menentukan izin edit/hapus. */
  user: UserInfo
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && siswa ? (
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="pr-6 text-base sm:text-lg">
              <span className="min-w-0">Input Setoran — {siswa.nama}</span>
            </DialogTitle>
            <DialogDescription>
              NIS {siswa.nis} • Kelas {siswa.kelas} • Program {siswa.programNama} • Halaqoh{' '}
              {siswa.halaqohNama ?? '—'}
            </DialogDescription>
          </DialogHeader>

          <PopupBody
            siswa={siswa}
            initialTerakhir={terakhir ?? null}
            user={user}
            onOpenChange={onOpenChange}
            onSaved={onSaved}
            onDataChanged={onDataChanged}
          />
        </DialogContent>
      ) : null}
    </Dialog>
  )
}

/**
 * Isi popup — termount ulang setiap popup dibuka. Memegang state lokal info
 * setoran terakhir agar panel bisa diperbarui setelah edit/hapus tanpa menutup
 * popup, plus state dialog edit & konfirmasi hapus.
 */
function PopupBody({
  siswa,
  initialTerakhir,
  user,
  onOpenChange,
  onSaved,
  onDataChanged,
}: {
  siswa: SiswaItem
  initialTerakhir: SiswaTerakhirInfo | null
  user: UserInfo
  onOpenChange: (open: boolean) => void
  onSaved: () => void
  onDataChanged?: () => void
}) {
  const [terakhirInfo, setTerakhirInfo] = useState<SiswaTerakhirInfo | null>(initialTerakhir)
  const [editTarget, setEditTarget] = useState<SetoranItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SetoranItem | null>(null)
  const [deleting, setDeleting] = useState(false)

  const isAdmin = user.role === 'admin'

  /** Izin kelola satu setoran: admin semua, musyrif hanya rekamannya sendiri. */
  const canManage = (item: SetoranItem) =>
    isAdmin || (user.musyrifId != null && item.musyrifId === user.musyrifId)

  /** Segarkan panel setoran terakhir dari server (tanpa menutup popup). */
  const refreshTerakhir = () => {
    api<{ terakhir: TerakhirMap }>(
      `/api/siswa/terakhir?siswaId=${encodeURIComponent(siswa.id)}`
    )
      .then((d) => setTerakhirInfo(d.terakhir?.[siswa.id] ?? null))
      .catch(() => {
        /* panel tetap menampilkan data lama jika gagal — tidak fatal */
      })
  }

  const handleEditSaved = () => {
    setEditTarget(null)
    refreshTerakhir()
    onDataChanged?.()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api(`/api/setoran/${deleteTarget.id}`, { method: 'DELETE' })
      toast.success('Setoran dihapus')
      setDeleteTarget(null)
      refreshTerakhir()
      onDataChanged?.()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Terjadi kesalahan. Silakan coba lagi.'
      )
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Catatan setoran terakhir SEMUA jenis — konteks titik lanjutan + aksi edit/hapus */}
      <SetoranTerakhirList
        info={terakhirInfo}
        variant="panel"
        canManage={canManage}
        onEdit={(item) => setEditTarget(item)}
        onDelete={(item) => setDeleteTarget(item)}
      />

      {/* Form dinamis sesuai tipe program siswa — musyrif wajib absen dulu */}
      <SetoranFormFields
        key={siswa.id}
        siswa={siswa}
        wajibAbsen={user.role === 'musyrif'}
        onSuccess={() => {
          onSaved()
          onOpenChange(false)
        }}
        onCancel={() => onOpenChange(false)}
      />

      {/* Dialog edit setoran dari panel terakhir */}
      <SetoranEditDialog
        open={editTarget !== null}
        onOpenChange={(o) => {
          if (!o) setEditTarget(null)
        }}
        setoran={editTarget}
        onSaved={handleEditSaved}
      />

      {/* Konfirmasi hapus setoran dari panel terakhir */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => {
          if (!o) setDeleteTarget(null)
        }}
        title="Hapus setoran ini?"
        description={
          deleteTarget
            ? `Setoran ${deleteTarget.siswaNama} pada ${deleteTarget.tanggal} tidak dapat dikembalikan.`
            : 'Data tidak dapat dikembalikan.'
        }
        confirmText="Hapus"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  )
}

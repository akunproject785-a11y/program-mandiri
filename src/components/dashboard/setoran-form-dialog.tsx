'use client'

/**
 * Dialog "Catat Setoran Baru": pilih siswa, lalu form dinamis menyesuaikan
 * tipeInputan program siswa (Type A / B / C / D).
 * Isi form dinamis hidup di `setoran-form-fields.tsx` (dipakai bersama
 * InputSetoranSection di dashboard musyrif). Seluruh state dialog termount
 * ulang bersih setiap kali dialog dibuka — tidak perlu reset manual.
 */
import { useEffect, useState } from 'react'
import { AlertTriangle, Users } from 'lucide-react'
import { api } from '@/lib/client'
import type { SiswaItem } from '@/lib/types'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  EmptyState,
  Field,
  LoadingBlock,
} from '@/components/dashboard/ui-helpers'
import SetoranFormFields from '@/components/dashboard/setoran-form-fields'

export default function SetoranFormDialog({
  open,
  onOpenChange,
  onSaved,
  defaultSiswaId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
  defaultSiswaId?: string
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Catat Setoran Baru</DialogTitle>
            <DialogDescription>
              Pilih siswa terlebih dahulu, lalu isi form sesuai tipe programnya.
            </DialogDescription>
          </DialogHeader>
          <SetoranDialogContent
            onOpenChange={onOpenChange}
            onSaved={onSaved}
            defaultSiswaId={defaultSiswaId}
          />
        </DialogContent>
      ) : null}
    </Dialog>
  )
}

/** Isi dialog (daftar siswa + form dinamis). Termount ulang setiap dialog dibuka. */
function SetoranDialogContent({
  onOpenChange,
  onSaved,
  defaultSiswaId,
}: {
  onOpenChange: (open: boolean) => void
  onSaved: () => void
  defaultSiswaId?: string
}) {
  const [siswaList, setSiswaList] = useState<SiswaItem[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [siswaId, setSiswaId] = useState('')

  useEffect(() => {
    let mounted = true
    api<{ siswa: SiswaItem[] }>('/api/siswa')
      .then((data) => {
        if (!mounted) return
        setSiswaList(data.siswa)
        if (defaultSiswaId && data.siswa.some((s) => s.id === defaultSiswaId)) {
          setSiswaId(defaultSiswaId)
        }
      })
      .catch((err: Error) => {
        if (mounted) setListError(err.message)
      })
      .finally(() => {
        if (mounted) setListLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [reloadKey, defaultSiswaId])

  const selectedSiswa = siswaList.find((s) => s.id === siswaId) ?? null

  const retryFetch = () => {
    setListError(null)
    setListLoading(true)
    setReloadKey((k) => k + 1)
  }

  if (listLoading) {
    return <LoadingBlock label="Memuat daftar siswa…" />
  }

  if (listError) {
    return (
      <EmptyState
        icon={<AlertTriangle />}
        title="Gagal memuat daftar siswa"
        description={listError}
      >
        <Button onClick={retryFetch} className="min-h-11 sm:min-h-9">
          Coba Lagi
        </Button>
      </EmptyState>
    )
  }

  if (siswaList.length === 0) {
    return (
      <EmptyState
        icon={<Users />}
        title="Belum ada siswa"
        description="Belum ada siswa yang bisa dipilih. Admin dapat menambahkan siswa melalui menu Data Siswa terlebih dahulu."
      />
    )
  }

  return (
    <div className="space-y-4">
      {/* Pilih siswa */}
      <Field label="Pilih Siswa" required htmlFor="setoran-siswa">
        <Select value={siswaId} onValueChange={setSiswaId}>
          <SelectTrigger
            id="setoran-siswa"
            aria-label="Pilih siswa"
            className="w-full min-h-11"
          >
            <SelectValue placeholder="Pilih siswa…" />
          </SelectTrigger>
          <SelectContent>
            {siswaList.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                <span className="flex flex-col items-start gap-0.5">
                  <span className="font-medium">
                    {s.nama} — {s.nis}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {s.kelas} • {s.halaqohNama ?? 'Tanpa halaqoh'}
                  </span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {/* Info program siswa terpilih */}
      {selectedSiswa ? (
        <div className="space-y-1.5 rounded-md bg-secondary/50 p-3 text-sm">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p>
              <span className="text-muted-foreground">Program: </span>
              <span className="font-medium">{selectedSiswa.programNama}</span>
            </p>
          </div>
          <p>
            <span className="text-muted-foreground">Halaqoh: </span>
            <span className="font-medium">{selectedSiswa.halaqohNama ?? '—'}</span>
          </p>
          <p className="text-xs text-muted-foreground">Form menyesuaikan program yang dipilih.</p>
        </div>
      ) : null}

      {/* Form dinamis sesuai tipe program siswa */}
      {selectedSiswa ? (
        <SetoranFormFields
          key={selectedSiswa.id}
          siswa={selectedSiswa}
          onSuccess={() => {
            onSaved()
            onOpenChange(false)
          }}
          onCancel={() => onOpenChange(false)}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          Pilih siswa untuk menampilkan form setoran.
        </p>
      )}
    </div>
  )
}

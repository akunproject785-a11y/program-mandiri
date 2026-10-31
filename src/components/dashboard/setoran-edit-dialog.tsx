'use client'

/**
 * Dialog EDIT setoran yang sudah ada (PUT /api/setoran/:id).
 * Dipakai oleh:
 *  - RekapanSection (tabel & kartu rekap setoran)
 *  - SetoranSiswaPopup (panel "Setoran Terakhir" pada alur Input Setoran)
 *
 * Isi popup: info siswa/program + form dinamis SetoranFormFields (mode EDIT)
 * yang sudah terisi data lama. Field identitas (siswa/tipe/program) tidak
 * dapat diubah — hanya isi data setoran (tanggal, materi, nilai, catatan).
 *
 * Seluruh isi termount ulang setiap dialog dibuka (dirender hanya saat open).
 */
import type { SetoranItem } from '@/lib/types'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import SetoranFormFields from '@/components/dashboard/setoran-form-fields'

export default function SetoranEditDialog({
  open,
  onOpenChange,
  setoran,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  setoran: SetoranItem | null
  onSaved: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && setoran ? (
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="pr-6 text-base sm:text-lg">
              <span className="min-w-0">Edit Setoran — {setoran.siswaNama}</span>
            </DialogTitle>
            <DialogDescription>
              NIS {setoran.siswaNis} • Program {setoran.programNama} • Pencatat:{' '}
              {setoran.musyrifNama ?? 'Admin'}
            </DialogDescription>
          </DialogHeader>

          <SetoranFormFields
            initial={setoran}
            onSuccess={() => {
              onSaved()
              onOpenChange(false)
            }}
            onCancel={() => onOpenChange(false)}
          />
        </DialogContent>
      ) : null}
    </Dialog>
  )
}

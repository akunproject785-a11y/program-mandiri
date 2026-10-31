'use client'

/**
 * Dialog review sebelum share ke WhatsApp (Rekap Setoran):
 * 1. Pratinjau teks rekap yang akan dikirim (persis seperti yang diterima WA).
 * 2. Tombol "Salin Teks" — menyalin teks ke clipboard (untuk ditempel manual
 *    ke grup/obrolan WhatsApp mana pun).
 * 3. Tombol "Bagikan ke WhatsApp" — navigator.share (mobile, bisa pilih grup)
 *    dengan fallback wa.me (desktop / WhatsApp Web).
 */
import { useState } from 'react'
import { Check, Copy, Loader2, MessageCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

/** Salin teks ke clipboard dengan fallback untuk konteks non-secure. */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* lanjut ke fallback */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

export default function WaShareDialog({
  open,
  onOpenChange,
  text,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Teks rekap lengkap yang akan dibagikan/dispalin. */
  text: string
}) {
  const [copied, setCopied] = useState(false)
  const [sharing, setSharing] = useState(false)

  const handleCopy = async () => {
    const ok = await copyToClipboard(text)
    if (ok) {
      setCopied(true)
      toast.success('Teks berhasil disalin — tempel (paste) di grup WhatsApp Anda.')
      window.setTimeout(() => setCopied(false), 2500)
    } else {
      toast.error('Gagal menyalin teks. Silakan salin manual dari pratinjau.')
    }
  }

  const handleShare = async () => {
    setSharing(true)
    let shared = false
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        // Mobile: share sheet terbuka → user memilih grup WhatsApp langsung.
        await navigator.share({ text })
        shared = true
      }
    } catch (err) {
      // User membatalkan share sheet → cukup tutup state, jangan fallback.
      if (err instanceof Error && err.name === 'AbortError') {
        setSharing(false)
        return
      }
      // Error lain (tidak didukung/blocked) → lanjut fallback wa.me di bawah.
    }
    if (!shared) {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
    }
    setSharing(false)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-[#25D366]" aria-hidden />
            Bagikan ke WhatsApp
          </DialogTitle>
          <DialogDescription>
            Periksa hasil rekap di bawah ini sebelum dikirim ke grup.
          </DialogDescription>
        </DialogHeader>

        {/* Pratinjau teks yang akan dikirim */}
        <div
          role="region"
          aria-label="Pratinjau pesan WhatsApp"
          className="max-h-[40vh] overflow-y-auto rounded-lg border bg-muted/40 p-3 text-sm whitespace-pre-wrap break-words [scrollbar-width:thin]"
        >
          {text}
        </div>
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {text.length} karakter • Format tebal/miring ala WhatsApp sudah disertakan.
        </p>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleCopy()}
            className="min-h-11 w-full sm:w-auto sm:min-h-9"
          >
            {copied ? (
              <Check className="h-4 w-4 text-primary" aria-hidden />
            ) : (
              <Copy className="h-4 w-4" aria-hidden />
            )}
            {copied ? 'Tersalin' : 'Salin Teks'}
          </Button>
          <Button
            type="button"
            onClick={() => void handleShare()}
            disabled={sharing}
            className="min-h-11 w-full bg-[#25D366] text-white hover:bg-[#1eb85a] sm:w-auto sm:min-h-9"
          >
            {sharing ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <MessageCircle className="h-4 w-4" aria-hidden />
            )}
            Bagikan ke WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

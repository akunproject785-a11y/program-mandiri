'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, BookOpenText } from 'lucide-react'
import { api } from '@/lib/client'
import { ABSEN_POPUP_SKIP_KEY } from '@/components/dashboard/absen-awal-dialog'
import type { UserInfo } from '@/lib/types'
import LandingPage from '@/components/landing/landing-page'
import Dashboard from '@/components/dashboard/dashboard'

export default function Home() {
  const [user, setUser] = useState<UserInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    api<{ user: UserInfo | null }>('/api/auth/session')
      .then((data) => {
        if (mounted) setUser(data.user ?? null)
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  const handleLogout = useCallback(async () => {
    try {
      await api('/api/auth/logout', { method: 'POST' })
    } catch {
      // abaikan, tetap kembali ke landing
    }
    // Reset popup pengingat absen agar login berikutnya memunculkannya lagi.
    try {
      sessionStorage.removeItem(ABSEN_POPUP_SKIP_KEY)
    } catch {
      /* abaikan */
    }
    setUser(null)
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
          <BookOpenText className="h-8 w-8" />
        </div>
        <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Memuat Program Qur&apos;an Mandiri…
        </p>
      </div>
    )
  }

  if (user) {
    return <Dashboard user={user} onLogout={handleLogout} />
  }

  return (
    <LandingPage
      onLoginSuccess={(u) => {
        setUser(u)
      }}
    />
  )
}

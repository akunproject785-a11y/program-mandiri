'use client'

/**
 * Shell dashboard SPA:
 * - Desktop (lg+): sidebar hijau gelap (token sidebar) — tidak berubah.
 * - Mobile (<lg): topbar ringkas + BOTTOM NAVIGATION BAR ala aplikasi Android
 *   (ikon + label di bawah layar; bila menu lebih dari 5, sisanya masuk sheet
 *   "Lainnya" yang muncul dari bawah).
 * Tidak melakukan fetch apa pun di sini.
 */
import { useEffect, useRef, useState } from 'react'
import {
  BookOpenText,
  CalendarClock,
  Camera,
  ClipboardList,
  FolderOpen,
  GraduationCap,
  IdCard,
  LayoutDashboard,
  LogOut,
  MoreHorizontal,
  PenLine,
  Settings,
  UserCheck,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import type { UserInfo } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { ThemeToggle } from '@/components/theme-toggle'
import RingkasanSection from '@/components/dashboard/ringkasan-section'
import RekapanSection from '@/components/dashboard/rekapan-section'
import InputSetoranSection from '@/components/dashboard/input-setoran-section'
import AbsensiSection from '@/components/dashboard/absensi-section'
import ProgramSection from '@/components/dashboard/program-section'
import MusyrifSection from '@/components/dashboard/musyrif-section'
import HalaqohSection from '@/components/dashboard/halaqoh-section'
import SiswaSection from '@/components/dashboard/siswa-section'
import KelolaAbsensiSection from '@/components/dashboard/kelola-absensi-section'
import RekapAbsensiSection from '@/components/dashboard/rekap-absensi-section'
import AbsenAwalDialog from '@/components/dashboard/absen-awal-dialog'
import SettingsSection from '@/components/dashboard/settings-section'

export type SectionKey =
  | 'ringkasan'
  | 'input-setoran'
  | 'absensi'
  | 'program'
  | 'musyrif'
  | 'halaqoh'
  | 'siswa'
  | 'rekapan'
  | 'kelola-absensi'
  | 'rekap-absensi'
  | 'pengaturan'

interface MenuItem {
  key: SectionKey
  label: string
  /** Label pendek untuk bottom nav mobile. */
  shortLabel: string
  icon: LucideIcon
  /** true = hanya admin. */
  adminOnly?: boolean
  /** true = hanya musyrif. */
  musyrifOnly?: boolean
  /** true = tampil langsung di bottom nav mobile (sisanya masuk "Lainnya"). */
  primary?: boolean
}

const MENU: MenuItem[] = [
  { key: 'ringkasan', label: 'Ringkasan', shortLabel: 'Ringkasan', icon: LayoutDashboard, primary: true },
  // Absen tepat di bawah Ringkasan (permintaan: menu absen musyrif berada di bawah ringkasan)
  { key: 'absensi', label: 'Absen', shortLabel: 'Absen', icon: Camera, musyrifOnly: true, primary: true },
  { key: 'input-setoran', label: 'Input Setoran', shortLabel: 'Setoran', icon: PenLine, musyrifOnly: true, primary: true },
  { key: 'program', label: 'Program Kelas', shortLabel: 'Program', icon: FolderOpen, adminOnly: true, primary: true },
  { key: 'musyrif', label: 'Data Musyrif', shortLabel: 'Musyrif', icon: IdCard, adminOnly: true },
  { key: 'halaqoh', label: 'Data Halaqoh', shortLabel: 'Halaqoh', icon: Users, adminOnly: true },
  { key: 'siswa', label: 'Data Siswa', shortLabel: 'Siswa', icon: GraduationCap, adminOnly: true, primary: true },
  { key: 'rekapan', label: 'Rekap Setoran', shortLabel: 'Rekap', icon: ClipboardList, primary: true },
  { key: 'kelola-absensi', label: 'Kelola Absen Musyrif', shortLabel: 'Kelola Absen', icon: UserCheck, adminOnly: true },
  { key: 'rekap-absensi', label: 'Rekap Absen Musyrif', shortLabel: 'Rekap Absen', icon: CalendarClock, adminOnly: true },
  { key: 'pengaturan', label: 'Pengaturan', shortLabel: 'Pengaturan', icon: Settings },
]

/** Batas jumlah item yang tampil langsung di bottom nav (sisanya → "Lainnya"). */
const MAX_BOTTOM_ITEMS = 4

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.charAt(0) ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? '') : (parts[0]?.charAt(1) ?? '')
  return (first + last).toUpperCase() || '?'
}

/** Konten menu sidebar desktop (lg+). */
function SidebarContent({
  user,
  current,
  onSelect,
  onLogout,
}: {
  user: UserInfo
  current: SectionKey
  onSelect: (section: SectionKey) => void
  onLogout: () => void
}) {
  /** Musyrif hanya melihat menu non-adminOnly + musyrifOnly; admin lihat non-musyrifOnly. */
  const items = MENU.filter(
    (m) =>
      (!m.adminOnly || user.role === 'admin') &&
      (!m.musyrifOnly || user.role === 'musyrif')
  )
  const initials = getInitials(user.name)

  return (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="flex items-center gap-3 px-4 py-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/20 p-2">
          <BookOpenText className="h-6 w-6 text-sidebar-primary" />
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-sidebar-foreground">Program Qur&apos;an</p>
          <p className="text-xs text-sidebar-foreground/70">Mandiri</p>
        </div>
      </div>

      {/* Nav menu */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4" aria-label="Menu dashboard">
        {items.map((item) => {
          const Icon = item.icon
          const active = current === item.key
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelect(item.key)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex w-full min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
                active
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          )
        })}
      </nav>

      {/* Kartu user */}
      <div className="px-3 pb-4">
        <div className="rounded-lg bg-sidebar-accent/40 p-3">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-sidebar-foreground">{user.name}</p>
              <span className="mt-0.5 inline-flex w-fit rounded-md bg-sidebar-primary/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sidebar-primary">
                {user.role === 'admin' ? 'Admin' : 'Musyrif'}
              </span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onLogout}
            className="mt-2 w-full justify-start text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
          >
            <LogOut className="h-4 w-4" />
            Keluar
          </Button>
        </div>
      </div>
    </div>
  )
}

/** Satu tombol item navigasi bawah (ikon + label pendek, gaya aplikasi Android). */
function BottomNavItem({
  item,
  active,
  onSelect,
}: {
  item: MenuItem
  active: boolean
  onSelect: (section: SectionKey) => void
}) {
  const Icon = item.icon
  return (
    <button
      type="button"
      onClick={() => onSelect(item.key)}
      aria-current={active ? 'page' : undefined}
      aria-label={item.label}
      className={cn(
        'flex min-h-[56px] flex-1 cursor-pointer flex-col items-center justify-center gap-1 px-0.5 pt-1.5 pb-1 transition-colors',
        active ? 'text-primary' : 'text-muted-foreground active:bg-muted/60'
      )}
    >
      <span
        className={cn(
          'grid h-7 w-12 place-items-center rounded-full transition-colors',
          active ? 'bg-primary/10' : 'bg-transparent'
        )}
      >
        <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
      </span>
      <span className={cn('max-w-full truncate text-[10px] leading-none', active && 'font-semibold')}>
        {item.shortLabel}
      </span>
    </button>
  )
}

/** Bottom navigation bar mobile (<lg) — pengganti menu hamburger, ala aplikasi Android. */
function BottomNav({
  items,
  current,
  onSelect,
}: {
  items: MenuItem[]
  current: SectionKey
  onSelect: (section: SectionKey) => void
}) {
  const [moreOpen, setMoreOpen] = useState(false)
  const showMore = items.length > MAX_BOTTOM_ITEMS + 1
  const primaryItems = showMore
    ? items.filter((m) => m.primary).slice(0, MAX_BOTTOM_ITEMS)
    : items
  const extraItems = showMore ? items.filter((m) => !primaryItems.includes(m)) : []

  return (
    <>
      <nav
        aria-label="Menu utama"
        className="fixed inset-x-0 bottom-0 z-40 flex h-[calc(3.5rem+env(safe-area-inset-bottom))] items-stretch border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:hidden print:hidden"
      >
        {primaryItems.map((item) => (
          <BottomNavItem
            key={item.key}
            item={item}
            active={current === item.key}
            onSelect={onSelect}
          />
        ))}
        {showMore ? (
          <button
            type="button"
            aria-label="Menu lainnya"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen(true)}
            className="flex min-h-[56px] flex-1 cursor-pointer flex-col items-center justify-center gap-1 px-0.5 pt-1.5 pb-1 text-muted-foreground transition-colors active:bg-muted/60"
          >
            <span className="grid h-7 w-12 place-items-center rounded-full">
              <MoreHorizontal className="h-5 w-5" />
            </span>
            <span className="text-[10px] leading-none">Lainnya</span>
          </button>
        ) : null}
      </nav>

      {/* Sheet "Lainnya" — menu yang tidak muat di bottom nav (gaya bottom sheet Android) */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="bottom"
          aria-describedby={undefined}
          className="rounded-t-2xl px-4 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))]"
        >
          <SheetTitle className="sr-only">Menu lainnya</SheetTitle>
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted-foreground/30" aria-hidden />
          <div className="grid gap-1">
            {extraItems.map((item) => {
              const Icon = item.icon
              const active = current === item.key
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    onSelect(item.key)
                    setMoreOpen(false)
                  }}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                    active
                      ? 'bg-primary/10 font-medium text-primary'
                      : 'text-foreground/80 hover:bg-muted'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              )
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

export default function Dashboard({
  user,
  onLogout,
}: {
  user: UserInfo
  onLogout: () => void
}) {
  const [section, setSection] = useState<SectionKey>('ringkasan')

  // ===== Realtime: subscribe perubahan tabel Setoran =====
  // Bagian yang menampilkan data setoran dimuat ulang otomatis (remount via key)
  // agar setoran yang dibuat musyrif lain langsung terlihat.
  const [dataTick, setDataTick] = useState(0)
  const pendingRef = useRef(false)
  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    const channel = supabase
      .channel('setoran-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'Setoran' },
        () => {
          if (pendingRef.current) return
          pendingRef.current = true
          setTimeout(() => {
            pendingRef.current = false
            setDataTick((t) => t + 1)
            toast('Data setoran diperbarui', {
              description: 'Perubahan terbaru dari pengguna lain telah dimuat.',
            })
          }, 700)
        }
      )
      .subscribe((status) => {
        console.log('[realtime] setoran-changes:', status)
      })
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // ===== Realtime: subscribe perubahan tabel AbsensiMusyrif =====
  // Section kelola/rekap absensi (admin) dimuat ulang otomatis saat musyrif absen.
  const [absensiTick, setAbsensiTick] = useState(0)
  const absensiPendingRef = useRef(false)
  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    const channel = supabase
      .channel('absensi-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'AbsensiMusyrif' },
        () => {
          if (absensiPendingRef.current) return
          absensiPendingRef.current = true
          setTimeout(() => {
            absensiPendingRef.current = false
            setAbsensiTick((t) => t + 1)
            toast('Data absensi diperbarui', {
              description: 'Absensi terbaru dari musyrif telah dimuat.',
            })
          }, 700)
        }
      )
      .subscribe((status) => {
        console.log('[realtime] absensi-changes:', status)
      })
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const items = MENU.filter(
    (m) =>
      (!m.adminOnly || user.role === 'admin') &&
      (!m.musyrifOnly || user.role === 'musyrif')
  )

  const handleSelect = (key: SectionKey) => {
    setSection(key)
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Sidebar desktop (lg+) */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex print:hidden">
        <SidebarContent user={user} current={section} onSelect={setSection} onLogout={onLogout} />
      </aside>

      {/* Topbar mobile (<lg): brand + tema + keluar (navigasi pindah ke bottom bar) */}
      <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur lg:hidden print:hidden">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 p-1.5">
          <BookOpenText className="h-5 w-5 text-primary" />
        </span>
        <h1 className="min-w-0 flex-1 truncate text-sm font-semibold">
          Program Qur&apos;an Mandiri
        </h1>
        <ThemeToggle />
        <Button variant="ghost" size="icon" aria-label="Keluar" onClick={onLogout}>
          <LogOut className="h-5 w-5" />
        </Button>
      </header>

      {/* Bottom nav mobile (<lg) */}
      <BottomNav items={items} current={section} onSelect={handleSelect} />

      {/* Konten */}
      <main className="lg:pl-64 print:!pl-0">
        <div className="mx-auto max-w-6xl p-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))] sm:p-6 sm:pb-24 lg:p-8 lg:pb-8">
          {section === 'ringkasan' && (
            <RingkasanSection key={`ringkasan-${dataTick}`} user={user} onNavigate={handleSelect} />
          )}
          {section === 'input-setoran' && <InputSetoranSection user={user} />}
          {section === 'absensi' && <AbsensiSection user={user} />}
          {section === 'rekapan' && <RekapanSection key={`rekapan-${dataTick}`} user={user} />}
          {section === 'program' && <ProgramSection />}
          {section === 'musyrif' && <MusyrifSection />}
          {section === 'halaqoh' && <HalaqohSection />}
          {section === 'siswa' && <SiswaSection />}
          {section === 'kelola-absensi' && (
            <KelolaAbsensiSection key={`kelola-absensi-${absensiTick}`} />
          )}
          {section === 'rekap-absensi' && (
            <RekapAbsensiSection key={`rekap-absensi-${absensiTick}`} />
          )}
          {section === 'pengaturan' && <SettingsSection user={user} />}
        </div>
      </main>

      {/* Popup pengingat absen saat musyrif baru login & belum absen hari ini */}
      {user.role === 'musyrif' && <AbsenAwalDialog user={user} />}
    </div>
  )
}

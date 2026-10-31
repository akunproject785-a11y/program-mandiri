import { type NextRequest } from 'next/server'
import { updateSupabaseSession } from '@/lib/supabase/middleware'

export async function proxy(request: NextRequest) {
  return await updateSupabaseSession(request)
}

export const config = {
  matcher: [
    /*
     * Semua kecuali aset statis & file gambar/icon.
     * Termasuk /api/* agar token ter-refresh saat SPA melakukan fetch tanpa page load.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}

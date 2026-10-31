import 'server-only'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

/**
 * Client Supabase terikat cookie untuk Route Handler / Server Component.
 * Dipakai untuk verifikasi sesi (getUser) dan signInWithPassword server-side.
 * setAll dibungkus try-catch: pada Server Component cookie tidak boleh ditulis,
 * refresh token tetap ditangani middleware.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Dipanggil dari Server Component — abaikan; middleware yang men-set.
          }
        },
      },
    }
  )
}

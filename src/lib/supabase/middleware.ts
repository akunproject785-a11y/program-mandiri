import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Refresh sesi Supabase di middleware — dipanggil untuk semua request non-statis.
 * Menjamin access token selalu segar (long-lived SPA tanpa full page load).
 */
export async function updateSupabaseSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getUser() memicu refresh token otomatis bila access token kedaluwarsa.
  try {
    await supabase.auth.getUser()
  } catch {
    // Jaringan/auth error → biarkan lewat tanpa sesi; guard API menolak bila perlu.
  }

  return response
}

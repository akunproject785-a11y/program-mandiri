import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Refresh sesi Supabase di middleware — dipanggil untuk semua request non-statis.
 * Menjamin access token selalu segar (long-lived SPA tanpa full page load).
 */
export async function updateSupabaseSession(request: NextRequest): Promise<NextResponse> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Bila env Supabase belum diatur (mis. deploy sebelum env Vercel diisi),
  // JANGAN crash — lewati refresh sesi agar halaman tetap dirender.
  // API guard akan menolak request dengan pesan yang jelas.
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
      '[middleware] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY belum diatur — refresh sesi dilewati'
    )
    return NextResponse.next()
  }

  let response = NextResponse.next({ request })

  // Pengunjung tanpa cookie auth Supabase tidak mungkin punya sesi —
  // lewati panggilan getUser() (round-trip jaringan ke server auth) agar cepat.
  const hasAuthCookies = request.cookies
    .getAll()
    .some((c) => c.name.startsWith('sb-'))
  if (!hasAuthCookies) return response

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
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
  })

  // getUser() memicu refresh token otomatis bila access token kedaluwarsa.
  try {
    await supabase.auth.getUser()
  } catch {
    // Jaringan/auth error → biarkan lewat tanpa sesi; guard API menolak bila perlu.
  }

  return response
}

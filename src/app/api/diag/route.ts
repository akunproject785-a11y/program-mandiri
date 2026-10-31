import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

/**
 * GET /api/diag — diagnosis env & koneksi database untuk deployment Vercel.
 * Hanya mengembalikan boolean dan kode error (TIDAK ada nilai rahasia).
 */
export async function GET() {
  const rawDb = process.env.DATABASE_URL ?? ''
  const rawDirect = process.env.DIRECT_URL ?? ''

  const result = {
    supabaseUrlSet: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    serviceKeySet: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    dbUrlSet: rawDb.length > 0,
    dbUrlIsPostgres: /^postgres(ql)?:\/\//.test(rawDb),
    dbUrlHasPgbouncer: rawDb.includes('pgbouncer=true'),
    directUrlSet: rawDirect.length > 0,
    prismaOk: false,
    prismaCode: null as string | null,
  }

  // Uji query nyata dengan client terpisah agar error tidak memengaruhi pool utama
  if (result.dbUrlIsPostgres) {
    let p: PrismaClient | null = null
    try {
      p = new PrismaClient({ datasourceUrl: rawDb })
      await p.$queryRaw`select 1`
      result.prismaOk = true
    } catch (e) {
      const code = (e as { code?: string })?.code
      result.prismaCode = typeof code === 'string' ? code : 'ERR'
    } finally {
      if (p) await p.$disconnect().catch(() => {})
    }
  } else {
    result.prismaCode = 'URL_FORMAT'
  }

  return NextResponse.json(result)
}

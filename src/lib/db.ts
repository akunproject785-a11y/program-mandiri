import fs from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'

/**
 * Fallback pembaca .env langsung:
 * Lingkungan hosting/sandbox bisa saja menyuntikkan DATABASE_URL lama (mis. file: SQLite)
 * yang meng-override .env. Prisma membutuhkan URL postgres://, jadi bila nilai env
 * bukan postgresql://, baca langsung dari file .env proyek.
 */
function readEnvValue(key: string): string | undefined {
  // .env.local diprioritaskan: file .env bisa di-rewrite oleh bootstrap sandbox
  for (const file of ['.env.local', '.env']) {
    try {
      const content = fs.readFileSync(path.join(process.cwd(), file), 'utf8')
      for (const line of content.split(/\r?\n/)) {
        const m = /^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
        if (m && m[1] === key) {
          const raw = m[2]
          const unquoted = raw.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1')
          if (unquoted.length > 0) return unquoted
        }
      }
    } catch {
      // file tidak ada — coba berikutnya
    }
  }
  return undefined
}

function resolveDatabaseUrl(): string {
  const fromEnv = process.env.DATABASE_URL
  if (fromEnv && /^postgres(ql)?:\/\//.test(fromEnv)) return fromEnv
  const fromFile = readEnvValue('DATABASE_URL')
  if (fromFile) {
    process.env.DATABASE_URL = fromFile // turunkan juga agar konsisten untuk library lain
    return fromFile
  }
  return fromEnv ?? ''
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: resolveDatabaseUrl() || undefined,
    // Logging query hanya di development — di produksi (serverless) hanya error
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['query'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

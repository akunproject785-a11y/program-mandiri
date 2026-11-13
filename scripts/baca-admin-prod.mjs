/** Baca baris Admin dari DB produksi (read-only) — cari email/username admin. */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL })
const admins = await db.admin.findMany({
  select: { email: true, username: true, name: true, createdAt: true },
})
console.log(JSON.stringify(admins, null, 1))
await db.$disconnect()

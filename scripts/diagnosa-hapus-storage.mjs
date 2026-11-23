/** Diagnosa penghapusan objek storage foto-absensi dengan SERVICE ROLE. */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  readFileSync('/home/z/my-project/.env.local', 'utf-8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim().replace(/^"|"$/g, '')])
)

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const path = 'absensi/cmvqs22ju0004om0aq00wehdv/2026-11-13-1794558428641.jpg'
const { data, error } = await supabase.storage.from('foto-absensi').remove([path])
console.log('remove → error:', error ? `${error.name}: ${error.message}` : 'null')
console.log('remove → data:', JSON.stringify(data))

// cek ulang keberadaan objek
const cek = await fetch(
  `${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/foto-absensi/${path}`
)
console.log('cek ulang HTTP:', cek.status)

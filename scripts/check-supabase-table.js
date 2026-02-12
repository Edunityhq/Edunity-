// Quick script to check a Supabase table connectivity
// Usage: node scripts/check-supabase-table.js [tableName]
// or set env CHECK_TABLE and run: node scripts/check-supabase-table.js

import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

// Load .env.local if env vars missing
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  const envPath = path.resolve(process.cwd(), '.env.local')
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8')
    content.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) return
      const eq = trimmed.indexOf('=')
      if (eq === -1) return
      const k = trimmed.slice(0, eq).trim()
      const v = trimmed.slice(eq + 1).trim().replace(/^"|"$/g, '')
      if (!process.env[k]) process.env[k] = v
    })
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in env')
  process.exit(1)
}

const table = process.argv[2] || process.env.CHECK_TABLE || 'teachers'
const supabase = createClient(url, key)

async function main() {
  console.log('Testing connection to Supabase project...')
  try {
    const { data, error } = await supabase.from(table).select('*').limit(1)
    if (error) {
      console.error('Query error (table may not exist or permission denied):', error.message || error)
      process.exitCode = 2
    } else {
      console.log(`Success: able to query \
- table: ${table}\n- rows returned: ${Array.isArray(data) ? data.length : 0}`)
      if (Array.isArray(data) && data.length > 0) console.log('Sample row:', data[0])
    }
  } catch (err) {
    console.error('Unexpected error:', err)
    process.exitCode = 3
  }
}

main()

import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

// If env vars aren't set, try loading .env.local (simple parser) so script can run without extra deps
const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!envUrl || !envKey) {
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
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in env; please set them in your environment or .env.local')
  process.exit(1)
}

const supabase = createClient(url, key)

async function main() {
  const sample = {
    full_name: 'Test User',
    phone_number: '+2348000000000',
    email: 'test.user@example.com',
    state: 'Lagos',
    lga: 'Ikeja',
    area: "Ajao Estate",
    subjects: ['Mathematics'],
    min_class: 'Primary (Years 1–6)',
    max_class: 'Senior Secondary (SSS 1–3)',
    exam_focus: ['WAEC'],
    availability: 'flexible',
    lesson_type: 'both',
    private_tutoring: 'yes',
    teaching_experience: 'Test entry - 5 years experience teaching.',
    consent: true,
  }

  try {
    console.log('Attempting insert into teachers...')
    const patterns = [ /Could not find the '(.+?)' column/, /column "([^"]+)" of relation "([^"]+)" does not exist/i, /unknown column '(.+?)'/i ]
    const maxAttempts = 6
    let attempt = 0
    let payload = { ...sample }
    let lastError = null

    while (attempt < maxAttempts) {
      attempt += 1
      const { data, error } = await supabase.from('teachers').insert([payload])
      if (!error) {
        console.log('Insert success, returned:', data)
        lastError = null
        break
      }
      console.error('Supabase error:', error)
      lastError = error
      const msg = String(error?.message ?? error ?? '')
      let removed = false
      for (const p of patterns) {
        const m = msg.match(p)
        if (m) {
          const col = m[1]
          if (col && Object.prototype.hasOwnProperty.call(payload, col)) {
            delete payload[col]
            removed = true
            console.warn(`Removed unknown column '${col}' and retrying`)
            break
          }
          if (col && Object.keys(payload).includes(col.toLowerCase())) {
            delete payload[col.toLowerCase()]
            removed = true
            console.warn(`Removed unknown column '${col.toLowerCase()}' and retrying`)
            break
          }
        }
      }
      if (!removed) break
    }

    if (lastError) {
      if (lastError.details) console.error('Details:', lastError.details)
      process.exitCode = 2
    }
  } catch (err) {
    console.error('Unexpected error:', err)
    process.exitCode = 3
  }
}

main()

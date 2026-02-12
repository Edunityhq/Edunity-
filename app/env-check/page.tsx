import Link from 'next/link'

export default function EnvCheck() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  return (
    <main style={{ padding: 24, fontFamily: 'Arial, sans-serif' }}>
      <h1>Environment Check</h1>
      <div style={{ marginTop: 16, marginBottom: 8 }}>
        <strong>SUPABASE URL:</strong> {url ? '✅ OK' : '❌ MISSING'}
      </div>
      <div style={{ marginBottom: 16 }}>
        <strong>SUPABASE ANON KEY:</strong> {key ? '✅ OK' : '❌ MISSING'}
      </div>
      <Link href="/" style={{ color: '#4A0000', textDecoration: 'underline', fontSize: 14 }}>
        ← Back to Form
      </Link>
    </main>
  )
}

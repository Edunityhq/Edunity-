'use client'

import { FormEvent, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import {
  findTeacherLeadByEdunityId,
  normalizeEdunityId,
} from '@/lib/teacher-follow-up-documents'
import {
  createTeacherPortalSession,
  extractFirstName,
  normalizeTeacherFirstName,
} from '@/lib/teacher-portal-session'

export default function TeacherDocumentLoginPage() {
  const router = useRouter()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [nextPath, setNextPath] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const edunityIdParam = normalizeEdunityId(params.get('edunityId') ?? '')
    const nextParam = params.get('next') ?? ''
    if (edunityIdParam) {
      setPassword((prev) => (prev ? prev : edunityIdParam))
    }
    if (nextParam) {
      setNextPath(nextParam)
    }
  }, [])

  const normalizedUsername = useMemo(
    () => normalizeTeacherFirstName(username),
    [username]
  )
  const normalizedPassword = useMemo(
    () => normalizeEdunityId(password),
    [password]
  )

  const targetPath = useMemo(() => {
    if (nextPath.startsWith('/follow-up/upload/')) return nextPath
    if (!normalizedPassword) return '/follow-up/upload'
    return `/follow-up/upload/${encodeURIComponent(normalizedPassword)}`
  }, [nextPath, normalizedPassword])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      if (!normalizedUsername) throw new Error('Enter your username (first name).')
      if (!normalizedPassword) throw new Error('Enter your password (Edunity ID).')

      const lead = await findTeacherLeadByEdunityId(normalizedPassword)
      if (!lead) {
        throw new Error('Edunity ID not found. Check the ID and try again.')
      }

      const expectedFirstName = normalizeTeacherFirstName(extractFirstName(lead.fullName))
      if (!expectedFirstName || expectedFirstName !== normalizedUsername) {
        throw new Error('Username does not match our records for this Edunity ID.')
      }

      createTeacherPortalSession({
        edunityId: normalizedPassword,
        firstName: normalizedUsername,
        teacherName: lead.fullName || normalizedUsername,
      })

      router.push(targetPath)
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : 'Login failed. Try again.'
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#F8F2F5]">
      <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[#4A0000]/10 blur-3xl" />
      <div className="absolute -right-28 top-28 h-80 w-80 rounded-full bg-[#C4C3D0]/45 blur-3xl" />
      <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-[#4A0000]/10 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen max-w-6xl items-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid w-full gap-8 lg:grid-cols-[1.15fr_1fr]">
          <section className="rounded-3xl border border-[#C4C3D0] bg-[#4A0000] p-8 text-white shadow-2xl sm:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#F1DDE4]">
              Edunity Follow-up Portal
            </p>
            <h1 className="mt-4 text-3xl font-semibold leading-tight sm:text-4xl">
              Upload Your Follow-up Documents
            </h1>
            <p className="mt-4 text-sm text-[#F3E8EC] sm:text-base">
              Login with your Edunity ID and first name to continue your documentation step.
            </p>

            <div className="mt-8 space-y-3 text-sm text-[#F3E8EC]">
              <p className="rounded-xl border border-[#8A5B64] bg-[#5C171E] px-4 py-3">
                Username: your first name
              </p>
              <p className="rounded-xl border border-[#8A5B64] bg-[#5C171E] px-4 py-3">
                Password: your Edunity ID
              </p>
            </div>
          </section>

          <section className="rounded-3xl border border-[#C4C3D0] bg-white p-7 shadow-xl sm:p-9">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-[#4A0000]">Teacher Login</h2>
              <p className="mt-1 text-sm text-[#4A0000]/70">
                Access your document upload page.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-[#4A0000]">
                  Username (First Name)
                </label>
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="Enter your first name"
                  className="h-11 w-full rounded-xl border border-[#C4C3D0] px-3 text-sm outline-none focus:ring-2 focus:ring-[#4A0000]/20"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-[#4A0000]">
                  Password (Edunity ID)
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="EDU-ON-T-00123"
                  className="h-11 w-full rounded-xl border border-[#C4C3D0] px-3 text-sm outline-none focus:ring-2 focus:ring-[#4A0000]/20"
                />
              </div>

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="h-11 w-full rounded-xl bg-[#4A0000] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#630000] disabled:opacity-60"
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <div className="mt-6">
              <p className="text-xs text-[#4A0000]/75">
                Need help signing in?{' '}
                <a
                  href="mailto:edunitytechnologies@gmail.com"
                  className="font-semibold text-[#4A0000] underline"
                >
                  Contact support
                </a>
                .
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

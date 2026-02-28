'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore'
import { getDb } from '@/lib/firebase'
import { parseTeacherLeadSerial, TEACHER_LEADS_COLLECTION } from '@/lib/teacher-leads'
import {
  getTeacherFollowUpDocumentProgress,
  TEACHER_FOLLOW_UP_DOCUMENTS_COLLECTION,
  TeacherFollowUpDocumentRecord,
} from '@/lib/teacher-follow-up-documents'
import { useProtectedRoute } from '@/lib/auth/use-protected-route'
import { useAuth } from '@/lib/auth/auth-context'
import { getUsers, MockUser } from '@/lib/auth/mock-users'
import {
  buildLeadAssignmentId,
  getLeadAssignments,
  LeadAssignment,
  removeLeadAssignment,
  saveLeadAssignment,
} from '@/lib/auth/lead-assignments'

type Lead = {
  id: string
  collectionName: string
  leadType: 'teacher' | 'parent'
  edunityId: string
  fullName: string
  email: string
  phone: string
  location: string
  state: string
  subjects: string[]
  examFocus: string[]
  availability: string
  lessonType: string
  status: string
  createdAt: Date | null
  raw: Record<string, unknown>
}

type TabKey = 'dashboard' | 'teachers' | 'requests' | 'matching'
type TeacherSortKey = 'createdAtDesc' | 'edunityIdAsc'

function toDate(value: unknown): Date | null {
  if (!value) return null
  if (typeof (value as { toDate?: () => Date }).toDate === 'function') return (value as { toDate: () => Date }).toDate()
  if (value instanceof Date) return value
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }
  return null
}

function toArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((x): x is string => typeof x === 'string')
  if (typeof value === 'string' && value.trim()) return [value]
  return []
}

function getFirstString(obj: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = obj[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function formatValue(value: unknown): string {
  if (value == null) return '-'
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.map((v) => formatValue(v)).join(', ')
  if (typeof value === 'object' && value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toLocaleString()
  }
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

async function readCollection(name: string): Promise<Lead[]> {
  const col = collection(getDb(), name)
  let snap

  try {
    snap = await getDocs(query(col, orderBy('createdAt', 'desc'), limit(300)))
  } catch {
    snap = await getDocs(query(col, limit(300)))
  }

  return snap.docs.map((doc) => {
    const d = doc.data() as Record<string, unknown>
    const state = getFirstString(d, ['state'])
    const lga = getFirstString(d, ['lga'])
    const area = getFirstString(d, ['area'])
    const leadType: Lead['leadType'] = name === 'parent_requests' ? 'parent' : 'teacher'

    return {
      id: doc.id,
      collectionName: name,
      leadType,
      edunityId: getFirstString(d, ['edunityId', 'edunity_id']) || '-',
      fullName: getFirstString(d, ['fullName', 'parentFullName', 'learnerName', 'name']) || 'Unknown',
      email: getFirstString(d, ['email', 'parentEmail', 'emailAddress']) || '-',
      phone: getFirstString(d, ['phone', 'parentPhone', 'phoneNumber']) || '-',
      location: [area, lga, state].filter(Boolean).join(', ') || '-',
      state,
      subjects: toArray(d.subjects ?? d.requestedSubjects ?? d.subject),
      examFocus: toArray(d.examFocus ?? d.focus ?? d.exam_focus),
      availability: getFirstString(d, ['availability', 'preferredSchedule', 'schedule']) || '-',
      lessonType: getFirstString(d, ['lessonType', 'lesson_type']) || '-',
      status: getFirstString(d, ['status']) || 'new',
      createdAt: toDate(d.createdAt) ?? toDate(d.created_at) ?? toDate(d.submittedAt) ?? toDate(d.timestamp),
      raw: d,
    }
  })
}

function compareByEdunityIdAsc(a: Lead, b: Lead): number {
  const aSerial = parseTeacherLeadSerial(a.edunityId)
  const bSerial = parseTeacherLeadSerial(b.edunityId)
  if (aSerial != null && bSerial != null) return aSerial - bSerial
  if (aSerial != null) return -1
  if (bSerial != null) return 1
  return a.edunityId.localeCompare(b.edunityId)
}

function getLeadDedupeKey(lead: Lead): string {
  const source = `${lead.collectionName}|`
  const eid = lead.edunityId.trim().toLowerCase()
  if (eid && eid !== '-') return `${source}eid:${eid}`
  const email = lead.email.trim().toLowerCase()
  const phone = lead.phone.trim()
  if (email && email !== '-' && phone && phone !== '-') return `${source}contact:${email}|${phone}`
  if (email && email !== '-') return `${source}email:${email}`
  if (phone && phone !== '-') return `${source}phone:${phone}`
  return `${source}doc:${lead.id}`
}

function documentStatusLabel(
  status: ReturnType<typeof getTeacherFollowUpDocumentProgress>['status']
): string {
  if (status === 'pushed_to_sales') return 'Pushed to Sales'
  if (status === 'complete') return 'Complete'
  if (status === 'partial') return 'Partial'
  return 'Pending'
}

function documentStatusClasses(
  status: ReturnType<typeof getTeacherFollowUpDocumentProgress>['status']
): string {
  if (status === 'pushed_to_sales') return 'bg-green-100 text-green-800 border-green-200'
  if (status === 'complete') return 'bg-emerald-100 text-emerald-800 border-emerald-200'
  if (status === 'partial') return 'bg-amber-100 text-amber-800 border-amber-200'
  return 'bg-slate-100 text-slate-700 border-slate-200'
}

export default function DashboardPage() {
  const router = useRouter()
  const { user, logout, changePassword } = useAuth()
  const { isLoading: authLoading, hasAccess } = useProtectedRoute()

  const [tab, setTab] = useState<TabKey>('teachers')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [leads, setLeads] = useState<Lead[]>([])
  const [duplicateEdunityIds, setDuplicateEdunityIds] = useState<string[]>([])
  const [teacherSort, setTeacherSort] = useState<TeacherSortKey>('createdAtDesc')

  const [teacherSearch, setTeacherSearch] = useState('')
  const [teacherStateFilter, setTeacherStateFilter] = useState('')
  const [teacherSubjectFilter, setTeacherSubjectFilter] = useState('')
  const [requestSearch, setRequestSearch] = useState('')

  const [staffUsers, setStaffUsers] = useState<MockUser[]>([])
  const [assignments, setAssignments] = useState<Record<string, LeadAssignment>>({})
  const [documentsByEdunityId, setDocumentsByEdunityId] = useState<
    Record<string, TeacherFollowUpDocumentRecord>
  >({})
  const [assignMessage, setAssignMessage] = useState('')
  const [assignBusyKey, setAssignBusyKey] = useState('')

  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)

  useEffect(() => {
    if (!hasAccess) return
    let mounted = true

    async function loadStaffUsers() {
      const loadedUsers = (await getUsers()).filter(
        (entry) => entry.role !== 'admin' && entry.status === 'active'
      )
      if (!mounted) return
      setStaffUsers(loadedUsers)
    }

    void loadStaffUsers()
    return () => {
      mounted = false
    }
  }, [hasAccess])

  useEffect(() => {
    if (!hasAccess) return
    let mounted = true

    async function load() {
      setLoading(true)
      setError('')

      const collections = [TEACHER_LEADS_COLLECTION, 'parent_requests']
      const deduped = new Map<string, Lead>()
      const edunityIdCounts = new Map<string, number>()
      let anyLoaded = false
      let lastError = ''

      for (const name of collections) {
        try {
          const rows = await readCollection(name)
          anyLoaded = true
          for (const row of rows) {
            if (row.leadType === 'teacher') {
              const eid = row.edunityId.trim()
              if (eid && eid !== '-') {
                edunityIdCounts.set(eid, (edunityIdCounts.get(eid) ?? 0) + 1)
              }
            }

            const key = getLeadDedupeKey(row)
            const existing = deduped.get(key)
            if (!existing) {
              deduped.set(key, row)
              continue
            }
            const existingTime = existing.createdAt?.getTime() ?? 0
            const nextTime = row.createdAt?.getTime() ?? 0
            if (nextTime > existingTime) deduped.set(key, row)
          }
        } catch (e) {
          lastError = e instanceof Error ? e.message : 'Failed reading Firestore collection.'
        }
      }

      const assignmentRows = await getLeadAssignments()
      let documentRows: Record<string, TeacherFollowUpDocumentRecord> = {}
      try {
        const snap = await getDocs(
          query(collection(getDb(), TEACHER_FOLLOW_UP_DOCUMENTS_COLLECTION), limit(2000))
        )
        documentRows = {}
        for (const row of snap.docs) {
          const data = row.data() as Partial<TeacherFollowUpDocumentRecord>
          const key =
            typeof data.edunityId === 'string' && data.edunityId.trim()
              ? data.edunityId.trim().toUpperCase()
              : row.id.trim().toUpperCase()
          if (!key) continue
          documentRows[key] = data as TeacherFollowUpDocumentRecord
        }
      } catch {
        documentRows = {}
      }

      const finalRows = Array.from(deduped.values())
      finalRows.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
      const duplicateIds = Array.from(edunityIdCounts.entries())
        .filter(([, count]) => count > 1)
        .map(([id]) => id)

      if (!mounted) return
      setLeads(finalRows)
      setAssignments(assignmentRows)
      setDocumentsByEdunityId(documentRows)
      setDuplicateEdunityIds(duplicateIds)
      if (!anyLoaded) setError(lastError || 'Could not read Firestore data.')
      setLoading(false)
    }

    load()
    return () => {
      mounted = false
    }
  }, [hasAccess])

  const visibleLeads = useMemo(() => {
    if (!user) return []
    if (user.role === 'admin') return leads
    return leads.filter((lead) => {
      const key = buildLeadAssignmentId(lead.collectionName, lead.id)
      return assignments[key]?.assignedUserId === user.id
    })
  }, [assignments, leads, user])

  const teacherLeads = useMemo(() => visibleLeads.filter((lead) => lead.leadType === 'teacher'), [visibleLeads])
  const parentRequests = useMemo(() => visibleLeads.filter((lead) => lead.leadType === 'parent'), [visibleLeads])
  const combinedLatest = useMemo(
    () => [...visibleLeads].sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)),
    [visibleLeads]
  )

  const teacherStates = useMemo(() => Array.from(new Set(teacherLeads.map((l) => l.state).filter(Boolean))).sort(), [teacherLeads])
  const teacherSubjects = useMemo(() => Array.from(new Set(teacherLeads.flatMap((l) => l.subjects))).sort(), [teacherLeads])
  const allStates = useMemo(() => Array.from(new Set(visibleLeads.map((l) => l.state).filter(Boolean))).sort(), [visibleLeads])

  const filteredTeachers = useMemo(() => {
    const q = teacherSearch.trim().toLowerCase()
    return teacherLeads.filter((lead) => {
      const searchMatch = !q || [lead.fullName, lead.email, lead.phone, lead.location].join(' ').toLowerCase().includes(q)
      const stateMatch = !teacherStateFilter || lead.state === teacherStateFilter
      const subjectMatch = !teacherSubjectFilter || lead.subjects.includes(teacherSubjectFilter)
      return searchMatch && stateMatch && subjectMatch
    })
  }, [teacherLeads, teacherSearch, teacherStateFilter, teacherSubjectFilter])

  const sortedTeachers = useMemo(() => {
    const rows = [...filteredTeachers]
    if (teacherSort === 'edunityIdAsc') {
      rows.sort(compareByEdunityIdAsc)
      return rows
    }
    rows.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
    return rows
  }, [filteredTeachers, teacherSort])

  const filteredRequests = useMemo(() => {
    const q = requestSearch.trim().toLowerCase()
    return parentRequests
      .filter((lead) => !q || [lead.fullName, lead.email, lead.phone, lead.location].join(' ').toLowerCase().includes(q))
      .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
  }, [parentRequests, requestSearch])

  const metrics = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    let recentCombined = 0
    let recentTeachers = 0
    let recentRequests = 0
    let onlineTeacherPrefs = 0
    let inPersonTeacherPrefs = 0

    for (const lead of visibleLeads) {
      const created = lead.createdAt?.getTime() ?? 0
      if (created >= weekAgo) recentCombined += 1

      if (lead.leadType === 'teacher') {
        if (created >= weekAgo) recentTeachers += 1
        const lesson = lead.lessonType.toLowerCase()
        if (lesson.includes('online')) onlineTeacherPrefs += 1
        if (lesson.includes('in-person') || lesson.includes('in person')) inPersonTeacherPrefs += 1
        if (lesson === 'both') {
          onlineTeacherPrefs += 1
          inPersonTeacherPrefs += 1
        }
      } else if (created >= weekAgo) {
        recentRequests += 1
      }
    }

    return {
      totalTeachers: teacherLeads.length,
      totalRequests: parentRequests.length,
      totalCombined: visibleLeads.length,
      recentCombined,
      recentTeachers,
      recentRequests,
      onlineTeacherPrefs,
      inPersonTeacherPrefs,
      states: allStates.length,
    }
  }, [visibleLeads, teacherLeads.length, parentRequests.length, allStates.length])

  const topSubjects = useMemo(() => {
    const count = new Map<string, number>()
    for (const lead of visibleLeads) {
      for (const s of lead.subjects) count.set(s, (count.get(s) ?? 0) + 1)
    }
    return Array.from(count.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6)
  }, [visibleLeads])

  const navItems: { key: TabKey; label: string }[] = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'teachers', label: 'Teachers' },
    { key: 'requests', label: 'Requests' },
    { key: 'matching', label: 'Matching' },
  ]

  const getAssignment = (lead: Lead) => {
    const key = buildLeadAssignmentId(lead.collectionName, lead.id)
    return assignments[key]
  }

  const handleAssignmentChange = async (lead: Lead, assignedUserId: string) => {
    if (!user || user.role !== 'admin') return

    const key = buildLeadAssignmentId(lead.collectionName, lead.id)
    setAssignMessage('')
    setAssignBusyKey(key)

    try {
      if (!assignedUserId) {
        await removeLeadAssignment(lead.collectionName, lead.id)
        setAssignments((prev) => {
          const next = { ...prev }
          delete next[key]
          return next
        })
        setAssignMessage('Lead unassigned.')
        return
      }

      const assignee = staffUsers.find((entry) => entry.id === assignedUserId)
      if (!assignee) throw new Error('Selected user no longer exists.')

      const saved = await saveLeadAssignment({
        leadId: lead.id,
        collectionName: lead.collectionName,
        assignedUserId: assignee.id,
        assignedUserName: assignee.name,
        assignedByUserId: user.id,
        assignedByName: user.name,
      })

      setAssignments((prev) => ({
        ...prev,
        [saved.id]: saved,
      }))
      setAssignMessage(`Assigned to ${assignee.name}.`)
    } catch (err) {
      setAssignMessage(err instanceof Error ? err.message : 'Failed to update assignment.')
    } finally {
      setAssignBusyKey('')
    }
  }

  const handlePasswordSubmit = async (event: { preventDefault: () => void }) => {
    event.preventDefault()
    setPasswordMessage('')

    if (!currentPassword.trim() || !newPassword.trim()) {
      setPasswordMessage('Current password and new password are required.')
      return
    }

    setPasswordSaving(true)
    try {
      await changePassword(currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setShowPasswordForm(false)
      setPasswordMessage('Password changed successfully.')
    } catch (err) {
      setPasswordMessage(err instanceof Error ? err.message : 'Failed to change password.')
    } finally {
      setPasswordSaving(false)
    }
  }

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F2EFF5]">
        <div className="rounded-xl border border-[#C4C3D0] bg-white px-4 py-3 text-sm text-[#4A0000]/70">
          Checking authentication...
        </div>
      </div>
    )
  }

  if (!hasAccess || !user) return null

  return (
    <div className="min-h-screen bg-[#F2EFF5] text-slate-900">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[280px_1fr]">
        <aside className="border-b border-[#C4C3D0] bg-[#ECE7F2] p-4 lg:border-b-0 lg:border-r lg:p-7">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#4A0000]/70">Edunity Technologies</p>
            <h1 className="mt-1 text-xl font-semibold text-[#4A0000]">Operations Dashboard</h1>
            <p className="mt-1 text-xs text-[#4A0000]/70">
              {user.role === 'admin' ? 'Admin view: all teacher + parent leads' : 'User view: only leads assigned to you'}
            </p>
          </div>

          <div className="mt-4 rounded-xl border border-[#D8D6E0] bg-white p-3">
            <p className="text-sm font-semibold text-[#4A0000]">{user.name}</p>
            <p className="text-xs text-[#4A0000]/70">@{user.email}</p>
            <p className="text-[11px] text-[#4A0000]/70">{user.role === 'admin' ? 'Admin' : 'User'}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {user.role === 'admin' && (
                <Link
                  href="/admin/staff"
                  className="rounded-md border border-[#C4C3D0] px-3 py-1.5 text-xs font-semibold text-[#4A0000]"
                >
                  Manage Users
                </Link>
              )}
              <button
                onClick={() => setShowPasswordForm((prev) => !prev)}
                className="rounded-md border border-[#C4C3D0] px-3 py-1.5 text-xs font-semibold text-[#4A0000]"
              >
                Change Password
              </button>
              <button
                onClick={handleLogout}
                className="rounded-md bg-[#4A0000] px-3 py-1.5 text-xs font-semibold text-white"
              >
                Logout
              </button>
            </div>

            {showPasswordForm && (
              <form onSubmit={handlePasswordSubmit} className="mt-3 space-y-2">
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Current password"
                  className="h-9 w-full rounded-md border border-[#C4C3D0] px-3 text-xs outline-none"
                />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password"
                  className="h-9 w-full rounded-md border border-[#C4C3D0] px-3 text-xs outline-none"
                />
                <button
                  type="submit"
                  disabled={passwordSaving}
                  className="h-9 w-full rounded-md bg-[#4A0000] px-3 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {passwordSaving ? 'Saving...' : 'Update Password'}
                </button>
              </form>
            )}
            {passwordMessage && <p className="mt-2 text-[11px] text-[#4A0000]/80">{passwordMessage}</p>}
          </div>

          <nav className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:mt-6 lg:grid lg:gap-2 lg:overflow-visible">
            {navItems.map((item) => (
              <button
                key={item.key}
                onClick={() => setTab(item.key)}
                className={`whitespace-nowrap rounded-xl px-3 py-2 text-left text-sm font-semibold transition-colors ${
                  tab === item.key ? 'bg-[#4A0000] text-white' : 'bg-white text-[#4A0000] hover:bg-[#F5EAF0]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </aside>

        <main className="p-4 sm:p-6 lg:p-10">
          {loading && <div className="rounded-xl border border-[#C4C3D0] bg-white p-4 text-sm text-[#4A0000]/70">Loading Firestore data...</div>}
          {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
          {!loading && user.role === 'admin' && duplicateEdunityIds.length > 0 && (
            <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
              Duplicate teacher Edunity IDs detected and deduped in view: {duplicateEdunityIds.slice(0, 5).join(', ')}
              {duplicateEdunityIds.length > 5 ? ` (+${duplicateEdunityIds.length - 5} more)` : ''}
            </div>
          )}
          {!loading && assignMessage && (
            <div className="mb-4 rounded-xl border border-[#C4C3D0] bg-white p-3 text-xs text-[#4A0000]/80">
              {assignMessage}
            </div>
          )}
          {!loading && user.role !== 'admin' && visibleLeads.length === 0 && (
            <div className="mb-4 rounded-xl border border-[#C4C3D0] bg-white p-4 text-sm text-[#4A0000]/70">
              No teacher or parent records have been assigned to you yet.
            </div>
          )}

          {!loading && (
            <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
              {[
                ['Teachers', metrics.totalTeachers],
                ['Parent Requests', metrics.totalRequests],
                ['Combined Total', metrics.totalCombined],
                ['New (7 days)', metrics.recentCombined],
                ['States Covered', metrics.states],
                ['Teacher Online Pref.', metrics.onlineTeacherPrefs],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-2xl border border-[#C4C3D0] bg-white p-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#4A0000]/70">{label}</p>
                  <p className="mt-2 text-2xl font-semibold text-[#4A0000]">{value}</p>
                </div>
              ))}
            </div>
          )}

          {!loading && tab === 'dashboard' && (
            <section className="space-y-5">
              <div>
                <h2 className="text-xl font-semibold text-[#4A0000] sm:text-2xl">Combined Analytics</h2>
                <p className="mt-1 text-sm text-[#4A0000]/70">Analytics across teacher interests and parent requests.</p>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <div className="rounded-2xl border border-[#C4C3D0] bg-white p-5 shadow-sm">
                  <h3 className="text-lg font-semibold text-[#4A0000]">Top Subjects (Both Collections)</h3>
                  <div className="mt-4 space-y-2">
                    {topSubjects.map(([name, count]) => (
                      <div key={name} className="flex items-center justify-between rounded-xl border border-[#D8D6E0] px-3 py-2">
                        <span className="font-medium text-[#4A0000]">{name}</span>
                        <span className="text-sm text-[#4A0000]/70">{count}</span>
                      </div>
                    ))}
                    {topSubjects.length === 0 && <p className="text-sm text-[#4A0000]/70">No subject data yet.</p>}
                  </div>
                </div>

                <div className="rounded-2xl border border-[#C4C3D0] bg-white p-5 shadow-sm">
                  <h3 className="text-lg font-semibold text-[#4A0000]">Latest Activity</h3>
                  <div className="mt-4 space-y-3">
                    {combinedLatest.slice(0, 6).map((lead) => (
                      <div key={`${lead.collectionName}-${lead.id}`} className="rounded-xl border border-[#D8D6E0] p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold text-[#4A0000]">{lead.fullName}</p>
                          <p className="text-xs uppercase tracking-wide text-[#4A0000]/60">{lead.leadType}</p>
                        </div>
                        <p className="text-sm text-[#4A0000]/70">{lead.location}</p>
                        <p className="text-xs text-[#4A0000]/70">{lead.subjects.join(', ') || 'No subjects'}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}

          {!loading && tab === 'teachers' && (
            <section className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold text-[#4A0000] sm:text-2xl">Teachers</h2>
                <p className="mt-1 text-sm text-[#4A0000]/70">{`Teacher-interest records from ${TEACHER_LEADS_COLLECTION} only.`}</p>
              </div>

              <div className="grid gap-3 rounded-2xl border border-[#C4C3D0] bg-white p-3 sm:grid-cols-2 lg:grid-cols-4">
                <input
                  value={teacherSearch}
                  onChange={(e) => setTeacherSearch(e.target.value)}
                  placeholder="Search name, email, phone, location"
                  className="h-10 rounded-lg border border-[#C4C3D0] px-3 text-sm outline-none focus:ring-2 focus:ring-[#4A0000]/30"
                />
                <select value={teacherStateFilter} onChange={(e) => setTeacherStateFilter(e.target.value)} className="h-10 rounded-lg border border-[#C4C3D0] px-3 text-sm outline-none focus:ring-2 focus:ring-[#4A0000]/30">
                  <option value="">All states</option>
                  {teacherStates.map((s) => (<option key={s} value={s}>{s}</option>))}
                </select>
                <select value={teacherSubjectFilter} onChange={(e) => setTeacherSubjectFilter(e.target.value)} className="h-10 rounded-lg border border-[#C4C3D0] px-3 text-sm outline-none focus:ring-2 focus:ring-[#4A0000]/30">
                  <option value="">All subjects</option>
                  {teacherSubjects.map((s) => (<option key={s} value={s}>{s}</option>))}
                </select>
                <button
                  onClick={() => {
                    setTeacherSearch('')
                    setTeacherStateFilter('')
                    setTeacherSubjectFilter('')
                  }}
                  className="h-10 rounded-lg bg-[#4A0000] px-4 text-sm font-semibold text-white"
                >
                  Reset Filters
                </button>
                <select value={teacherSort} onChange={(e) => setTeacherSort(e.target.value as TeacherSortKey)} className="h-10 rounded-lg border border-[#C4C3D0] px-3 text-sm outline-none focus:ring-2 focus:ring-[#4A0000]/30">
                  <option value="createdAtDesc">Sort: newest first</option>
                  <option value="edunityIdAsc">Sort: Edunity ID asc</option>
                </select>
              </div>

              <div className="space-y-3">
                {sortedTeachers.map((lead) => {
                  const assignment = getAssignment(lead)
                  const assignmentKey = buildLeadAssignmentId(lead.collectionName, lead.id)
                  const normalizedEdunityId = lead.edunityId.trim().toUpperCase()
                  const documentRecord =
                    normalizedEdunityId && normalizedEdunityId !== '-'
                      ? documentsByEdunityId[normalizedEdunityId]
                      : undefined
                  const documentProgress = getTeacherFollowUpDocumentProgress(documentRecord)
                  const linkEdunityId =
                    lead.edunityId && lead.edunityId !== '-' ? lead.edunityId : lead.id

                  return (
                  <div key={`${lead.collectionName}-${lead.id}`} className="rounded-2xl border border-[#C4C3D0] bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[#4A0000]">{lead.fullName}</p>
                        <p className="text-xs text-[#4A0000]/70">Edunity ID: {lead.edunityId}</p>
                        <p className="text-xs text-[#4A0000]/70">{lead.email} | {lead.phone}</p>
                        <p className="text-sm text-[#4A0000]/80">{lead.location}</p>
                        <p className="text-xs text-[#4A0000]/70 mt-1">Assigned to: {assignment?.assignedUserName || 'Unassigned'}</p>
                        <div className="mt-2 flex items-center gap-2">
                          <span
                            className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${documentStatusClasses(
                              documentProgress.status
                            )}`}
                          >
                            Docs: {documentStatusLabel(documentProgress.status)}
                          </span>
                          <span className="text-xs text-[#4A0000]/70">
                            {documentProgress.requiredUploaded}/{documentProgress.requiredTotal}{' '}
                            required
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 w-full sm:w-auto sm:items-end">
                        {user.role === 'admin' && (
                          <select
                            value={assignment?.assignedUserId || ''}
                            onChange={(e) => handleAssignmentChange(lead, e.target.value)}
                            disabled={assignBusyKey === assignmentKey}
                            className="h-9 rounded-lg border border-[#C4C3D0] px-3 text-xs outline-none focus:ring-2 focus:ring-[#4A0000]/30"
                          >
                            <option value="">Unassigned</option>
                            {staffUsers.map((entry) => (
                              <option key={entry.id} value={entry.id}>
                                {entry.name}
                              </option>
                            ))}
                          </select>
                        )}
                        <Link
                          href={`/dashboard/follow-up/${encodeURIComponent(lead.id)}?collection=${encodeURIComponent(lead.collectionName)}`}
                          className="rounded-lg bg-[#4A0000] px-4 py-2 text-sm font-semibold text-white hover:bg-[#630000]"
                        >
                          Teacher Follow Up
                        </Link>
                        <Link
                          href={`/dashboard/documents/${encodeURIComponent(linkEdunityId)}`}
                          className="rounded-lg border border-[#4A0000] bg-white px-4 py-2 text-sm font-semibold text-[#4A0000]"
                        >
                          Review Documents
                        </Link>
                        <Link
                          href={`/follow-up/upload?edunityId=${encodeURIComponent(linkEdunityId)}`}
                          className="rounded-lg border border-[#C4C3D0] bg-white px-4 py-2 text-xs font-semibold text-[#4A0000]"
                        >
                          Teacher Upload Link
                        </Link>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2 text-sm text-[#4A0000]/80 sm:grid-cols-2">
                      <p><span className="font-semibold">Subjects:</span> {lead.subjects.join(', ') || '-'}</p>
                      <p><span className="font-semibold">Exam Focus:</span> {lead.examFocus.join(', ') || '-'}</p>
                      <p><span className="font-semibold">Availability:</span> {lead.availability || '-'}</p>
                      <p><span className="font-semibold">Lesson Type:</span> {lead.lessonType || '-'}</p>
                      <p><span className="font-semibold">Submitted:</span> {lead.createdAt ? lead.createdAt.toLocaleString() : '-'}</p>
                      <p><span className="font-semibold">Collection:</span> {lead.collectionName}</p>
                    </div>

                    <details className="mt-3 rounded-lg border border-[#DEDCE7] bg-[#F7F4FA] p-3">
                      <summary className="cursor-pointer text-sm font-semibold text-[#4A0000]">View All Database Fields</summary>
                      <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
                        {Object.entries(lead.raw).map(([key, value]) => (
                          <div key={key} className="rounded border border-[#E4E1EC] bg-white p-2">
                            <p className="font-semibold text-[#4A0000]">{key}</p>
                            <p className="mt-1 break-words text-[#4A0000]/80">{formatValue(value)}</p>
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>
                  )
                })}
                {sortedTeachers.length === 0 && <div className="rounded-2xl border border-[#C4C3D0] bg-white p-8 text-center text-sm text-[#4A0000]/70">No teacher records match these filters.</div>}
              </div>
            </section>
          )}

          {!loading && tab === 'requests' && (
            <section className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold text-[#4A0000] sm:text-2xl">Requests</h2>
                <p className="mt-1 text-sm text-[#4A0000]/70">Parent requests from `parent_requests` only.</p>
              </div>

              <div className="grid gap-3 rounded-2xl border border-[#C4C3D0] bg-white p-3 sm:grid-cols-[1fr_auto]">
                <input
                  value={requestSearch}
                  onChange={(e) => setRequestSearch(e.target.value)}
                  placeholder="Search parent name, email, phone, location"
                  className="h-10 rounded-lg border border-[#C4C3D0] px-3 text-sm outline-none focus:ring-2 focus:ring-[#4A0000]/30"
                />
                <button onClick={() => setRequestSearch('')} className="h-10 rounded-lg bg-[#4A0000] px-4 text-sm font-semibold text-white">
                  Reset Search
                </button>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-[#C4C3D0] bg-white shadow-sm">
                <table className="w-full min-w-[1080px] border-collapse text-sm">
                  <thead className="bg-[#F4F0F7]">
                    <tr>
                      {['Edunity ID', 'Parent', 'Contact', 'Location', 'Subjects', 'Assigned To', 'Status', 'Received', 'Action'].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#4A0000]/70">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRequests.map((row, idx) => {
                      const assignment = getAssignment(row)
                      const assignmentKey = buildLeadAssignmentId(row.collectionName, row.id)

                      return (
                      <tr key={`${row.id}-${idx}`} className="border-t border-[#E4E1EC]">
                        <td className="px-4 py-3 font-semibold text-[#4A0000]">{row.edunityId}</td>
                        <td className="px-4 py-3 font-semibold text-[#4A0000]">{row.fullName}</td>
                        <td className="px-4 py-3">{row.email} | {row.phone}</td>
                        <td className="px-4 py-3">{row.location}</td>
                        <td className="px-4 py-3">{row.subjects.join(', ') || '-'}</td>
                        <td className="px-4 py-3">
                          {user.role === 'admin' ? (
                            <select
                              value={assignment?.assignedUserId || ''}
                              onChange={(e) => handleAssignmentChange(row, e.target.value)}
                              disabled={assignBusyKey === assignmentKey}
                              className="h-9 rounded-lg border border-[#C4C3D0] px-2 text-xs outline-none focus:ring-2 focus:ring-[#4A0000]/30"
                            >
                              <option value="">Unassigned</option>
                              {staffUsers.map((entry) => (
                                <option key={entry.id} value={entry.id}>
                                  {entry.name}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span>{assignment?.assignedUserName || 'Unassigned'}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">{row.status}</td>
                        <td className="px-4 py-3">{row.createdAt ? row.createdAt.toLocaleDateString() : '-'}</td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/dashboard/request-follow-up/${encodeURIComponent(row.id)}?collection=${encodeURIComponent(row.collectionName)}`}
                            className="rounded-lg bg-[#4A0000] px-3 py-2 text-xs font-semibold text-white hover:bg-[#630000]"
                          >
                            Request Follow Up
                          </Link>
                        </td>
                      </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {!loading && tab === 'matching' && (
            <section className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold text-[#4A0000] sm:text-2xl">Matching Preview</h2>
                <p className="mt-1 text-sm text-[#4A0000]/70">Quick shortlist from teacher collection only.</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {sortedTeachers.slice(0, 8).map((lead) => (
                  <div key={`${lead.collectionName}-${lead.id}`} className="rounded-2xl border border-[#C4C3D0] bg-white p-4 shadow-sm">
                    <p className="font-semibold text-[#4A0000]">{lead.fullName}</p>
                    <p className="text-sm text-[#4A0000]/70">{lead.location}</p>
                    <p className="mt-2 text-sm text-[#4A0000]/80">Subjects: {lead.subjects.join(', ') || '-'}</p>
                    <p className="text-sm text-[#4A0000]/80">Exam focus: {lead.examFocus.join(', ') || '-'}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  )
}

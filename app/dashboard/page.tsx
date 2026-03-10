'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { collection, doc, getDocs, limit, orderBy, query, serverTimestamp, setDoc } from 'firebase/firestore'
import { getDb } from '@/lib/firebase'
import { useProtectedRoute } from '@/lib/auth/use-protected-route'
import { useAuth } from '@/lib/auth/auth-context'
import { getUsers, type MockUser } from '@/lib/auth/mock-users'
import { rolePermissions } from '@/lib/config/roles'
import { buildLeadAssignmentId, getLeadAssignments, removeLeadAssignment, saveLeadAssignment } from '@/lib/auth/lead-assignments'
import {
  COMPANY_LEAD_COLLECTIONS,
  LEAD_STATUS_OPTIONS,
  LEAD_TYPE_LABELS,
  buildCompanyLead,
  buildContributionRows,
  buildWeeklyTrend,
  calculateLeadSummary,
  chooseCanonicalLead,
  filterCompanyLeads,
  findExactDuplicateGroups,
  formatLeadStatus,
  markProbableDuplicates,
  roleCanViewAllLeads,
  sortCompanyLeadsByCreatedAt,
  type CompanyLead,
  type LeadFilters,
} from '@/lib/company-leads'
import { logLeadActivity } from '@/lib/lead-audit'
import { deleteLeadRecord } from '@/lib/lead-deletion'
import { TEAM_LABELS, isConvertedStatus } from '@/lib/lead-workflows'
import type { LeadStatus, LeadType } from '@/lib/types'
import { TrendChart } from '@/components/shared/TrendChart'

type ActivityRow = {
  id: string
  activityType: string
  message: string
  userName: string
  createdAt: Date | null
  leadId: string
  collectionName: string
}

type TabKey = 'overview' | 'schools' | 'parents' | 'teachers' | 'contributions'

const TABS: { key: TabKey; label: string; leadType?: LeadType }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'schools', label: 'Schools', leadType: 'SCHOOL' },
  { key: 'parents', label: 'Parents', leadType: 'PARENT' },
  { key: 'teachers', label: 'Teachers', leadType: 'TEACHER' },
  { key: 'contributions', label: 'Contributions' },
]

function statusChip(status: LeadStatus) {
  const tone =
    status === 'CONVERTED' || status === 'CLOSED_WON' || status === 'APPROVED'
      ? 'bg-green-100 text-green-800 border-green-200'
      : status === 'REJECTED' || status === 'LOST' || status === 'CLOSED_LOST'
        ? 'bg-red-100 text-red-800 border-red-200'
        : status.startsWith('MEETING')
          ? 'bg-blue-100 text-blue-800 border-blue-200'
          : 'bg-slate-100 text-slate-700 border-slate-200'

  return <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${tone}`}>{formatLeadStatus(status)}</span>
}

export default function DashboardPage() {
  const router = useRouter()
  const { user, logout, changePassword } = useAuth()
  const { isLoading: authLoading, hasAccess } = useProtectedRoute()
  const [tab, setTab] = useState<TabKey>('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [leads, setLeads] = useState<CompanyLead[]>([])
  const [users, setUsers] = useState<MockUser[]>([])
  const [filters, setFilters] = useState<LeadFilters>({
    search: '',
    leadType: 'ALL',
    status: 'ALL',
    source: '',
    assignedToUserId: '',
    createdByUserId: '',
    assignedTeam: '',
    dateFrom: '',
    dateTo: '',
  })
  const [activities, setActivities] = useState<ActivityRow[]>([])
  const [autoDeduping, setAutoDeduping] = useState(false)
  const [lastAutoResolvedKey, setLastAutoResolvedKey] = useState('')
  const [passwordForm, setPasswordForm] = useState({ open: false, current: '', next: '', message: '', saving: false })

  const canAssign = user?.role === 'admin' || user?.role === 'ops'
  const roleLabel = user ? rolePermissions[user.role]?.label ?? user.role : 'User'

  async function loadDashboard() {
    setLoading(true)
    setError('')
    try {
      const [userRows, assignmentRows, teacherSnap, parentSnap, schoolSnap, activitySnap] = await Promise.all([
        getUsers(),
        getLeadAssignments(),
        getDocs(query(collection(getDb(), COMPANY_LEAD_COLLECTIONS.TEACHER), orderBy('createdAt', 'desc'), limit(400))),
        getDocs(query(collection(getDb(), COMPANY_LEAD_COLLECTIONS.PARENT), orderBy('createdAt', 'desc'), limit(400))),
        getDocs(query(collection(getDb(), COMPANY_LEAD_COLLECTIONS.SCHOOL), orderBy('createdAt', 'desc'), limit(400))),
        getDocs(query(collection(getDb(), 'lead_activity_log'), orderBy('createdAt', 'desc'), limit(120))),
      ])
      setUsers(userRows)
      const nextLeads = [...teacherSnap.docs, ...parentSnap.docs, ...schoolSnap.docs].map((row) => {
        const collectionName = row.ref.parent.id
        const assignment = assignmentRows[buildLeadAssignmentId(collectionName, row.id)]
        return buildCompanyLead({
          id: row.id,
          collectionName,
          raw: row.data() as Record<string, unknown>,
          assignedToUserId: assignment?.assignedUserId,
          assignedToUserName: assignment?.assignedUserName,
        })
      })
      setLeads(sortCompanyLeadsByCreatedAt(markProbableDuplicates(nextLeads)))
      setActivities(
        activitySnap.docs.map((row) => {
          const data = row.data() as Record<string, unknown>
          return {
            id: row.id,
            activityType: typeof data.activityType === 'string' ? data.activityType : 'NOTE',
            message: typeof data.message === 'string' ? data.message : 'Activity updated.',
            userName: typeof data.userName === 'string' ? data.userName : 'System',
            createdAt: typeof (data.createdAt as { toDate?: () => Date } | undefined)?.toDate === 'function' ? (data.createdAt as { toDate: () => Date }).toDate() : null,
            leadId: typeof data.leadId === 'string' ? data.leadId : '',
            collectionName: typeof data.collectionName === 'string' ? data.collectionName : '',
          }
        })
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed loading dashboard.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (hasAccess) void loadDashboard()
  }, [hasAccess])

  const visibleLeads = useMemo(() => {
    if (!user) return []
    if (roleCanViewAllLeads(user.role)) return leads
    if (user.role === 'sales') return leads.filter((lead) => lead.assignedToUserId === user.id || lead.createdByUserId === user.id)
    return leads.filter((lead) => lead.createdByUserId === user.id || lead.assignedToUserId === user.id)
  }, [leads, user])

  const filteredLeads = useMemo(() => filterCompanyLeads(visibleLeads, filters), [filters, visibleLeads])
  const companySummary = useMemo(() => calculateLeadSummary(leads, user?.id ?? ''), [leads, user])
  const visibleSummary = useMemo(() => calculateLeadSummary(visibleLeads, user?.id ?? ''), [visibleLeads, user])
  const contributions = useMemo(() => buildContributionRows(leads), [leads])
  const weeklyTrend = useMemo(() => buildWeeklyTrend(visibleLeads), [visibleLeads])
  const sourceOptions = useMemo(() => Array.from(new Set(leads.map((lead) => lead.leadSource).filter(Boolean))).sort(), [leads])
  const teamOptions = useMemo(() => Array.from(new Set(leads.map((lead) => lead.currentTeamOwner).filter(Boolean))), [leads])
  const duplicateNames = useMemo(() => visibleLeads.filter((lead) => lead.probableDuplicate).slice(0, 5).map((lead) => lead.schoolName || lead.fullName), [visibleLeads])
  const exactDuplicateGroups = useMemo(() => findExactDuplicateGroups(leads), [leads])
  const exactDuplicateResolutionKey = useMemo(
    () =>
      exactDuplicateGroups
        .map((group) =>
          group.leads
            .map((lead) => `${lead.collectionName}:${lead.id}`)
            .sort()
            .join('|')
        )
        .sort()
        .join('||'),
    [exactDuplicateGroups]
  )
  const visibleActivities = useMemo(() => {
    const keys = new Set(visibleLeads.map((lead) => `${lead.collectionName}:${lead.id}`))
    return activities.filter((activity) => keys.has(`${activity.collectionName}:${activity.leadId}`)).slice(0, 8)
  }, [activities, visibleLeads])

  useEffect(() => {
    if (!user || user.role !== 'admin' || loading || autoDeduping) return
    if (!exactDuplicateResolutionKey || exactDuplicateResolutionKey === lastAutoResolvedKey) return

    let cancelled = false
    const actingUser = user

    async function resolveExactDuplicates() {
      setAutoDeduping(true)
      setError('')
      setMessage('')

      try {
        let removedCount = 0

        for (const group of exactDuplicateGroups) {
          const keepLead = chooseCanonicalLead(group.leads)
          const duplicateLeads = group.leads.filter(
            (lead) => !(lead.collectionName === keepLead.collectionName && lead.id === keepLead.id)
          )

          for (const duplicateLead of duplicateLeads) {
            await deleteLeadRecord({
              collectionName: duplicateLead.collectionName,
              leadId: duplicateLead.id,
              preserveUniqueKeysForLeadId: keepLead.id,
            })
            removedCount += 1
          }

          if (duplicateLeads.length > 0) {
            await logLeadActivity({
              collectionName: keepLead.collectionName,
              leadId: keepLead.id,
              leadType: keepLead.leadType,
              activityType: 'VALIDATION_CHANGED',
              message: `Removed ${duplicateLeads.length} exact duplicate record(s) automatically and kept this record.`,
              userId: actingUser.id,
              userName: actingUser.name,
              metadata: {
                removedLeadIds: duplicateLeads.map((lead) => lead.id),
                removedCollections: duplicateLeads.map((lead) => lead.collectionName),
                resolutionMode: 'automatic',
              },
            })
          }
        }

        if (cancelled) return

        setLastAutoResolvedKey(exactDuplicateResolutionKey)
        if (removedCount > 0) {
          setMessage(`Automatically resolved ${removedCount} exact duplicate record(s). The strongest record in each group was kept.`)
          await loadDashboard()
        }
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to resolve duplicate leads automatically.')
      } finally {
        if (!cancelled) {
          setAutoDeduping(false)
        }
      }
    }

    void resolveExactDuplicates()

    return () => {
      cancelled = true
    }
  }, [autoDeduping, exactDuplicateGroups, exactDuplicateResolutionKey, lastAutoResolvedKey, loading, user])

  const roleCards = useMemo(() => {
    const schoolsRoutedToSales = visibleLeads.filter((lead) => lead.leadType === 'SCHOOL' && lead.currentTeamOwner === 'sales').length
    const parentsRoutedToSales = visibleLeads.filter((lead) => lead.leadType === 'PARENT' && lead.currentTeamOwner === 'sales').length
    const teachersRoutedToHr = visibleLeads.filter((lead) => lead.leadType === 'TEACHER' && lead.currentTeamOwner === 'hr').length
    const revenueClosed = visibleLeads.filter((lead) => isConvertedStatus(lead.status)).reduce((sum, lead) => sum + lead.pipelineValue, 0)
    const revenuePipeline = visibleLeads.filter((lead) => !isConvertedStatus(lead.status)).reduce((sum, lead) => sum + lead.pipelineValue, 0)
    const underVerification = visibleLeads.filter((lead) => lead.status === 'UNDER_VERIFICATION').length
    const approvedTeachers = visibleLeads.filter((lead) => lead.status === 'APPROVED').length
    const activeDeals = visibleLeads.filter((lead) => lead.currentTeamOwner === 'sales' && !['CLOSED_WON', 'CLOSED_LOST', 'LOST', 'REJECTED'].includes(lead.status)).length

    switch (user?.role) {
      case 'lead':
        return [
          ['Leads Today', visibleSummary.addedToday],
          ['Valid Leads', visibleSummary.validLeads],
          ['Rejected Leads', visibleSummary.rejectedLeads],
          ['Weekly Progress', `${visibleSummary.weeklyProgress}/${visibleSummary.weeklyTarget}`],
          ['My Leads', companySummary.myLeads],
          ['My Contribution', `${companySummary.myContributionPct}%`],
        ]
      case 'marketing':
      case 'marketing_staff':
        return [
          ['Assigned Leads', visibleSummary.myAssignedLeads],
          ['Follow-ups Due', visibleSummary.followUpsDueToday],
          ['Qualified Leads', visibleLeads.filter((lead) => lead.qualifiedByUserId).length],
          ['Schools to Sales', schoolsRoutedToSales],
          ['Parents to Sales', parentsRoutedToSales],
          ['Teachers to HR', teachersRoutedToHr],
        ]
      case 'sales':
        return [
          ['Active Deals', activeDeals],
          ['School Deals', visibleLeads.filter((lead) => lead.leadType === 'SCHOOL').length],
          ['Parent Deals', visibleLeads.filter((lead) => lead.leadType === 'PARENT').length],
          ['Revenue Pipeline', revenuePipeline.toLocaleString()],
          ['Revenue Closed', revenueClosed.toLocaleString()],
          ['My Assigned', visibleSummary.myAssignedLeads],
        ]
      case 'hr':
        return [
          ['Teacher Queue', visibleLeads.filter((lead) => lead.leadType === 'TEACHER').length],
          ['Under Verification', underVerification],
          ['Approved', approvedTeachers],
          ['Rejected', visibleLeads.filter((lead) => lead.leadType === 'TEACHER' && lead.status === 'REJECTED').length],
          ['Follow-ups Due', visibleSummary.followUpsDueToday],
          ['My Assigned', visibleSummary.myAssignedLeads],
        ]
      case 'finance':
        return [
          ['Revenue Closed', companySummary.revenueClosed.toLocaleString()],
          ['Revenue Pipeline', companySummary.revenuePipeline.toLocaleString()],
          ['Converted', companySummary.converted],
          ['Conversion Rate', `${companySummary.conversionRate}%`],
          ['School Deals', companySummary.byType.SCHOOL],
          ['Parent Deals', companySummary.byType.PARENT],
        ]
      case 'ops':
        return [
          ['Converted', companySummary.converted],
          ['Teachers Approved', leads.filter((lead) => lead.status === 'APPROVED').length],
          ['Schools Won', leads.filter((lead) => lead.leadType === 'SCHOOL' && lead.status === 'CLOSED_WON').length],
          ['Parents Won', leads.filter((lead) => lead.leadType === 'PARENT' && lead.status === 'CLOSED_WON').length],
          ['Follow-ups Due', companySummary.followUpsDueToday],
          ['My Assigned', visibleSummary.myAssignedLeads],
        ]
      default:
        return [
          ['Company Leads', companySummary.totalLeads],
          ['Valid Leads', companySummary.validLeads],
          ['Meetings Scheduled', leads.filter((lead) => lead.status === 'MEETING_SCHEDULED' || lead.status === 'MEETING_CONFIRMED').length],
          ['Revenue Closed', companySummary.revenueClosed.toLocaleString()],
          ['Revenue Pipeline', companySummary.revenuePipeline.toLocaleString()],
          ['Teachers in HR', teachersRoutedToHr],
        ]
    }
  }, [companySummary, leads, user, visibleLeads, visibleSummary])

  const tabLeads = useMemo(() => {
    const tabConfig = TABS.find((entry) => entry.key === tab)
    return tabConfig?.leadType ? filteredLeads.filter((lead) => lead.leadType === tabConfig.leadType) : filteredLeads
  }, [filteredLeads, tab])

  async function handleAssignmentChange(lead: CompanyLead, assignedUserId: string) {
    if (!user || !canAssign) return
    setError('')
    setMessage('')
    try {
      if (!assignedUserId) {
        await removeLeadAssignment(lead.collectionName, lead.id)
        await setDoc(doc(getDb(), lead.collectionName, lead.id), { assignedToUserId: '', assignedToUserName: '', updatedAt: serverTimestamp() }, { merge: true })
        setMessage('Lead unassigned.')
      } else {
        const assignee = users.find((entry) => entry.id === assignedUserId)
        if (!assignee) throw new Error('Assignee not found.')
        await saveLeadAssignment({
          leadId: lead.id,
          collectionName: lead.collectionName,
          assignedUserId: assignee.id,
          assignedUserName: assignee.name,
          assignedByUserId: user.id,
          assignedByName: user.name,
          assignmentMode: 'manual',
          leadType: lead.leadType,
          notes: 'Updated from dashboard.',
        })
        await setDoc(doc(getDb(), lead.collectionName, lead.id), { assignedToUserId: assignee.id, assignedToUserName: assignee.name, updatedAt: serverTimestamp() }, { merge: true })
        await logLeadActivity({ collectionName: lead.collectionName, leadId: lead.id, leadType: lead.leadType, activityType: 'ASSIGNMENT_CHANGED', message: `Assigned to ${assignee.name}.`, userId: user.id, userName: user.name, metadata: { assignedUserId: assignee.id } })
        setMessage(`Assigned to ${assignee.name}.`)
      }
      await loadDashboard()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update assignment.')
    }
  }

  async function handlePasswordSubmit(event: FormEvent) {
    event.preventDefault()
    if (!passwordForm.current.trim() || !passwordForm.next.trim()) {
      setPasswordForm((prev) => ({ ...prev, message: 'Current password and new password are required.' }))
      return
    }
    setPasswordForm((prev) => ({ ...prev, saving: true, message: '' }))
    try {
      await changePassword(passwordForm.current, passwordForm.next)
      setPasswordForm({ open: false, current: '', next: '', message: 'Password changed successfully.', saving: false })
    } catch (err) {
      setPasswordForm((prev) => ({ ...prev, saving: false, message: err instanceof Error ? err.message : 'Failed to change password.' }))
    }
  }

  function renderCards(rows: CompanyLead[]) {
    return rows.length === 0 ? (
      <div className="rounded-2xl border border-[#C4C3D0] bg-white p-8 text-center text-sm text-[#4A0000]/70">No leads match the current filters.</div>
    ) : (
      <div className="space-y-3">
        {rows.map((lead) => (
          <div key={`${lead.collectionName}-${lead.id}`} className="rounded-2xl border border-[#C4C3D0] bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-[#4A0000]">{lead.schoolName || lead.fullName}</p>
                  {statusChip(lead.status)}
                  {lead.probableDuplicate && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800">Duplicate</span>}
                </div>
                <p className="text-xs text-[#4A0000]/70">{LEAD_TYPE_LABELS[lead.leadType]} | {lead.edunityId}</p>
                <p className="text-sm text-[#4A0000]/80">{lead.contactPerson} | {lead.phoneNumber}{lead.email ? ` | ${lead.email}` : ''}</p>
                <p className="text-sm text-[#4A0000]/70">{lead.location}</p>
                <p className="text-xs text-[#4A0000]/70">Source: {lead.leadSource || 'direct'} | Created by: {lead.createdByUserName || 'Direct'}</p>
                <p className="text-xs text-[#4A0000]/70">Assigned to: {lead.assignedToUserName || 'Unassigned'} | Team: {TEAM_LABELS[lead.currentTeamOwner || 'marketing']} | Created: {lead.createdAt ? lead.createdAt.toLocaleDateString() : '-'}</p>
                {(lead.nextActionDate || lead.nextActionNote) && <p className="text-xs text-[#4A0000]/70">Next action: {lead.nextActionDate ? lead.nextActionDate.toLocaleDateString() : '-'}{lead.nextActionNote ? ` | ${lead.nextActionNote}` : ''}</p>}
              </div>
              <div className="flex w-full flex-col gap-2 lg:w-auto lg:items-end">
                {canAssign && (
                  <select value={lead.assignedToUserId} onChange={(event) => { void handleAssignmentChange(lead, event.target.value) }} className="h-9 rounded-lg border border-[#C4C3D0] px-3 text-xs">
                    <option value="">Unassigned</option>
                    {users.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
                  </select>
                )}
                {lead.leadType === 'TEACHER' && (
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/dashboard/follow-up/${encodeURIComponent(lead.id)}?collection=${encodeURIComponent(lead.collectionName)}`} className="rounded-lg bg-[#4A0000] px-3 py-2 text-xs font-semibold text-white">Follow Up</Link>
                    <Link href={`/dashboard/documents/${encodeURIComponent(lead.edunityId)}`} className="rounded-lg border border-[#4A0000] px-3 py-2 text-xs font-semibold text-[#4A0000]">Documents</Link>
                  </div>
                )}
                {lead.leadType === 'PARENT' && (
                  <Link href={`/dashboard/request-follow-up/${encodeURIComponent(lead.id)}?collection=${encodeURIComponent(lead.collectionName)}`} className="rounded-lg bg-[#4A0000] px-3 py-2 text-xs font-semibold text-white">Follow Up</Link>
                )}
                {lead.leadType === 'SCHOOL' && <Link href="/onboard/schools" className="rounded-lg border border-[#4A0000] px-3 py-2 text-xs font-semibold text-[#4A0000]">Manage in Schools</Link>}
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-[#F2EFF5]"><div className="rounded-xl border border-[#C4C3D0] bg-white px-4 py-3 text-sm text-[#4A0000]/70">Checking authentication...</div></div>
  if (!hasAccess || !user) return null

  return (
    <div className="min-h-screen bg-[#F2EFF5] text-slate-900">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[280px_1fr]">
        <aside className="border-b border-[#C4C3D0] bg-[#ECE7F2] p-4 lg:border-b-0 lg:border-r lg:p-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#4A0000]/70">Edunity Technologies</p>
          <h1 className="mt-1 text-xl font-semibold text-[#4A0000]">Operations Dashboard</h1>
          <p className="mt-1 text-xs text-[#4A0000]/70">{roleLabel} view for company leads, assignments, and contributions.</p>
          <div className="mt-4 rounded-xl border border-[#D8D6E0] bg-white p-3">
            <p className="text-sm font-semibold text-[#4A0000]">{user.name}</p>
            <p className="text-xs text-[#4A0000]/70">@{user.email}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {user.role === 'admin' && <Link href="/admin/staff" className="rounded-md border border-[#C4C3D0] px-3 py-1.5 text-xs font-semibold text-[#4A0000]">Manage Users</Link>}
              <button onClick={() => setPasswordForm((prev) => ({ ...prev, open: !prev.open, message: '' }))} className="rounded-md border border-[#C4C3D0] px-3 py-1.5 text-xs font-semibold text-[#4A0000]">Change Password</button>
              <button onClick={() => { logout(); router.push('/login') }} className="rounded-md bg-[#4A0000] px-3 py-1.5 text-xs font-semibold text-white">Logout</button>
            </div>
            {passwordForm.open && (
              <form onSubmit={handlePasswordSubmit} className="mt-3 space-y-2">
                <input type="password" value={passwordForm.current} onChange={(event) => setPasswordForm((prev) => ({ ...prev, current: event.target.value }))} placeholder="Current password" className="h-9 w-full rounded-md border border-[#C4C3D0] px-3 text-xs" />
                <input type="password" value={passwordForm.next} onChange={(event) => setPasswordForm((prev) => ({ ...prev, next: event.target.value }))} placeholder="New password" className="h-9 w-full rounded-md border border-[#C4C3D0] px-3 text-xs" />
                <button type="submit" disabled={passwordForm.saving} className="w-full rounded-md bg-[#4A0000] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">{passwordForm.saving ? 'Saving...' : 'Update Password'}</button>
              </form>
            )}
            {passwordForm.message && <p className="mt-2 text-[11px] text-[#4A0000]/80">{passwordForm.message}</p>}
          </div>
          <nav className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:mt-6 lg:grid lg:gap-2 lg:overflow-visible">
            {TABS.map((item) => <button key={item.key} onClick={() => { setTab(item.key); setFilters((prev) => ({ ...prev, leadType: item.leadType ?? 'ALL' })) }} className={`whitespace-nowrap rounded-xl px-3 py-2 text-left text-sm font-semibold ${tab === item.key ? 'bg-[#4A0000] text-white' : 'bg-white text-[#4A0000]'}`}>{item.label}</button>)}
          </nav>
        </aside>

        <main className="p-4 sm:p-6 lg:p-10">
          <div className="grid gap-3 rounded-2xl border border-[#C4C3D0] bg-white p-3 xl:grid-cols-8">
            <input value={filters.search} onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))} placeholder="Search lead, phone, ID" className="h-10 rounded-lg border border-[#C4C3D0] px-3 text-sm" />
            <select value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value as LeadStatus | 'ALL' }))} className="h-10 rounded-lg border border-[#C4C3D0] px-3 text-sm"><option value="ALL">All statuses</option>{LEAD_STATUS_OPTIONS.map((option) => <option key={option} value={option}>{formatLeadStatus(option)}</option>)}</select>
            <select value={filters.source} onChange={(event) => setFilters((prev) => ({ ...prev, source: event.target.value }))} className="h-10 rounded-lg border border-[#C4C3D0] px-3 text-sm"><option value="">All sources</option>{sourceOptions.map((source) => <option key={source} value={source}>{source}</option>)}</select>
            <select value={filters.assignedToUserId} onChange={(event) => setFilters((prev) => ({ ...prev, assignedToUserId: event.target.value }))} className="h-10 rounded-lg border border-[#C4C3D0] px-3 text-sm"><option value="">All assignees</option>{users.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select>
            <select value={filters.createdByUserId} onChange={(event) => setFilters((prev) => ({ ...prev, createdByUserId: event.target.value }))} className="h-10 rounded-lg border border-[#C4C3D0] px-3 text-sm"><option value="">All creators</option>{users.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select>
            <select value={filters.assignedTeam} onChange={(event) => setFilters((prev) => ({ ...prev, assignedTeam: event.target.value as LeadFilters['assignedTeam'] }))} className="h-10 rounded-lg border border-[#C4C3D0] px-3 text-sm"><option value="">All teams</option>{teamOptions.map((team) => <option key={team} value={team}>{TEAM_LABELS[team as keyof typeof TEAM_LABELS]}</option>)}</select>
            <input type="date" value={filters.dateFrom} onChange={(event) => setFilters((prev) => ({ ...prev, dateFrom: event.target.value }))} className="h-10 rounded-lg border border-[#C4C3D0] px-3 text-sm" />
            <input type="date" value={filters.dateTo} onChange={(event) => setFilters((prev) => ({ ...prev, dateTo: event.target.value }))} className="h-10 rounded-lg border border-[#C4C3D0] px-3 text-sm" />
            <button onClick={() => setFilters({ search: '', leadType: TABS.find((entry) => entry.key === tab)?.leadType ?? 'ALL', status: 'ALL', source: '', assignedToUserId: '', createdByUserId: '', assignedTeam: '', dateFrom: '', dateTo: '' })} className="h-10 rounded-lg bg-[#4A0000] px-4 text-sm font-semibold text-white">Reset</button>
          </div>

          {loading && <div className="mt-4 rounded-xl border border-[#C4C3D0] bg-white p-4 text-sm text-[#4A0000]/70">Loading lead data...</div>}
          {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
          {message && <div className="mt-4 rounded-xl border border-[#C4C3D0] bg-white p-4 text-sm text-[#4A0000]/80">{message}</div>}
          {!loading && autoDeduping && <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">Resolving exact duplicates automatically and keeping the strongest record in each group.</div>}
          {!loading && duplicateNames.length > 0 && <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">Probable duplicates in view: {duplicateNames.join(', ')}</div>}

          {!loading && <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">{roleCards.map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-[#C4C3D0] bg-white p-4 shadow-sm"><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#4A0000]/70">{label}</p><p className="mt-2 text-2xl font-semibold text-[#4A0000]">{value}</p></div>)}</div>}

          {!loading && tab === 'overview' && (
            <section className="mt-5 space-y-5">
              <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-2xl border border-[#C4C3D0] bg-white p-5 shadow-sm"><TrendChart data={weeklyTrend.map((row) => ({ day: row.label, total: row.total }))} dataKey="total" xAxisKey="day" title="Weekly Lead Progress" height={260} /></div>
                <div className="rounded-2xl border border-[#C4C3D0] bg-white p-5 shadow-sm"><h3 className="text-lg font-semibold text-[#4A0000]">Lead Mix</h3><div className="mt-4 space-y-2">{(['SCHOOL', 'PARENT', 'TEACHER'] as LeadType[]).map((type) => <div key={type} className="flex items-center justify-between rounded-xl border border-[#D8D6E0] px-3 py-2"><span className="font-medium text-[#4A0000]">{LEAD_TYPE_LABELS[type]}</span><span className="text-sm text-[#4A0000]/70">{companySummary.byType[type]}</span></div>)}</div></div>
              </div>
              <div className="grid gap-5 lg:grid-cols-2">
                <div className="rounded-2xl border border-[#C4C3D0] bg-white p-5 shadow-sm"><h3 className="text-lg font-semibold text-[#4A0000]">Top Contributors</h3><div className="mt-4 space-y-2">{contributions.slice(0, 6).map((row) => <div key={row.userId} className="flex items-center justify-between rounded-xl border border-[#D8D6E0] px-3 py-2"><div><p className="font-medium text-[#4A0000]">{row.userName}</p><p className="text-xs text-[#4A0000]/60">{row.leadCount} leads</p></div><p className="text-sm font-semibold text-[#4A0000]">{row.contributionPct}%</p></div>)}</div></div>
                <div className="rounded-2xl border border-[#C4C3D0] bg-white p-5 shadow-sm"><h3 className="text-lg font-semibold text-[#4A0000]">Recent Lead Activity</h3><div className="mt-4 space-y-3">{visibleActivities.length === 0 ? <p className="text-sm text-[#4A0000]/70">No activity logged yet.</p> : visibleActivities.map((activity) => <div key={activity.id} className="rounded-xl border border-[#D8D6E0] p-3"><div className="flex items-center justify-between gap-3"><p className="font-semibold text-[#4A0000]">{activity.activityType.replace(/_/g, ' ')}</p><p className="text-xs uppercase tracking-wide text-[#4A0000]/60">{activity.createdAt ? activity.createdAt.toLocaleDateString() : '-'}</p></div><p className="text-sm text-[#4A0000]/70">{activity.message}</p><p className="text-xs text-[#4A0000]/70">By {activity.userName}</p></div>)}</div></div>
              </div>
            </section>
          )}

          {!loading && tab !== 'overview' && tab !== 'contributions' && <section className="mt-5 space-y-4">{renderCards(tabLeads)}</section>}
          {!loading && tab === 'contributions' && <section className="mt-5 space-y-4"><div className="rounded-2xl border border-[#C4C3D0] bg-white p-5 shadow-sm"><h2 className="text-xl font-semibold text-[#4A0000]">Contribution Overview</h2><div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[['Company Leads', companySummary.totalLeads], ['My Leads', companySummary.myLeads], ['My Assigned', companySummary.myAssignedLeads], ['Conversion Rate', `${companySummary.conversionRate}%`]].map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-[#D8D6E0] p-4"><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#4A0000]/70">{label}</p><p className="mt-2 text-2xl font-semibold text-[#4A0000]">{value}</p></div>)}</div></div><div className="rounded-2xl border border-[#C4C3D0] bg-white p-5 shadow-sm"><h3 className="text-lg font-semibold text-[#4A0000]">Contribution Ranking</h3><div className="mt-4 space-y-2">{contributions.map((row) => <div key={row.userId} className="flex items-center justify-between rounded-xl border border-[#D8D6E0] px-3 py-2"><div><p className="font-medium text-[#4A0000]">{row.userName}</p><p className="text-xs text-[#4A0000]/60">{row.leadCount} leads</p></div><p className="text-sm font-semibold text-[#4A0000]">{row.contributionPct}%</p></div>)}</div></div></section>}
        </main>
      </div>
    </div>
  )
}

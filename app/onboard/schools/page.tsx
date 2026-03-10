'use client'

import { useEffect, useMemo, useState } from 'react'
import { doc, getDocs, limit, orderBy, query, setDoc, collection, serverTimestamp } from 'firebase/firestore'
import { DenseTable } from '@/components/shared/DenseTable'
import { KPITile } from '@/components/shared/KPITile'
import { getDb } from '@/lib/firebase'
import { getUsers, type MockUser } from '@/lib/auth/mock-users'
import { useAuth } from '@/lib/auth/auth-context'
import { buildLeadAssignmentId, getLeadAssignments, saveLeadAssignment } from '@/lib/auth/lead-assignments'
import {
  SCHOOL_LEADS_COLLECTION,
  buildCompanyLead,
  formatLeadStatus,
  markProbableDuplicates,
  sortCompanyLeadsByCreatedAt,
  type CompanyLead,
} from '@/lib/company-leads'
import { logLeadActivity } from '@/lib/lead-audit'
import type { LeadStatus } from '@/lib/types'
import { getStatusOptionsForTeam, TEAM_LABELS } from '@/lib/lead-workflows'

const SOURCE_OPTIONS = ['school_outreach', 'walk_in', 'referral_link', 'event', 'partner_intro']

function statusBadge(status: LeadStatus) {
  const classes =
    status === 'CONVERTED' || status === 'CLOSED_WON'
      ? 'bg-green-100 text-green-800'
      : status === 'REJECTED' || status === 'LOST' || status === 'CLOSED_LOST'
        ? 'bg-red-100 text-red-800'
        : status === 'MEETING_ACCEPTED' || status === 'MEETING_COMPLETED' || status === 'NEGOTIATION'
          ? 'bg-blue-100 text-blue-800'
          : 'bg-neutral-100 text-neutral-700'

  return <span className={`rounded px-2 py-1 text-xs font-medium ${classes}`}>{formatLeadStatus(status)}</span>
}

export default function SchoolsPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [schoolLeads, setSchoolLeads] = useState<CompanyLead[]>([])
  const [users, setUsers] = useState<MockUser[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | LeadStatus>('ALL')
  const [sourceFilter, setSourceFilter] = useState('')
  const [assignedFilter, setAssignedFilter] = useState('')
  const [teamFilter, setTeamFilter] = useState('')

  const [schoolName, setSchoolName] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [location, setLocation] = useState('')
  const [email, setEmail] = useState('')
  const [leadSource, setLeadSource] = useState('school_outreach')
  const [status, setStatus] = useState<LeadStatus>('MEETING_ACCEPTED')
  const [notes, setNotes] = useState('')
  const [expectedRevenue, setExpectedRevenue] = useState('')
  const [nextActionDate, setNextActionDate] = useState('')
  const [nextActionNote, setNextActionNote] = useState('')
  const [allowDuplicateOverride, setAllowDuplicateOverride] = useState(false)

  const schoolStatusOptions = useMemo(() => getStatusOptionsForTeam('SCHOOL', user?.role === 'sales' ? 'sales' : 'marketing', user?.role), [user])

  async function loadPage() {
    setLoading(true)
    setError('')
    try {
      const [userRows, assignmentRows, snap] = await Promise.all([
        getUsers(),
        getLeadAssignments(),
        getDocs(query(collection(getDb(), SCHOOL_LEADS_COLLECTION), orderBy('createdAt', 'desc'), limit(500))),
      ])

      setUsers(userRows)
      const rows = snap.docs.map((row) =>
        buildCompanyLead({
          id: row.id,
          collectionName: SCHOOL_LEADS_COLLECTION,
          raw: row.data() as Record<string, unknown>,
          assignedToUserId: assignmentRows[buildLeadAssignmentId(SCHOOL_LEADS_COLLECTION, row.id)]?.assignedUserId,
          assignedToUserName: assignmentRows[buildLeadAssignmentId(SCHOOL_LEADS_COLLECTION, row.id)]?.assignedUserName,
        })
      )
      setSchoolLeads(sortCompanyLeadsByCreatedAt(markProbableDuplicates(rows)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed loading school leads.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadPage()
  }, [])

  const visibleRows = useMemo(() => {
    const queryText = search.trim().toLowerCase()
    return schoolLeads.filter((lead) => {
      const matchesSearch =
        !queryText ||
        [lead.schoolName, lead.contactPerson, lead.phoneNumber, lead.location, lead.edunityId]
          .join(' ')
          .toLowerCase()
          .includes(queryText)
      const matchesStatus = statusFilter === 'ALL' || lead.status === statusFilter
      const matchesSource = !sourceFilter || lead.leadSource === sourceFilter
      const matchesAssigned = !assignedFilter || lead.assignedToUserId === assignedFilter
      const matchesTeam = !teamFilter || lead.currentTeamOwner === teamFilter
      return matchesSearch && matchesStatus && matchesSource && matchesAssigned && matchesTeam
    })
  }, [assignedFilter, schoolLeads, search, sourceFilter, statusFilter, teamFilter])

  const metrics = useMemo(() => {
    const total = schoolLeads.length
    const converted = schoolLeads.filter((lead) => lead.status === 'CONVERTED').length
    const meetingAccepted = schoolLeads.filter(
      (lead) => lead.status === 'MEETING_ACCEPTED' || lead.status === 'MEETING_COMPLETED'
    ).length
    const myAssigned = user ? schoolLeads.filter((lead) => lead.assignedToUserId === user.id).length : 0

    return { total, converted, meetingAccepted, myAssigned }
  }, [schoolLeads, user])

  async function handleCreateLead() {
    if (!user) return
    if (!schoolName.trim() || !contactPerson.trim() || !phoneNumber.trim() || !location.trim()) {
      setError('School name, contact person, phone number, and location are required.')
      return
    }

    setSaving(true)
    setMessage('')
    setError('')
    try {
      const response = await fetch('/api/school-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolName,
          contactPerson,
          phoneNumber,
          location,
          email,
          leadSource,
          status,
          notes,
          expectedRevenue,
          nextActionDate,
          nextActionNote,
          allowDuplicateOverride,
          createdByUserId: user.id,
          createdByUserName: user.name,
        }),
      })
      const result = (await response.json()) as { ok?: boolean; error?: string }
      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'Failed to create school lead.')
      }

      setSchoolName('')
      setContactPerson('')
      setPhoneNumber('')
      setLocation('')
      setEmail('')
      setLeadSource('school_outreach')
      setStatus('MEETING_ACCEPTED')
      setNotes('')
      setExpectedRevenue('')
      setNextActionDate('')
      setNextActionNote('')
      setAllowDuplicateOverride(false)
      setMessage('School lead created.')
      await loadPage()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create school lead.')
    } finally {
      setSaving(false)
    }
  }

  async function handleStatusChange(lead: CompanyLead, nextStatus: LeadStatus) {
    if (!user) return
    setMessage('')
    setError('')
    try {
      await setDoc(
        doc(getDb(), lead.collectionName, lead.id),
        {
          status: nextStatus,
          isValid: nextStatus !== 'REJECTED',
          currentTeamOwner: user.role === 'sales' ? 'sales' : lead.currentTeamOwner || 'marketing',
          assignedDepartment: user.role === 'sales' ? 'sales' : lead.currentTeamOwner || 'marketing',
          lastStatusChangedByUserId: user.id,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      )
      await logLeadActivity({
        collectionName: lead.collectionName,
        leadId: lead.id,
        leadType: 'SCHOOL',
        activityType: 'STATUS_CHANGED',
        message: `Status updated to ${formatLeadStatus(nextStatus)}.`,
        userId: user.id,
        userName: user.name,
        nextStatus,
      })
      setMessage(`Updated ${lead.schoolName} to ${formatLeadStatus(nextStatus)}.`)
      await loadPage()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status.')
    }
  }

  async function handleAssigneeChange(lead: CompanyLead, assignedUserId: string) {
    if (!user || !assignedUserId) return
    const assignee = users.find((entry) => entry.id === assignedUserId)
    if (!assignee) return

    setMessage('')
    setError('')
    try {
      await saveLeadAssignment({
        leadId: lead.id,
        collectionName: lead.collectionName,
        assignedUserId: assignee.id,
        assignedUserName: assignee.name,
        assignedByUserId: user.id,
        assignedByName: user.name,
        assignmentMode: 'manual',
        leadType: 'SCHOOL',
        notes: 'Updated from schools workspace.',
      })
      await setDoc(
        doc(getDb(), lead.collectionName, lead.id),
        {
          assignedToUserId: assignee.id,
          assignedToUserName: assignee.name,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      )
      await logLeadActivity({
        collectionName: lead.collectionName,
        leadId: lead.id,
        leadType: 'SCHOOL',
        activityType: 'ASSIGNMENT_CHANGED',
        message: `Assigned to ${assignee.name}.`,
        userId: user.id,
        userName: user.name,
        metadata: {
          assignedUserId: assignee.id,
          assignedUserName: assignee.name,
        },
      })
      setMessage(`Assigned ${lead.schoolName} to ${assignee.name}.`)
      await loadPage()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update assignee.')
    }
  }

  const rows = visibleRows.map((lead) => ({
    school: (
      <div className="space-y-1">
        <p className="font-medium text-neutral-900">{lead.schoolName || lead.fullName}</p>
        <p className="text-xs text-neutral-500">{lead.edunityId}</p>
        {lead.probableDuplicate && (
          <span className="rounded bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-800">
            Probable duplicate
          </span>
        )}
      </div>
    ),
    contact: (
      <div className="space-y-1">
        <p>{lead.contactPerson}</p>
        <p className="text-xs text-neutral-500">{lead.phoneNumber}</p>
        <p className="text-xs text-neutral-500">{lead.email || 'No email'}</p>
      </div>
    ),
    source: lead.leadSource,
    team: TEAM_LABELS[lead.currentTeamOwner || 'marketing'],
    status: (
      <select
        value={lead.status}
        onChange={(event) => {
          void handleStatusChange(lead, event.target.value as LeadStatus)
        }}
        className="h-9 rounded border border-neutral-300 bg-white px-2 text-xs"
      >
        {schoolStatusOptions.map((option) => (
          <option key={option} value={option}>
            {formatLeadStatus(option)}
          </option>
        ))}
      </select>
    ),
    statusBadge: statusBadge(lead.status),
    assigned: (
      <select
        value={lead.assignedToUserId}
        onChange={(event) => {
          void handleAssigneeChange(lead, event.target.value)
        }}
        className="h-9 rounded border border-neutral-300 bg-white px-2 text-xs"
      >
        <option value="">Unassigned</option>
        {users.map((entry) => (
          <option key={entry.id} value={entry.id}>
            {entry.name}
          </option>
        ))}
      </select>
    ),
    createdBy: lead.createdByUserName || 'Direct',
    nextAction: lead.nextActionDate ? lead.nextActionDate.toLocaleDateString() : lead.nextActionNote || '-',
    location: lead.location,
    created: lead.createdAt ? lead.createdAt.toLocaleDateString() : '-',
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-neutral-900">Schools CRM</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Live school lead intake, follow-up status, and ownership tracking.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KPITile label="School Leads" value={metrics.total} unit="total" />
        <KPITile label="Meeting Accepted" value={metrics.meetingAccepted} unit="qualified" />
        <KPITile label="Converted" value={metrics.converted} unit="won" />
        <KPITile label="My Assigned" value={metrics.myAssigned} unit="leads" />
      </div>

      <div className="rounded-lg border border-ink-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-neutral-900">Add School Lead</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <input value={schoolName} onChange={(event) => setSchoolName(event.target.value)} placeholder="School name" className="rounded border border-neutral-300 px-3 py-2 text-sm" />
          <input value={contactPerson} onChange={(event) => setContactPerson(event.target.value)} placeholder="Contact person" className="rounded border border-neutral-300 px-3 py-2 text-sm" />
          <input value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} placeholder="Phone number" className="rounded border border-neutral-300 px-3 py-2 text-sm" />
          <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Location" className="rounded border border-neutral-300 px-3 py-2 text-sm" />
          <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email (optional)" className="rounded border border-neutral-300 px-3 py-2 text-sm" />
          <select value={leadSource} onChange={(event) => setLeadSource(event.target.value)} className="rounded border border-neutral-300 px-3 py-2 text-sm">
            {SOURCE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <select value={status} onChange={(event) => setStatus(event.target.value as LeadStatus)} className="rounded border border-neutral-300 px-3 py-2 text-sm">
            {schoolStatusOptions.map((option) => (
              <option key={option} value={option}>
                {formatLeadStatus(option)}
              </option>
            ))}
          </select>
          <input value={expectedRevenue} onChange={(event) => setExpectedRevenue(event.target.value)} placeholder="Expected revenue (optional)" className="rounded border border-neutral-300 px-3 py-2 text-sm" />
          <input type="date" value={nextActionDate} onChange={(event) => setNextActionDate(event.target.value)} className="rounded border border-neutral-300 px-3 py-2 text-sm" />
          <input value={nextActionNote} onChange={(event) => setNextActionNote(event.target.value)} placeholder="Next action note" className="rounded border border-neutral-300 px-3 py-2 text-sm" />
          <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Internal note (optional)" className="rounded border border-neutral-300 px-3 py-2 text-sm xl:col-span-3" />
        </div>
        {user?.role === 'admin' && <label className="mt-3 flex items-center gap-2 text-sm text-neutral-600">
          <input type="checkbox" checked={allowDuplicateOverride} onChange={(event) => setAllowDuplicateOverride(event.target.checked)} />
          Allow duplicate override
        </label>}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button onClick={handleCreateLead} disabled={saving} className="rounded bg-[hsl(var(--primary))] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60">
            {saving ? 'Saving...' : '+ New School Lead'}
          </button>
          {message && <p className="text-sm text-green-700">{message}</p>}
          {error && <p className="text-sm text-red-700">{error}</p>}
        </div>
      </div>

      <div className="rounded-lg border border-ink-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search school, contact, phone, ID" className="rounded border border-neutral-300 px-3 py-2 text-sm" />
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'ALL' | LeadStatus)} className="rounded border border-neutral-300 px-3 py-2 text-sm">
            <option value="ALL">All statuses</option>
            {schoolStatusOptions.map((option) => (
              <option key={option} value={option}>
                {formatLeadStatus(option)}
              </option>
            ))}
          </select>
          <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)} className="rounded border border-neutral-300 px-3 py-2 text-sm">
            <option value="">All sources</option>
            {SOURCE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <select value={assignedFilter} onChange={(event) => setAssignedFilter(event.target.value)} className="rounded border border-neutral-300 px-3 py-2 text-sm">
            <option value="">All assignees</option>
            {users.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
          <select value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)} className="rounded border border-neutral-300 px-3 py-2 text-sm">
            <option value="">All teams</option>
            <option value="marketing">Marketing</option>
            <option value="sales">Sales</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="rounded-lg border border-ink-200 bg-white p-6 text-sm text-neutral-500">Loading school leads...</div>
      ) : (
        <DenseTable
          columns={[
            { label: 'School', key: 'school', width: '24%' },
            { label: 'Contact', key: 'contact', width: '18%' },
            { label: 'Team', key: 'team', width: '10%', hideOnMobile: true },
            { label: 'Status', key: 'status', width: '16%' },
            { label: 'Status View', key: 'statusBadge', width: '12%', hideOnMobile: true },
            { label: 'Assigned To', key: 'assigned', width: '16%' },
            { label: 'Next Action', key: 'nextAction', width: '14%', hideOnMobile: true },
            { label: 'Source', key: 'source', width: '12%', hideOnMobile: true },
            { label: 'Created By', key: 'createdBy', width: '12%', hideOnMobile: true },
            { label: 'Created', key: 'created', width: '10%', hideOnMobile: true },
          ]}
          rows={rows}
        />
      )}
    </div>
  )
}

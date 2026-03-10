'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc } from 'firebase/firestore'
import { getDb } from '@/lib/firebase'
import { useAuth } from '@/lib/auth/auth-context'
import { getUsers, type MockUser } from '@/lib/auth/mock-users'
import { saveLeadAssignment } from '@/lib/auth/lead-assignments'
import { formatLeadStatus, normalizeLeadStatus } from '@/lib/company-leads'
import { logLeadActivity } from '@/lib/lead-audit'
import { routeLeadToTeam } from '@/lib/lead-routing'
import { TEAM_LABELS, formatTeamOwner, getDefaultRouteTeam, getEligibleRolesForTeam, getRoutingLabel, getStatusOptionsForTeam } from '@/lib/lead-workflows'
import type { LeadStatus, TeamOwner } from '@/lib/types'

type ContactMethod = 'whatsapp' | 'call' | 'email'
type ActivityRow = { id: string; type: string; message: string; userName: string; createdAt: string; notes: string }

function toDate(value: unknown) {
  if (!value) return null
  if (typeof (value as { toDate?: () => Date }).toDate === 'function') return (value as { toDate: () => Date }).toDate()
  const next = new Date(value as string)
  return Number.isNaN(next.getTime()) ? null : next
}

function contactActivityType(method: ContactMethod) {
  if (method === 'call') return 'CALL'
  if (method === 'email') return 'EMAIL'
  return 'WHATSAPP'
}

export default function RequestFollowUpPage() {
  const { user } = useAuth()
  const params = useParams<{ docId: string }>()
  const searchParams = useSearchParams()
  const docId = params.docId
  const collectionName = searchParams.get('collection') || 'parent_requests'

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [lead, setLead] = useState<Record<string, unknown> | null>(null)
  const [users, setUsers] = useState<MockUser[]>([])
  const [activities, setActivities] = useState<ActivityRow[]>([])

  const [assignedToUserId, setAssignedToUserId] = useState('')
  const [status, setStatus] = useState<LeadStatus>('NEW')
  const [contactMethod, setContactMethod] = useState<ContactMethod>('whatsapp')
  const [contactDate, setContactDate] = useState('')
  const [contactTime, setContactTime] = useState('')
  const [parentGoal, setParentGoal] = useState('')
  const [budgetRange, setBudgetRange] = useState('')
  const [preferredStartDate, setPreferredStartDate] = useState('')
  const [summary, setSummary] = useState('')
  const [nextActionDate, setNextActionDate] = useState('')
  const [nextActionNote, setNextActionNote] = useState('')
  const [schoolsSuggested, setSchoolsSuggested] = useState('')
  const [schoolSelected, setSchoolSelected] = useState('')
  const [enrollmentFee, setEnrollmentFee] = useState('')
  const [routeToSales, setRouteToSales] = useState<'no' | 'yes'>('no')
  const [handoffNote, setHandoffNote] = useState('')

  const currentTeamOwner = useMemo<TeamOwner>(() => {
    const team = typeof lead?.currentTeamOwner === 'string' ? lead.currentTeamOwner.trim().toLowerCase() : ''
    return team === 'sales' ? 'sales' : 'marketing'
  }, [lead])
  const routeTarget = getDefaultRouteTeam('PARENT')
  const canRoute = currentTeamOwner === 'marketing' && Boolean(user && ['marketing', 'marketing_staff', 'admin'].includes(user.role))
  const ownerOptions = useMemo(() => {
    const allowedRoles = getEligibleRolesForTeam(currentTeamOwner)
    return users.filter((entry) => allowedRoles.includes(entry.role))
  }, [currentTeamOwner, users])
  const statusOptions = useMemo(() => getStatusOptionsForTeam('PARENT', currentTeamOwner, user?.role), [currentTeamOwner, user])
  const effectiveStatus = useMemo<LeadStatus>(() => routeToSales === 'yes' ? 'INTRO_COMPLETE' : status, [routeToSales, status])

  async function loadPage() {
    setLoading(true)
    setError('')
    try {
      const [leadSnap, userRows, activitySnap] = await Promise.all([
        getDoc(doc(getDb(), collectionName, docId)),
        getUsers(),
        getDocs(query(collection(getDb(), 'lead_activity_log'), orderBy('createdAt', 'desc'), limit(100))),
      ])
      if (!leadSnap.exists()) throw new Error('Parent request record not found.')
      const data = leadSnap.data() as Record<string, unknown>
      setLead(data)
      setUsers(userRows)
      setAssignedToUserId(typeof data.assignedToUserId === 'string' ? data.assignedToUserId : '')
      setStatus(normalizeLeadStatus(data.status ?? data.leadStatus, 'PARENT'))
      setNextActionDate(toDate(data.nextActionDate)?.toISOString().slice(0, 10) ?? '')
      setNextActionNote(typeof data.nextActionNote === 'string' ? data.nextActionNote : '')
      setActivities(
        activitySnap.docs
          .map((row) => ({ id: row.id, ...(row.data() as Record<string, unknown>) }) as Record<string, unknown> & { id: string })
          .filter((row) => row.leadId === docId && row.collectionName === collectionName)
          .slice(0, 10)
          .map((row) => ({
            id: String(row.id),
            type: typeof row.activityType === 'string' ? row.activityType : 'NOTE',
            message: typeof row.message === 'string' ? row.message : 'Activity saved.',
            userName: typeof row.userName === 'string' ? row.userName : 'System',
            createdAt: toDate(row.createdAt)?.toLocaleString() ?? '-',
            notes: typeof row.notes === 'string' ? row.notes : '',
          }))
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed loading record.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadPage()
  }, [collectionName, docId])

  const edunityId = useMemo(() => {
    if (!lead) return docId
    const value = lead.edunityId ?? lead.edunity_id
    return typeof value === 'string' && value.trim() ? value.trim() : docId
  }, [lead, docId])

  async function saveFollowUp() {
    if (!user || !lead) return
    setSaving(true)
    setError('')
    setOk('')
    try {
      if (!contactDate || !contactTime) throw new Error('Contact date and time are required.')
      if (summary.trim().length < 20) throw new Error('Summary should be at least 20 characters.')
      if (routeToSales === 'yes') {
        if (!canRoute) throw new Error('Only marketing can route this parent lead to sales.')
        if (handoffNote.trim().length < 10) throw new Error('Add a handoff note before routing to sales.')
      } else if (!assignedToUserId) {
        throw new Error('Select the current staff owner first.')
      }

      const selectedOwner = ownerOptions.find((entry) => entry.id === assignedToUserId)

      await addDoc(collection(getDb(), 'parent_request_follow_ups'), {
        sourceCollection: collectionName,
        sourceDocId: docId,
        edunityId,
        assignedToUserId: routeToSales === 'yes' ? null : selectedOwner?.id ?? null,
        assignedToUserName: routeToSales === 'yes' ? null : selectedOwner?.name ?? null,
        teamOwner: routeToSales === 'yes' ? routeTarget : currentTeamOwner,
        status: effectiveStatus,
        outreach: { method: contactMethod, date: contactDate, time: contactTime },
        discovery: { parentGoal: parentGoal || null, budgetRange: budgetRange || null, preferredStartDate: preferredStartDate || null },
        salesPipeline: { schoolsSuggested: schoolsSuggested || null, schoolSelected: schoolSelected || null, enrollmentFee: enrollmentFee || null },
        summary: summary.trim(),
        nextAction: { date: nextActionDate || null, note: nextActionNote || null },
        handoffNote: routeToSales === 'yes' ? handoffNote.trim() : null,
        createdAt: serverTimestamp(),
      })

      await logLeadActivity({
        collectionName,
        leadId: docId,
        leadType: 'PARENT',
        activityType: contactActivityType(contactMethod),
        message: `${contactMethod === 'call' ? 'Call' : contactMethod === 'email' ? 'Email' : 'WhatsApp'} logged for parent lead.`,
        userId: user.id,
        userName: user.name,
        nextStatus: effectiveStatus,
        notes: summary.trim(),
        nextActionDate: nextActionDate || null,
        teamOwner: routeToSales === 'yes' ? routeTarget : currentTeamOwner,
      })

      if (routeToSales === 'yes') {
        await routeLeadToTeam({
          leadId: docId,
          collectionName,
          leadType: 'PARENT',
          nextStatus: 'INTRO_COMPLETE',
          toTeam: routeTarget,
          routedByUserId: user.id,
          routedByUserName: user.name,
          handoffNote: handoffNote.trim(),
          createdByUserId: typeof lead.createdByUserId === 'string' ? lead.createdByUserId : '',
          createdByUserName: typeof lead.createdByUserName === 'string' ? lead.createdByUserName : '',
          nextActionDate: nextActionDate || '',
          nextActionNote: nextActionNote || '',
        })
      } else {
        if (!selectedOwner) throw new Error('Selected owner was not found.')
        await saveLeadAssignment({
          leadId: docId,
          collectionName,
          assignedUserId: selectedOwner.id,
          assignedUserName: selectedOwner.name,
          assignedByUserId: user.id,
          assignedByName: user.name,
          assignmentMode: 'manual',
          leadType: 'PARENT',
          notes: 'Updated from parent workflow.',
        })
        await setDoc(doc(getDb(), collectionName, docId), {
          status: effectiveStatus,
          currentTeamOwner,
          assignedDepartment: currentTeamOwner,
          assignedToUserId: selectedOwner.id,
          assignedToUserName: selectedOwner.name,
          qualifiedByUserId: currentTeamOwner === 'marketing' ? user.id : typeof lead.qualifiedByUserId === 'string' ? lead.qualifiedByUserId : '',
          lastStatusChangedByUserId: user.id,
          lastContactSummary: summary.trim(),
          nextActionDate: nextActionDate || '',
          nextActionNote: nextActionNote || '',
          budgetRange,
          schoolsSuggested,
          schoolSelected,
          enrollmentFee,
          updatedAt: serverTimestamp(),
        }, { merge: true })
        await logLeadActivity({
          collectionName,
          leadId: docId,
          leadType: 'PARENT',
          activityType: 'STATUS_CHANGED',
          message: `Parent lead updated to ${formatLeadStatus(effectiveStatus)}.`,
          userId: user.id,
          userName: user.name,
          nextStatus: effectiveStatus,
          notes: nextActionNote || summary.trim(),
          nextActionDate: nextActionDate || null,
          teamOwner: currentTeamOwner,
        })
      }

      setOk(routeToSales === 'yes' ? 'Parent lead routed to sales successfully.' : 'Request follow-up saved successfully.')
      setRouteToSales('no')
      setHandoffNote('')
      await loadPage()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save follow-up.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F2EFF5] p-4 sm:p-6 lg:p-10">
      <div className="mx-auto max-w-6xl space-y-4">
        <Link href="/dashboard" className="inline-flex rounded-lg border border-[#C4C3D0] bg-white px-3 py-2 text-sm font-semibold text-[#4A0000]">Back to Dashboard</Link>
        <div className="rounded-2xl border border-[#C4C3D0] bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-[#4A0000]">Parent Request ID: {edunityId}</p>
          <p className="mt-1 text-xs text-[#4A0000]/70">Current team owner: {formatTeamOwner(currentTeamOwner)}</p>
        </div>
        {loading && <div className="rounded-2xl border border-[#C4C3D0] bg-white p-4 text-sm text-[#4A0000]/70">Loading record...</div>}
        {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        {ok && <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">{ok}</div>}
        {lead && (
          <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
            <div className="space-y-4 rounded-2xl border border-[#C4C3D0] bg-white p-5 shadow-sm">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#4A0000]">Assign Staff Owner</label>
                  <select value={assignedToUserId} onChange={(e) => setAssignedToUserId(e.target.value)} className="h-10 w-full rounded-lg border border-[#C4C3D0] px-3 text-sm">
                    <option value="">Select owner</option>
                    {ownerOptions.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#4A0000]">Status</label>
                  <select value={status} onChange={(e) => setStatus(e.target.value as LeadStatus)} className="h-10 w-full rounded-lg border border-[#C4C3D0] px-3 text-sm">
                    {statusOptions.map((option) => <option key={option} value={option}>{formatLeadStatus(option)}</option>)}
                  </select>
                </div>
              </div>
              {canRoute && (
                <div className="rounded-lg border border-[#E4E1EC] bg-[#F7F4FA] p-3 space-y-3">
                  <h3 className="text-sm font-semibold text-[#4A0000]">Routing</h3>
                  <select value={routeToSales} onChange={(e) => setRouteToSales(e.target.value as 'no' | 'yes')} className="h-10 w-full rounded-lg border border-[#C4C3D0] px-3 text-sm">
                    <option value="no">Keep in Marketing</option>
                    <option value="yes">{getRoutingLabel('PARENT')}</option>
                  </select>
                  <textarea value={handoffNote} onChange={(e) => setHandoffNote(e.target.value)} rows={3} placeholder="Required handoff note for Sales" className="w-full rounded-lg border border-[#C4C3D0] p-3 text-sm" />
                </div>
              )}
              <div className="rounded-lg border border-[#E4E1EC] bg-[#F7F4FA] p-3 space-y-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <select value={contactMethod} onChange={(e) => setContactMethod(e.target.value as ContactMethod)} className="h-10 rounded-lg border border-[#C4C3D0] px-3 text-sm"><option value="whatsapp">WhatsApp</option><option value="call">Call</option><option value="email">Email</option></select>
                  <input type="date" value={contactDate} onChange={(e) => setContactDate(e.target.value)} className="h-10 rounded-lg border border-[#C4C3D0] px-3 text-sm" />
                  <input type="time" value={contactTime} onChange={(e) => setContactTime(e.target.value)} className="h-10 rounded-lg border border-[#C4C3D0] px-3 text-sm" />
                </div>
                <input value={parentGoal} onChange={(e) => setParentGoal(e.target.value)} placeholder="Parent goal / challenge" className="h-10 w-full rounded-lg border border-[#C4C3D0] px-3 text-sm" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <input value={budgetRange} onChange={(e) => setBudgetRange(e.target.value)} placeholder="Budget range" className="h-10 rounded-lg border border-[#C4C3D0] px-3 text-sm" />
                  <input type="date" value={preferredStartDate} onChange={(e) => setPreferredStartDate(e.target.value)} className="h-10 rounded-lg border border-[#C4C3D0] px-3 text-sm" />
                </div>
                <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={4} placeholder="Call summary (minimum 20 characters)" className="w-full rounded-lg border border-[#C4C3D0] p-3 text-sm" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <input type="date" value={nextActionDate} onChange={(e) => setNextActionDate(e.target.value)} className="h-10 rounded-lg border border-[#C4C3D0] px-3 text-sm" />
                  <input value={nextActionNote} onChange={(e) => setNextActionNote(e.target.value)} placeholder="Next action note" className="h-10 rounded-lg border border-[#C4C3D0] px-3 text-sm" />
                </div>
              </div>
              <div className="rounded-lg border border-[#E4E1EC] bg-[#F7F4FA] p-3 space-y-3">
                <h3 className="text-sm font-semibold text-[#4A0000]">Sales Detail</h3>
                <input value={schoolsSuggested} onChange={(e) => setSchoolsSuggested(e.target.value)} placeholder="Schools suggested" className="h-10 w-full rounded-lg border border-[#C4C3D0] px-3 text-sm" />
                <input value={schoolSelected} onChange={(e) => setSchoolSelected(e.target.value)} placeholder="School selected" className="h-10 w-full rounded-lg border border-[#C4C3D0] px-3 text-sm" />
                <input value={enrollmentFee} onChange={(e) => setEnrollmentFee(e.target.value)} placeholder="Enrollment fee / revenue value" className="h-10 w-full rounded-lg border border-[#C4C3D0] px-3 text-sm" />
              </div>
              <button onClick={saveFollowUp} disabled={saving} className="w-full rounded-lg bg-[#4A0000] px-4 py-2 text-sm font-semibold text-white hover:bg-[#630000] disabled:opacity-60">{saving ? 'Saving...' : routeToSales === 'yes' ? 'Save and Route to Sales' : 'Save Request Follow-up'}</button>
            </div>
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#C4C3D0] bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-[#4A0000]">Recent Activity</h2>
                <div className="mt-3 space-y-3">
                  {activities.length === 0 && <p className="text-sm text-[#4A0000]/70">No activity logged yet.</p>}
                  {activities.map((activity) => <div key={activity.id} className="rounded-xl border border-[#E4E1EC] bg-[#F7F4FA] p-3"><p className="text-sm font-semibold text-[#4A0000]">{activity.type.replace(/_/g, ' ')}</p><p className="text-sm text-[#4A0000]/80">{activity.message}</p><p className="text-[11px] text-[#4A0000]/60">{activity.userName} • {activity.createdAt}</p>{activity.notes && <p className="text-xs text-[#4A0000]/70">{activity.notes}</p>}</div>)}
                </div>
              </div>
              <div className="rounded-2xl border border-[#C4C3D0] bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-[#4A0000]">Lead Snapshot</h2>
                <div className="mt-3 space-y-2 text-sm text-[#4A0000]/80">
                  <p>Team owner: {formatTeamOwner(currentTeamOwner)}</p>
                  <p>Current status: {formatLeadStatus(effectiveStatus)}</p>
                  <p>Route target: {TEAM_LABELS[routeTarget]}</p>
                  <p>Referral: {typeof lead.referralCode === 'string' && lead.referralCode ? lead.referralCode : 'Direct'}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

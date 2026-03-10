'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc } from 'firebase/firestore'
import { getDb } from '@/lib/firebase'
import { useAuth } from '@/lib/auth/auth-context'
import { getUsers, type MockUser } from '@/lib/auth/mock-users'
import { saveLeadAssignment } from '@/lib/auth/lead-assignments'
import { formatLeadStatus, resolveLeadStatus } from '@/lib/company-leads'
import { logLeadActivity } from '@/lib/lead-audit'
import { routeLeadToTeam } from '@/lib/lead-routing'
import { TEAM_LABELS, formatTeamOwner, getDefaultRouteTeam, getEligibleRolesForTeam, getRoutingLabel, getStatusOptionsForTeam } from '@/lib/lead-workflows'
import type { LeadStatus, TeamOwner } from '@/lib/types'

type YesNo = 'yes' | 'no'
type LeadTag = 'awaiting_documents' | 'documents_submitted' | 'ready_for_screening' | 'incomplete'
type ContactMethod = 'whatsapp' | 'call'
type ActivityRow = { id: string; type: string; message: string; userName: string; createdAt: string; notes: string }

function toDate(value: unknown) {
  if (!value) return null
  if (typeof (value as { toDate?: () => Date }).toDate === 'function') return (value as { toDate: () => Date }).toDate()
  const next = new Date(value as string)
  return Number.isNaN(next.getTime()) ? null : next
}

function statusToLeadTag(status: LeadStatus): LeadTag {
  if (status === 'INTERESTED' || status === 'SENT_TO_HR') return 'ready_for_screening'
  if (status === 'ONBOARDING_COMPLETED') return 'documents_submitted'
  if (status === 'LOST') return 'incomplete'
  return 'awaiting_documents'
}

function leadTagToStatus(tag: LeadTag): LeadStatus {
  if (tag === 'ready_for_screening') return 'INTERESTED'
  if (tag === 'documents_submitted') return 'ONBOARDING_COMPLETED'
  if (tag === 'incomplete') return 'LOST'
  return 'CONTACTED'
}

export default function FollowUpPage() {
  const { user } = useAuth()
  const params = useParams<{ docId: string }>()
  const searchParams = useSearchParams()
  const docId = params.docId
  const collectionName = searchParams.get('collection') || 'teacher_interests'

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [lead, setLead] = useState<Record<string, unknown> | null>(null)
  const [users, setUsers] = useState<MockUser[]>([])
  const [activities, setActivities] = useState<ActivityRow[]>([])

  const [assignedToUserId, setAssignedToUserId] = useState('')
  const [leadTag, setLeadTag] = useState<LeadTag>('awaiting_documents')
  const [verificationStatus, setVerificationStatus] = useState<LeadStatus>('UNDER_VERIFICATION')
  const [contactMethod, setContactMethod] = useState<ContactMethod>('whatsapp')
  const [callDate, setCallDate] = useState('')
  const [callTime, setCallTime] = useState('')
  const [summary, setSummary] = useState('')
  const [nextActionDate, setNextActionDate] = useState('')
  const [nextActionNote, setNextActionNote] = useState('')
  const [curriculumFamiliarity, setCurriculumFamiliarity] = useState('')
  const [waecNecoExperience, setWaecNecoExperience] = useState('')
  const [availabilityBlocks, setAvailabilityBlocks] = useState('')
  const [cvProvided, setCvProvided] = useState<YesNo>('no')
  const [validIdProvided, setValidIdProvided] = useState<YesNo>('no')
  const [qualificationProvided, setQualificationProvided] = useState<YesNo>('no')
  const [backgroundConsent, setBackgroundConsent] = useState<YesNo>('no')
  const [dataConsent, setDataConsent] = useState<YesNo>('no')
  const [passToVerification, setPassToVerification] = useState<YesNo>('no')
  const [handoffNote, setHandoffNote] = useState('')

  const currentTeamOwner = useMemo<TeamOwner>(() => {
    const team = typeof lead?.currentTeamOwner === 'string' ? lead.currentTeamOwner.trim().toLowerCase() : ''
    return team === 'hr' ? 'hr' : 'marketing'
  }, [lead])
  const routeTarget = getDefaultRouteTeam('TEACHER')
  const canRoute = currentTeamOwner === 'marketing' && Boolean(user && ['marketing', 'marketing_staff', 'admin'].includes(user.role))
  const ownerOptions = useMemo(() => {
    const allowedRoles = getEligibleRolesForTeam(currentTeamOwner)
    return users.filter((entry) => allowedRoles.includes(entry.role))
  }, [currentTeamOwner, users])
  const statusOptions = useMemo(() => getStatusOptionsForTeam('TEACHER', currentTeamOwner, user?.role), [currentTeamOwner, user])
  const nextStatus = useMemo<LeadStatus>(() => currentTeamOwner === 'hr' ? verificationStatus : passToVerification === 'yes' ? 'SENT_TO_HR' : leadTagToStatus(leadTag), [currentTeamOwner, leadTag, passToVerification, verificationStatus])

  async function loadPage() {
    setLoading(true)
    setError('')
    try {
      const [leadSnap, userRows, activitySnap] = await Promise.all([
        getDoc(doc(getDb(), collectionName, docId)),
        getUsers(),
        getDocs(query(collection(getDb(), 'lead_activity_log'), orderBy('createdAt', 'desc'), limit(100))),
      ])
      if (!leadSnap.exists()) throw new Error('Teacher record not found.')
      const data = leadSnap.data() as Record<string, unknown>
      const currentStatus = resolveLeadStatus(data, 'TEACHER')
      setLead(data)
      setUsers(userRows)
      setAssignedToUserId(typeof data.assignedToUserId === 'string' ? data.assignedToUserId : '')
      setLeadTag(statusToLeadTag(currentStatus))
      setVerificationStatus(currentStatus === 'APPROVED' || currentStatus === 'REJECTED' ? currentStatus : 'UNDER_VERIFICATION')
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
      if (!callDate || !callTime) throw new Error('Call log date and time are required.')
      if (summary.trim().length < 20) throw new Error('Summary should be at least 20 characters.')
      if (passToVerification === 'yes') {
        if (!canRoute) throw new Error('Only marketing can route this teacher to HR.')
        if (leadTag !== 'ready_for_screening') throw new Error('Set tag to Ready for Screening before routing to HR.')
        if (backgroundConsent !== 'yes' || dataConsent !== 'yes' || handoffNote.trim().length < 10) {
          throw new Error('Consent fields and a handoff note are required before routing to HR.')
        }
      } else if (!assignedToUserId) {
        throw new Error('Select the current staff owner first.')
      }

      const selectedOwner = ownerOptions.find((entry) => entry.id === assignedToUserId)

      await addDoc(collection(getDb(), 'teacher_follow_ups'), {
        sourceCollection: collectionName,
        sourceDocId: docId,
        assignedToUserId: passToVerification === 'yes' ? null : selectedOwner?.id ?? null,
        assignedToUserName: passToVerification === 'yes' ? null : selectedOwner?.name ?? null,
        teamOwner: passToVerification === 'yes' ? routeTarget : currentTeamOwner,
        status: nextStatus,
        leadTag,
        surfaceQualification: { curriculumFamiliarity, waecNecoExperience, availabilityBlocks },
        documentation: { cvProvided: cvProvided === 'yes', validIdProvided: validIdProvided === 'yes', qualificationProvided: qualificationProvided === 'yes' },
        compliance: { backgroundConsent: backgroundConsent === 'yes', dataConsent: dataConsent === 'yes' },
        internalCallLog: { date: callDate, time: callTime, method: contactMethod, summary, nextActionDate: nextActionDate || null, nextActionNote: nextActionNote || null },
        handoff: { passToVerificationTeam: passToVerification === 'yes', handoffNote: handoffNote || null, destinationTeam: passToVerification === 'yes' ? TEAM_LABELS[routeTarget] : null },
        createdAt: serverTimestamp(),
      })

      await logLeadActivity({
        collectionName,
        leadId: docId,
        leadType: 'TEACHER',
        activityType: contactMethod === 'call' ? 'CALL' : 'WHATSAPP',
        message: `${contactMethod === 'call' ? 'Call' : 'WhatsApp'} logged for teacher lead.`,
        userId: user.id,
        userName: user.name,
        nextStatus,
        notes: summary.trim(),
        nextActionDate: nextActionDate || null,
        teamOwner: passToVerification === 'yes' ? routeTarget : currentTeamOwner,
      })

      if (passToVerification === 'yes') {
        await routeLeadToTeam({
          leadId: docId,
          collectionName,
          leadType: 'TEACHER',
          nextStatus: 'SENT_TO_HR',
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
          leadType: 'TEACHER',
          notes: 'Updated from teacher workflow.',
        })
        await setDoc(doc(getDb(), collectionName, docId), {
          status: nextStatus,
          currentTeamOwner,
          assignedDepartment: currentTeamOwner,
          assignedToUserId: selectedOwner.id,
          assignedToUserName: selectedOwner.name,
          leadTag,
          qualifiedByUserId: currentTeamOwner === 'marketing' ? user.id : typeof lead.qualifiedByUserId === 'string' ? lead.qualifiedByUserId : '',
          lastStatusChangedByUserId: user.id,
          lastContactSummary: summary.trim(),
          nextActionDate: nextActionDate || '',
          nextActionNote: nextActionNote || '',
          updatedAt: serverTimestamp(),
        }, { merge: true })
        await logLeadActivity({
          collectionName,
          leadId: docId,
          leadType: 'TEACHER',
          activityType: 'STATUS_CHANGED',
          message: `Teacher lead updated to ${formatLeadStatus(nextStatus)}.`,
          userId: user.id,
          userName: user.name,
          nextStatus,
          notes: nextActionNote || summary.trim(),
          nextActionDate: nextActionDate || null,
          teamOwner: currentTeamOwner,
        })
      }

      setOk(passToVerification === 'yes' ? 'Teacher routed to HR successfully.' : 'Follow-up saved successfully.')
      setPassToVerification('no')
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
          <p className="text-sm font-semibold text-[#4A0000]">Edunity ID: {edunityId}</p>
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
                {currentTeamOwner === 'hr' ? (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-[#4A0000]">Verification Status</label>
                    <select value={verificationStatus} onChange={(e) => setVerificationStatus(e.target.value as LeadStatus)} className="h-10 w-full rounded-lg border border-[#C4C3D0] px-3 text-sm">
                      {statusOptions.map((option) => <option key={option} value={option}>{formatLeadStatus(option)}</option>)}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-[#4A0000]">Internal Tag</label>
                    <select value={leadTag} onChange={(e) => setLeadTag(e.target.value as LeadTag)} className="h-10 w-full rounded-lg border border-[#C4C3D0] px-3 text-sm">
                      <option value="awaiting_documents">Awaiting Documents</option>
                      <option value="documents_submitted">Documents Submitted</option>
                      <option value="ready_for_screening">Ready for Screening</option>
                      <option value="incomplete">Incomplete</option>
                    </select>
                  </div>
                )}
              </div>
              {canRoute && (
                <div className="rounded-lg border border-[#E4E1EC] bg-[#F7F4FA] p-3 space-y-3">
                  <h3 className="text-sm font-semibold text-[#4A0000]">Routing</h3>
                  <select value={passToVerification} onChange={(e) => setPassToVerification(e.target.value as YesNo)} className="h-10 w-full rounded-lg border border-[#C4C3D0] px-3 text-sm">
                    <option value="no">Keep in Marketing</option>
                    <option value="yes">{getRoutingLabel('TEACHER')}</option>
                  </select>
                  <textarea value={handoffNote} onChange={(e) => setHandoffNote(e.target.value)} rows={3} placeholder="Required handoff note for HR" className="w-full rounded-lg border border-[#C4C3D0] p-3 text-sm" />
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-3 rounded-lg border border-[#E4E1EC] bg-[#F7F4FA] p-3">
                <input value={curriculumFamiliarity} onChange={(e) => setCurriculumFamiliarity(e.target.value)} placeholder="Curriculum familiarity" className="h-10 rounded-lg border border-[#C4C3D0] px-3 text-sm" />
                <input value={waecNecoExperience} onChange={(e) => setWaecNecoExperience(e.target.value)} placeholder="WAEC/NECO experience" className="h-10 rounded-lg border border-[#C4C3D0] px-3 text-sm" />
                <input value={availabilityBlocks} onChange={(e) => setAvailabilityBlocks(e.target.value)} placeholder="Availability blocks" className="h-10 rounded-lg border border-[#C4C3D0] px-3 text-sm" />
                <select value={cvProvided} onChange={(e) => setCvProvided(e.target.value as YesNo)} className="h-10 rounded-lg border border-[#C4C3D0] px-3 text-sm"><option value="no">CV No</option><option value="yes">CV Yes</option></select>
                <select value={validIdProvided} onChange={(e) => setValidIdProvided(e.target.value as YesNo)} className="h-10 rounded-lg border border-[#C4C3D0] px-3 text-sm"><option value="no">ID No</option><option value="yes">ID Yes</option></select>
                <select value={qualificationProvided} onChange={(e) => setQualificationProvided(e.target.value as YesNo)} className="h-10 rounded-lg border border-[#C4C3D0] px-3 text-sm"><option value="no">Qualification No</option><option value="yes">Qualification Yes</option></select>
                <select value={backgroundConsent} onChange={(e) => setBackgroundConsent(e.target.value as YesNo)} className="h-10 rounded-lg border border-[#C4C3D0] px-3 text-sm"><option value="no">Background Consent No</option><option value="yes">Background Consent Yes</option></select>
                <select value={dataConsent} onChange={(e) => setDataConsent(e.target.value as YesNo)} className="h-10 rounded-lg border border-[#C4C3D0] px-3 text-sm"><option value="no">Data Consent No</option><option value="yes">Data Consent Yes</option></select>
              </div>
              <div className="rounded-lg border border-[#E4E1EC] bg-[#F7F4FA] p-3 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <input type="date" value={callDate} onChange={(e) => setCallDate(e.target.value)} className="h-10 rounded-lg border border-[#C4C3D0] px-3 text-sm" />
                  <input type="time" value={callTime} onChange={(e) => setCallTime(e.target.value)} className="h-10 rounded-lg border border-[#C4C3D0] px-3 text-sm" />
                  <select value={contactMethod} onChange={(e) => setContactMethod(e.target.value as ContactMethod)} className="h-10 rounded-lg border border-[#C4C3D0] px-3 text-sm"><option value="whatsapp">WhatsApp</option><option value="call">Call</option></select>
                  <input type="date" value={nextActionDate} onChange={(e) => setNextActionDate(e.target.value)} className="h-10 rounded-lg border border-[#C4C3D0] px-3 text-sm" />
                </div>
                <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={4} placeholder="Summary (minimum 20 characters)" className="w-full rounded-lg border border-[#C4C3D0] p-3 text-sm" />
                <input value={nextActionNote} onChange={(e) => setNextActionNote(e.target.value)} placeholder="Next action note" className="h-10 w-full rounded-lg border border-[#C4C3D0] px-3 text-sm" />
              </div>
              <button onClick={saveFollowUp} disabled={saving} className="w-full rounded-lg bg-[#4A0000] px-4 py-2 text-sm font-semibold text-white hover:bg-[#630000] disabled:opacity-60">{saving ? 'Saving...' : passToVerification === 'yes' ? 'Save and Route to HR' : 'Save Follow-up'}</button>
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
                  <p>Current status: {formatLeadStatus(nextStatus)}</p>
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

'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { addDoc, collection, doc, getDoc, serverTimestamp } from 'firebase/firestore'
import { getDb } from '@/lib/firebase'

type ContactMethod = 'whatsapp' | 'call' | 'email'
type RequestStatus = 'new' | 'contacted' | 'matching_in_progress' | 'matched' | 'closed'

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

export default function RequestFollowUpPage() {
  const params = useParams<{ docId: string }>()
  const searchParams = useSearchParams()
  const docId = params.docId
  const collectionName = searchParams.get('collection') || 'parent_requests'

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [lead, setLead] = useState<Record<string, unknown> | null>(null)

  const [assignedTo, setAssignedTo] = useState('')
  const [status, setStatus] = useState<RequestStatus>('new')
  const [contactMethod, setContactMethod] = useState<ContactMethod>('whatsapp')
  const [contactDate, setContactDate] = useState('')
  const [contactTime, setContactTime] = useState('')
  const [parentGoal, setParentGoal] = useState('')
  const [budgetRange, setBudgetRange] = useState('')
  const [preferredStartDate, setPreferredStartDate] = useState('')
  const [summary, setSummary] = useState('')
  const [nextActionDate, setNextActionDate] = useState('')
  const [nextActionNote, setNextActionNote] = useState('')

  useEffect(() => {
    let mounted = true

    async function load() {
      setLoading(true)
      setError('')
      try {
        const snap = await getDoc(doc(getDb(), collectionName, docId))
        if (!snap.exists()) {
          if (mounted) setError('Parent request record not found.')
        } else if (mounted) {
          setLead(snap.data())
        }
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : 'Failed loading record.')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [collectionName, docId])

  const edunityId = useMemo(() => {
    if (!lead) return docId
    const value = lead.edunityId ?? lead.edunity_id
    if (typeof value === 'string' && value.trim()) return value.trim()
    return docId
  }, [lead, docId])

  async function saveFollowUp() {
    setSaving(true)
    setError('')
    setOk('')
    try {
      if (!assignedTo.trim()) throw new Error('Assign a staff owner first.')
      if (!contactDate || !contactTime) throw new Error('Contact date and time are required.')
      if (summary.trim().length < 20) throw new Error('Summary should be at least 20 characters.')

      await addDoc(collection(getDb(), 'parent_request_follow_ups'), {
        sourceCollection: collectionName,
        sourceDocId: docId,
        edunityId,
        assignedTo: assignedTo.trim(),
        status,
        outreach: {
          method: contactMethod,
          date: contactDate,
          time: contactTime,
        },
        discovery: {
          parentGoal: parentGoal || null,
          budgetRange: budgetRange || null,
          preferredStartDate: preferredStartDate || null,
        },
        summary: summary.trim(),
        nextAction: {
          date: nextActionDate || null,
          note: nextActionNote || null,
        },
        createdAt: serverTimestamp(),
      })

      setOk('Request follow-up saved successfully.')
      setSummary('')
      setNextActionNote('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save follow-up.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F2EFF5] p-4 sm:p-6 lg:p-10">
      <div className="mx-auto max-w-6xl space-y-4">
        <Link href="/dashboard" className="inline-flex rounded-lg border border-[#C4C3D0] bg-white px-3 py-2 text-sm font-semibold text-[#4A0000]">
          Back to Dashboard
        </Link>

        <div className="rounded-2xl border border-[#C4C3D0] bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-[#4A0000]">Parent Request ID: {edunityId}</p>
        </div>

        {loading && <div className="rounded-2xl border border-[#C4C3D0] bg-white p-4 text-sm text-[#4A0000]/70">Loading record...</div>}
        {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        {ok && <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">{ok}</div>}

        {lead && (
          <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
            <div className="space-y-4 rounded-2xl border border-[#C4C3D0] bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-[#4A0000]">Parent Request Follow-up Form</h2>

              <div>
                <label className="mb-1 block text-sm font-medium text-[#4A0000]">Assign Staff Owner</label>
                <input value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} placeholder="Staff name or email" className="h-10 w-full rounded-lg border border-[#C4C3D0] px-3 text-sm" />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-[#4A0000]">Request Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value as RequestStatus)} className="h-10 w-full rounded-lg border border-[#C4C3D0] px-3 text-sm">
                  <option value="new">New</option>
                  <option value="contacted">Contacted</option>
                  <option value="matching_in_progress">Matching In Progress</option>
                  <option value="matched">Matched</option>
                  <option value="closed">Closed</option>
                </select>
              </div>

              <div className="rounded-lg border border-[#E4E1EC] bg-[#F7F4FA] p-3 space-y-3">
                <h3 className="text-sm font-semibold text-[#4A0000]">Contact Log</h3>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#4A0000]">Method</label>
                    <select value={contactMethod} onChange={(e) => setContactMethod(e.target.value as ContactMethod)} className="h-9 w-full rounded-lg border border-[#C4C3D0] px-2 text-xs">
                      <option value="whatsapp">WhatsApp</option>
                      <option value="call">Call</option>
                      <option value="email">Email</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#4A0000]">Date</label>
                    <input type="date" value={contactDate} onChange={(e) => setContactDate(e.target.value)} className="h-9 w-full rounded-lg border border-[#C4C3D0] px-2 text-xs" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#4A0000]">Time</label>
                    <input type="time" value={contactTime} onChange={(e) => setContactTime(e.target.value)} className="h-9 w-full rounded-lg border border-[#C4C3D0] px-2 text-xs" />
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-[#E4E1EC] bg-[#F7F4FA] p-3 space-y-3">
                <h3 className="text-sm font-semibold text-[#4A0000]">Parent Requirement Details</h3>
                <input value={parentGoal} onChange={(e) => setParentGoal(e.target.value)} placeholder="Learning goal / challenge" className="h-10 w-full rounded-lg border border-[#C4C3D0] px-3 text-sm" />
                <input value={budgetRange} onChange={(e) => setBudgetRange(e.target.value)} placeholder="Budget range (optional)" className="h-10 w-full rounded-lg border border-[#C4C3D0] px-3 text-sm" />
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#4A0000]">Preferred start date</label>
                  <input type="date" value={preferredStartDate} onChange={(e) => setPreferredStartDate(e.target.value)} className="h-9 w-full rounded-lg border border-[#C4C3D0] px-2 text-xs" />
                </div>
              </div>

              <div className="rounded-lg border border-[#E4E1EC] bg-[#F7F4FA] p-3 space-y-3">
                <h3 className="text-sm font-semibold text-[#4A0000]">Summary and Next Action</h3>
                <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={4} placeholder="Call summary (minimum 20 characters)" className="w-full rounded-lg border border-[#C4C3D0] p-3 text-sm" />
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#4A0000]">Next action date</label>
                  <input type="date" value={nextActionDate} onChange={(e) => setNextActionDate(e.target.value)} className="h-9 w-full rounded-lg border border-[#C4C3D0] px-2 text-xs" />
                </div>
                <textarea value={nextActionNote} onChange={(e) => setNextActionNote(e.target.value)} rows={2} placeholder="Next action note" className="w-full rounded-lg border border-[#C4C3D0] p-3 text-sm" />
              </div>

              <button onClick={saveFollowUp} disabled={saving} className="w-full rounded-lg bg-[#4A0000] px-4 py-2 text-sm font-semibold text-white hover:bg-[#630000] disabled:opacity-60">
                {saving ? 'Saving...' : 'Save Request Follow-up'}
              </button>
            </div>

            <div className="rounded-2xl border border-[#C4C3D0] bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-[#4A0000]">All Parent Request Fields</h2>
              <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                {Object.entries(lead).map(([key, value]) => (
                  <div key={key} className="rounded border border-[#E4E1EC] bg-[#F7F4FA] p-2">
                    <p className="font-semibold text-[#4A0000]">{key}</p>
                    <p className="mt-1 break-words text-[#4A0000]/80">{formatValue(value)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

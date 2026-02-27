'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { addDoc, collection, doc, getDoc, serverTimestamp } from 'firebase/firestore'
import { getDb } from '@/lib/firebase'

type YesNo = 'yes' | 'no'
type LeadTag = 'awaiting_documents' | 'documents_submitted' | 'ready_for_screening' | 'incomplete'
type ContactMethod = 'whatsapp' | 'call'
type LeadTone = 'serious' | 'browsing' | 'urgent'

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

function toDate(value: unknown): Date | null {
  if (!value) return null
  if (typeof (value as { toDate?: () => Date }).toDate === 'function') return (value as { toDate: () => Date }).toDate()
  if (value instanceof Date) return value
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

export default function FollowUpPage() {
  const params = useParams<{ docId: string }>()
  const searchParams = useSearchParams()
  const docId = params.docId
  const collectionName = searchParams.get('collection') || 'teacher_interests'

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [lead, setLead] = useState<Record<string, unknown> | null>(null)

  const [assignedTo, setAssignedTo] = useState('')
  const [leadTag, setLeadTag] = useState<LeadTag>('awaiting_documents')

  const [confirmFullName, setConfirmFullName] = useState<YesNo>('yes')
  const [confirmSubjects, setConfirmSubjects] = useState<YesNo>('yes')
  const [confirmClassesTaught, setConfirmClassesTaught] = useState<YesNo>('yes')
  const [confirmLocation, setConfirmLocation] = useState<YesNo>('yes')
  const [confirmLessonType, setConfirmLessonType] = useState<YesNo>('yes')
  const [confirmYearsExperience, setConfirmYearsExperience] = useState<YesNo>('yes')

  const [curriculumFamiliarity, setCurriculumFamiliarity] = useState('')
  const [waecNecoExperience, setWaecNecoExperience] = useState('')
  const [finalYearPrepExperience, setFinalYearPrepExperience] = useState('')
  const [availabilityBlocks, setAvailabilityBlocks] = useState('')

  const [cvProvided, setCvProvided] = useState<YesNo>('no')
  const [validIdProvided, setValidIdProvided] = useState<YesNo>('no')
  const [highestQualificationProvided, setHighestQualificationProvided] = useState<YesNo>('no')
  const [nyscApplicable, setNyscApplicable] = useState<YesNo>('no')
  const [nyscProvided, setNyscProvided] = useState<YesNo>('no')
  const [referenceProvided, setReferenceProvided] = useState<YesNo>('no')
  const [teachingVideoProvided, setTeachingVideoProvided] = useState<YesNo>('no')
  const [resultSampleProvided, setResultSampleProvided] = useState<YesNo>('no')

  const [backgroundCheckConsent, setBackgroundCheckConsent] = useState<YesNo>('no')
  const [safeguardingAck, setSafeguardingAck] = useState<YesNo>('no')
  const [dataProcessingConsent, setDataProcessingConsent] = useState<YesNo>('no')

  const [callDate, setCallDate] = useState('')
  const [callTime, setCallTime] = useState('')
  const [contactMethod, setContactMethod] = useState<ContactMethod>('whatsapp')
  const [summary, setSummary] = useState('')
  const [leadTone, setLeadTone] = useState<LeadTone>('serious')
  const [objections, setObjections] = useState('')
  const [requestedFollowUpDate, setRequestedFollowUpDate] = useState('')

  const [passToVerification, setPassToVerification] = useState<YesNo>('no')
  const [handoffNote, setHandoffNote] = useState('')

  useEffect(() => {
    let mounted = true

    async function load() {
      setLoading(true)
      setError('')
      try {
        const snap = await getDoc(doc(getDb(), collectionName, docId))
        if (!snap.exists()) {
          if (mounted) setError('Teacher record not found.')
        } else if (mounted) {
          const data = snap.data()
          setLead(data)
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

  const timelineHint = useMemo(() => {
    if (!lead) return 'Day 0 - Thank you + document request'
    const createdAt =
      toDate(lead.createdAt) ??
      toDate(lead.created_at) ??
      toDate(lead.submittedAt) ??
      toDate(lead.timestamp)

    if (!createdAt) return 'Day 0 - Thank you + document request'

    const days = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24))
    if (days >= 10) return 'Day 10 - Archive as Incomplete'
    if (days >= 5) return 'Day 5 - Final reminder'
    if (days >= 2) return 'Day 2 - Reminder'
    return 'Day 0 - Thank you + document request'
  }, [lead])

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
      if (!assignedTo.trim()) throw new Error('Assign this teacher to a staff member first.')
      if (!callDate || !callTime) throw new Error('Call log date and time are required.')
      if (summary.trim().length < 20) throw new Error('Summary should be at least 20 characters.')

      const requiredDocsReady =
        cvProvided === 'yes' &&
        validIdProvided === 'yes' &&
        highestQualificationProvided === 'yes' &&
        (nyscApplicable === 'no' || nyscProvided === 'yes')

      if (leadTag === 'ready_for_screening' && !requiredDocsReady) {
        throw new Error('Cannot tag Ready for Screening until required documents are submitted.')
      }

      if (passToVerification === 'yes') {
        if (leadTag !== 'ready_for_screening') {
          throw new Error('Set tag to Ready for Screening before passing to Verification Team.')
        }
        if (
          backgroundCheckConsent !== 'yes' ||
          safeguardingAck !== 'yes' ||
          dataProcessingConsent !== 'yes'
        ) {
          throw new Error('All consent and compliance fields must be Yes before handoff.')
        }
      }

      await addDoc(collection(getDb(), 'teacher_follow_ups'), {
        sourceCollection: collectionName,
        sourceDocId: docId,
        workflowModel: 'interest_structure_documentation_verification',
        assignedTo: assignedTo.trim(),
        leadTag,
        firstResponse: {
          fullNameConfirmed: confirmFullName === 'yes',
          subjectsConfirmed: confirmSubjects === 'yes',
          classesTaughtConfirmed: confirmClassesTaught === 'yes',
          locationConfirmed: confirmLocation === 'yes',
          lessonTypeConfirmed: confirmLessonType === 'yes',
          yearsExperienceConfirmed: confirmYearsExperience === 'yes',
        },
        surfaceQualification: {
          curriculumFamiliarity,
          waecNecoExperience,
          finalYearPrepExperience,
          availabilityBlocks,
          note: 'Surface-level only. No competence judgment by marketing.',
        },
        documentation: {
          required: {
            cvPdf: cvProvided === 'yes',
            validId: validIdProvided === 'yes',
            highestQualificationCertificate: highestQualificationProvided === 'yes',
            nyscApplicable: nyscApplicable === 'yes',
            nyscCertificate: nyscProvided === 'yes',
          },
          optional: {
            referenceContact: referenceProvided === 'yes',
            teachingSampleVideo: teachingVideoProvided === 'yes',
            resultSample: resultSampleProvided === 'yes',
          },
        },
        compliance: {
          backgroundCheckConsent: backgroundCheckConsent === 'yes',
          safeguardingAcknowledgement: safeguardingAck === 'yes',
          dataProcessingConsent: dataProcessingConsent === 'yes',
        },
        timelineSystem: {
          suggestedStepNow: timelineHint,
          model: ['Day 0 thank you + doc request', 'Day 2 reminder', 'Day 5 final reminder', 'Day 10 archive'],
        },
        internalCallLog: {
          date: callDate,
          time: callTime,
          method: contactMethod,
          summary,
          leadTone,
          objections,
          requestedFollowUpDate: requestedFollowUpDate || null,
        },
        handoff: {
          passToVerificationTeam: passToVerification === 'yes',
          handoffNote: handoffNote || null,
          destinationTeam: passToVerification === 'yes' ? 'Academic Screening Team' : null,
        },
        createdAt: serverTimestamp(),
      })

      setOk('Follow-up saved successfully.')
      setSummary('')
      setObjections('')
      setHandoffNote('')
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
          <p className="text-sm font-semibold text-[#4A0000]">Edunity ID: {edunityId}</p>
        </div>

        {loading && <div className="rounded-2xl border border-[#C4C3D0] bg-white p-4 text-sm text-[#4A0000]/70">Loading record...</div>}
        {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        {ok && <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">{ok}</div>}

        {lead && (
          <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
            <div className="space-y-4 rounded-2xl border border-[#C4C3D0] bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-[#4A0000]">Workflow Form</h2>

              <div>
                <label className="mb-1 block text-sm font-medium text-[#4A0000]">Assign Staff Owner</label>
                <input value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} placeholder="Staff name or email" className="h-10 w-full rounded-lg border border-[#C4C3D0] px-3 text-sm" />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-[#4A0000]">Internal Tag</label>
                <select value={leadTag} onChange={(e) => setLeadTag(e.target.value as LeadTag)} className="h-10 w-full rounded-lg border border-[#C4C3D0] px-3 text-sm">
                  <option value="awaiting_documents">Awaiting Documents</option>
                  <option value="documents_submitted">Documents Submitted</option>
                  <option value="ready_for_screening">Ready for Screening</option>
                  <option value="incomplete">Incomplete</option>
                </select>
              </div>

              <div className="rounded-lg border border-[#E4E1EC] bg-[#F7F4FA] p-3 space-y-3">
                <h3 className="text-sm font-semibold text-[#4A0000]">First Response Confirmation</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[['Full name', confirmFullName, setConfirmFullName], ['Subjects', confirmSubjects, setConfirmSubjects], ['Classes taught', confirmClassesTaught, setConfirmClassesTaught], ['State/LGA', confirmLocation, setConfirmLocation], ['Lesson type', confirmLessonType, setConfirmLessonType], ['Years of experience', confirmYearsExperience, setConfirmYearsExperience]].map(([label, value, setter]) => (
                    <div key={String(label)}>
                      <label className="mb-1 block text-xs font-medium text-[#4A0000]">{String(label)}</label>
                      <select value={String(value)} onChange={(e) => (setter as (v: YesNo) => void)(e.target.value as YesNo)} className="h-9 w-full rounded-lg border border-[#C4C3D0] px-2 text-xs">
                        <option value="yes">Confirmed</option>
                        <option value="no">Not confirmed</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-[#E4E1EC] bg-[#F7F4FA] p-3 space-y-3">
                <h3 className="text-sm font-semibold text-[#4A0000]">Surface-level Qualification Questions</h3>
                <p className="text-xs text-[#4A0000]/70">Ask only. Do not judge competence.</p>
                <input value={curriculumFamiliarity} onChange={(e) => setCurriculumFamiliarity(e.target.value)} placeholder="Curriculum familiarity" className="h-10 w-full rounded-lg border border-[#C4C3D0] px-3 text-sm" />
                <input value={waecNecoExperience} onChange={(e) => setWaecNecoExperience(e.target.value)} placeholder="WAEC/NECO experience" className="h-10 w-full rounded-lg border border-[#C4C3D0] px-3 text-sm" />
                <input value={finalYearPrepExperience} onChange={(e) => setFinalYearPrepExperience(e.target.value)} placeholder="Final-year prep experience" className="h-10 w-full rounded-lg border border-[#C4C3D0] px-3 text-sm" />
                <input value={availabilityBlocks} onChange={(e) => setAvailabilityBlocks(e.target.value)} placeholder="Availability: days and time blocks" className="h-10 w-full rounded-lg border border-[#C4C3D0] px-3 text-sm" />
              </div>

              <div className="rounded-lg border border-[#E4E1EC] bg-[#F7F4FA] p-3 space-y-3">
                <h3 className="text-sm font-semibold text-[#4A0000]">Documentation Request</h3>
                <p className="text-xs text-[#4A0000]/70">Marketing collects documents only. No validation.</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[['CV (PDF)', cvProvided, setCvProvided], ['Valid ID', validIdProvided, setValidIdProvided], ['Highest qualification certificate', highestQualificationProvided, setHighestQualificationProvided], ['NYSC applicable', nyscApplicable, setNyscApplicable], ['NYSC certificate', nyscProvided, setNyscProvided], ['Reference contact (optional)', referenceProvided, setReferenceProvided], ['Teaching sample video (optional)', teachingVideoProvided, setTeachingVideoProvided], ['Past result sample (optional)', resultSampleProvided, setResultSampleProvided]].map(([label, value, setter]) => (
                    <div key={String(label)}>
                      <label className="mb-1 block text-xs font-medium text-[#4A0000]">{String(label)}</label>
                      <select value={String(value)} onChange={(e) => (setter as (v: YesNo) => void)(e.target.value as YesNo)} className="h-9 w-full rounded-lg border border-[#C4C3D0] px-2 text-xs">
                        <option value="no">No</option>
                        <option value="yes">Yes</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-[#E4E1EC] bg-[#F7F4FA] p-3 space-y-3">
                <h3 className="text-sm font-semibold text-[#4A0000]">Consent and Compliance</h3>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[['Background check consent', backgroundCheckConsent, setBackgroundCheckConsent], ['Safeguarding policy acknowledgment', safeguardingAck, setSafeguardingAck], ['Data processing consent', dataProcessingConsent, setDataProcessingConsent]].map(([label, value, setter]) => (
                    <div key={String(label)}>
                      <label className="mb-1 block text-xs font-medium text-[#4A0000]">{String(label)}</label>
                      <select value={String(value)} onChange={(e) => (setter as (v: YesNo) => void)(e.target.value as YesNo)} className="h-9 w-full rounded-lg border border-[#C4C3D0] px-2 text-xs">
                        <option value="no">No</option>
                        <option value="yes">Yes</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-[#E4E1EC] bg-[#F7F4FA] p-3 space-y-3">
                <h3 className="text-sm font-semibold text-[#4A0000]">Internal Call Log</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#4A0000]">Date</label>
                    <input type="date" value={callDate} onChange={(e) => setCallDate(e.target.value)} className="h-9 w-full rounded-lg border border-[#C4C3D0] px-2 text-xs" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#4A0000]">Time</label>
                    <input type="time" value={callTime} onChange={(e) => setCallTime(e.target.value)} className="h-9 w-full rounded-lg border border-[#C4C3D0] px-2 text-xs" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#4A0000]">Method</label>
                    <select value={contactMethod} onChange={(e) => setContactMethod(e.target.value as ContactMethod)} className="h-9 w-full rounded-lg border border-[#C4C3D0] px-2 text-xs">
                      <option value="whatsapp">WhatsApp</option>
                      <option value="call">Call</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#4A0000]">Lead Tone</label>
                    <select value={leadTone} onChange={(e) => setLeadTone(e.target.value as LeadTone)} className="h-9 w-full rounded-lg border border-[#C4C3D0] px-2 text-xs">
                      <option value="serious">Serious</option>
                      <option value="browsing">Browsing</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                </div>
                <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={4} placeholder="Summary (3-5 lines)" className="w-full rounded-lg border border-[#C4C3D0] p-3 text-sm" />
                <textarea value={objections} onChange={(e) => setObjections(e.target.value)} rows={2} placeholder="Objections raised" className="w-full rounded-lg border border-[#C4C3D0] p-3 text-sm" />
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#4A0000]">Requested follow-up date</label>
                  <input type="date" value={requestedFollowUpDate} onChange={(e) => setRequestedFollowUpDate(e.target.value)} className="h-9 w-full rounded-lg border border-[#C4C3D0] px-2 text-xs" />
                </div>
              </div>

              <div className="rounded-lg border border-[#E4E1EC] bg-[#F7F4FA] p-3 space-y-3">
                <h3 className="text-sm font-semibold text-[#4A0000]">Pass to Verification Team</h3>
                <select value={passToVerification} onChange={(e) => setPassToVerification(e.target.value as YesNo)} className="h-10 w-full rounded-lg border border-[#C4C3D0] px-3 text-sm">
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
                <textarea value={handoffNote} onChange={(e) => setHandoffNote(e.target.value)} rows={3} placeholder="Handoff note for Academic Screening Team" className="w-full rounded-lg border border-[#C4C3D0] p-3 text-sm" />
              </div>

              <button onClick={saveFollowUp} disabled={saving} className="w-full rounded-lg bg-[#4A0000] px-4 py-2 text-sm font-semibold text-white hover:bg-[#630000] disabled:opacity-60">
                {saving ? 'Saving...' : 'Save Follow-up'}
              </button>
            </div>

            <div className="rounded-2xl border border-[#C4C3D0] bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-[#4A0000]">All Record Fields</h2>
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

'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { useAuth } from '@/lib/auth/auth-context'
import { useProtectedRoute } from '@/lib/auth/use-protected-route'
import {
  buildLeadAssignmentId,
  LEAD_ASSIGNMENTS_COLLECTION,
} from '@/lib/auth/lead-assignments'
import { getDb } from '@/lib/firebase'
import { TEACHER_LEADS_COLLECTION } from '@/lib/teacher-leads'
import {
  findTeacherLeadByEdunityId,
  getTeacherFollowUpDocumentProgress,
  normalizeEdunityId,
  OPTIONAL_DOCUMENT_KEYS,
  TEACHER_DOCUMENT_LABELS,
  TEACHER_FOLLOW_UP_DOCUMENTS_COLLECTION,
  TeacherDocumentKey,
  TeacherFollowUpDocumentRecord,
  TeacherLeadLookupResult,
} from '@/lib/teacher-follow-up-documents'

type AssignmentInfo = {
  assignedUserId: string
  assignedUserName: string
}

function decodeParam(value: string | string[] | undefined): string {
  if (!value) return ''
  return decodeURIComponent(Array.isArray(value) ? value[0] : value)
}

function statusLabel(status: TeacherFollowUpDocumentRecord['status']) {
  if (status === 'pushed_to_sales') return 'Pushed to Sales'
  if (status === 'complete') return 'Complete'
  if (status === 'partial') return 'Partially Complete'
  return 'Pending'
}

function yesNo(value: boolean): 'Yes' | 'No' {
  return value ? 'Yes' : 'No'
}

export default function TeacherDocumentReviewPage() {
  const params = useParams<{ edunityId: string }>()
  const { user } = useAuth()
  const { isLoading: authLoading, hasAccess } = useProtectedRoute(['admin', 'marketing_staff'])

  const rawParam = decodeParam(params.edunityId)
  const edunityId = useMemo(() => normalizeEdunityId(rawParam), [rawParam])

  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [salesNote, setSalesNote] = useState('')
  const [lead, setLead] = useState<TeacherLeadLookupResult | null>(null)
  const [assignment, setAssignment] = useState<AssignmentInfo>({
    assignedUserId: '',
    assignedUserName: '',
  })
  const [record, setRecord] = useState<TeacherFollowUpDocumentRecord | null>(null)

  useEffect(() => {
    if (!hasAccess || !user) return
    const currentUser = user
    let active = true

    async function load() {
      setLoading(true)
      setError('')
      setOk('')
      try {
        if (!edunityId) throw new Error('Missing Edunity ID.')

        const db = getDb()
        const foundLead = await findTeacherLeadByEdunityId(edunityId)
        if (!foundLead) throw new Error('Teacher record was not found.')

        const [assignmentSnap, recordSnap] = await Promise.all([
          getDoc(
            doc(
              db,
              LEAD_ASSIGNMENTS_COLLECTION,
              buildLeadAssignmentId(TEACHER_LEADS_COLLECTION, foundLead.id)
            )
          ),
          getDoc(doc(db, TEACHER_FOLLOW_UP_DOCUMENTS_COLLECTION, edunityId)),
        ])

        if (!active) return

        const assignmentData = assignmentSnap.exists()
          ? (assignmentSnap.data() as Partial<AssignmentInfo>)
          : null
        const assignmentInfo: AssignmentInfo = {
          assignedUserId:
            typeof assignmentData?.assignedUserId === 'string'
              ? assignmentData.assignedUserId
              : '',
          assignedUserName:
            typeof assignmentData?.assignedUserName === 'string'
              ? assignmentData.assignedUserName
              : '',
        }

        if (currentUser.role !== 'admin' && assignmentInfo.assignedUserId !== currentUser.id) {
          throw new Error('This teacher is not assigned to your account.')
        }

        const loadedRecord = recordSnap.exists()
          ? (recordSnap.data() as TeacherFollowUpDocumentRecord)
          : null

        setLead(foundLead)
        setAssignment(assignmentInfo)
        setRecord(loadedRecord)
        setSalesNote(
          typeof loadedRecord?.salesNote === 'string' ? loadedRecord.salesNote : ''
        )
      } catch (loadError) {
        if (!active) return
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Could not load teacher document details.'
        )
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()
    return () => {
      active = false
    }
  }, [edunityId, hasAccess, user])

  const progress = useMemo(() => getTeacherFollowUpDocumentProgress(record), [record])

  const requiredDocumentRows: Array<TeacherDocumentKey> = useMemo(() => {
    if (!record) return ['cvPdf', 'passportPhoto', 'validId', 'highestQualificationCertificate']
    const keys: TeacherDocumentKey[] = [
      'cvPdf',
      'passportPhoto',
      'validId',
      'highestQualificationCertificate',
    ]
    if (record.nyscApplicable) keys.push('nyscCertificate')
    return keys
  }, [record])

  const handlePushToSales = async () => {
    if (!user || !record) return

    setBusy(true)
    setError('')
    setOk('')
    try {
      const freshProgress = getTeacherFollowUpDocumentProgress(record)
      if (freshProgress.status === 'pushed_to_sales') {
        throw new Error('This record is already pushed to Sales.')
      }
      if (freshProgress.status !== 'complete') {
        throw new Error('Complete documentation and consent first before pushing to Sales.')
      }

      const nowIso = new Date().toISOString()
      await setDoc(
        doc(getDb(), TEACHER_FOLLOW_UP_DOCUMENTS_COLLECTION, edunityId),
        {
          status: 'pushed_to_sales',
          pushedToSalesAt: nowIso,
          pushedToSalesByUserId: user.id,
          pushedToSalesByName: user.name,
          salesNote: salesNote.trim() || null,
          updatedAt: serverTimestamp(),
          updatedAtIso: nowIso,
        },
        { merge: true }
      )

      setRecord((prev) =>
        prev
          ? {
              ...prev,
              status: 'pushed_to_sales',
              pushedToSalesAt: nowIso,
              pushedToSalesByUserId: user.id,
              pushedToSalesByName: user.name,
              salesNote: salesNote.trim() || null,
              updatedAt: nowIso,
              updatedAtIso: nowIso,
            }
          : prev
      )
      setOk('Teacher record has been pushed to Sales.')
    } catch (pushError) {
      setError(pushError instanceof Error ? pushError.message : 'Push to Sales failed.')
    } finally {
      setBusy(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F2EFF5] p-6">
        <div className="mx-auto max-w-5xl rounded-xl border border-[#C4C3D0] bg-white p-4 text-sm text-[#4A0000]/75">
          Checking authentication...
        </div>
      </div>
    )
  }

  if (!hasAccess || !user) return null

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F2EFF5] p-6">
        <div className="mx-auto max-w-5xl rounded-xl border border-[#C4C3D0] bg-white p-4 text-sm text-[#4A0000]/75">
          Loading document details...
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F2EFF5] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-4">
        <Link
          href="/dashboard"
          className="inline-flex rounded-lg border border-[#C4C3D0] bg-white px-3 py-2 text-sm font-semibold text-[#4A0000]"
        >
          Back to Dashboard
        </Link>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {ok && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            {ok}
          </div>
        )}

        <section className="rounded-2xl border border-[#C4C3D0] bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-[#4A0000]">Teacher Follow-up Documents</h1>
          <p className="mt-2 text-sm text-[#4A0000]/75">
            Edunity ID: <span className="font-semibold">{edunityId}</span>
          </p>
          {lead && (
            <p className="text-sm text-[#4A0000]/75">
              Teacher: <span className="font-semibold">{lead.fullName || 'Unknown'}</span>
            </p>
          )}
          <p className="text-sm text-[#4A0000]/75">
            Assigned follow-up:{' '}
            <span className="font-semibold">
              {assignment.assignedUserName || 'Unassigned'}
            </span>
          </p>
          <p className="text-sm text-[#4A0000]/75">
            Status: <span className="font-semibold">{statusLabel(progress.status)}</span>
          </p>
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
            <div className="rounded-lg border border-[#E4E1EC] bg-[#F7F4FA] p-2">
              Required uploads: {progress.requiredUploaded}/{progress.requiredTotal}
            </div>
            <div className="rounded-lg border border-[#E4E1EC] bg-[#F7F4FA] p-2">
              All consents yes: {yesNo(progress.consentsAllYes)}
            </div>
            <div className="rounded-lg border border-[#E4E1EC] bg-[#F7F4FA] p-2">
              Any upload: {yesNo(progress.hasAnyUpload)}
            </div>
          </div>
        </section>

        {record ? (
          <>
            <section className="rounded-2xl border border-[#C4C3D0] bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-[#4A0000]">Uploaded Documents</h2>
              <div className="mt-4 space-y-3">
                {[...requiredDocumentRows, ...OPTIONAL_DOCUMENT_KEYS].map((key) => {
                  const entry = record.documents?.[key]
                  const uploaded = Boolean(entry?.downloadUrl)
                  return (
                    <div
                      key={key}
                      className="flex flex-col gap-2 rounded-lg border border-[#E4E1EC] bg-[#F7F4FA] p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="text-sm font-semibold text-[#4A0000]">
                          {TEACHER_DOCUMENT_LABELS[key]}
                        </p>
                        <p className="text-xs text-[#4A0000]/70">
                          {uploaded ? 'Uploaded' : 'Not uploaded'}
                        </p>
                      </div>
                      {uploaded ? (
                        <a
                          href={entry?.downloadUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex rounded-lg border border-[#C4C3D0] bg-white px-3 py-2 text-xs font-semibold text-[#4A0000]"
                        >
                          Open File
                        </a>
                      ) : (
                        <span className="text-xs font-semibold text-[#4A0000]/70">Missing</span>
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="mt-4 rounded-lg border border-[#E4E1EC] bg-[#F7F4FA] p-3 text-sm text-[#4A0000]/80">
                <p>
                  NYSC applicable: <span className="font-semibold">{yesNo(record.nyscApplicable)}</span>
                </p>
                <p>
                  Reference contact:{' '}
                  <span className="font-semibold">
                    {record.referenceContact || 'Not provided'}
                  </span>
                </p>
              </div>
            </section>

            <section className="rounded-2xl border border-[#C4C3D0] bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-[#4A0000]">Consent and Compliance</h2>
              <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                <div className="rounded-lg border border-[#E4E1EC] bg-[#F7F4FA] p-3">
                  Background check consent:{' '}
                  <span className="font-semibold">
                    {yesNo(Boolean(record.consents?.backgroundCheckConsent))}
                  </span>
                </div>
                <div className="rounded-lg border border-[#E4E1EC] bg-[#F7F4FA] p-3">
                  Safeguarding acknowledgment:{' '}
                  <span className="font-semibold">
                    {yesNo(Boolean(record.consents?.safeguardingPolicyAcknowledgement))}
                  </span>
                </div>
                <div className="rounded-lg border border-[#E4E1EC] bg-[#F7F4FA] p-3">
                  Data processing consent:{' '}
                  <span className="font-semibold">
                    {yesNo(Boolean(record.consents?.dataProcessingConsent))}
                  </span>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-[#C4C3D0] bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-[#4A0000]">Push to Sales</h2>
              <p className="mt-1 text-sm text-[#4A0000]/75">
                Marketing does not validate documents. Once documentation and follow-up are complete, hand off to Sales.
              </p>

              <textarea
                value={salesNote}
                onChange={(event) => setSalesNote(event.target.value)}
                rows={3}
                placeholder="Internal note for Sales (optional)"
                className="mt-3 w-full rounded-lg border border-[#C4C3D0] p-3 text-sm"
              />

              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  onClick={handlePushToSales}
                  disabled={busy || progress.status === 'pushed_to_sales'}
                  className="rounded-lg bg-[#4A0000] px-4 py-2 text-sm font-semibold text-white hover:bg-[#630000] disabled:opacity-60"
                >
                  {busy ? 'Processing...' : 'Push to Sales'}
                </button>
                <Link
                  href={`/follow-up/upload?edunityId=${encodeURIComponent(edunityId)}`}
                  className="rounded-lg border border-[#C4C3D0] bg-white px-4 py-2 text-sm font-semibold text-[#4A0000]"
                >
                  Open Teacher Upload Page
                </Link>
              </div>

              {record.pushedToSalesAt && (
                <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3 text-xs text-green-800">
                  Pushed to Sales on {record.pushedToSalesAt}
                  {record.pushedToSalesByName ? ` by ${record.pushedToSalesByName}` : ''}.
                </div>
              )}
            </section>
          </>
        ) : (
          <section className="rounded-2xl border border-[#C4C3D0] bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-[#4A0000]">No Uploads Yet</h2>
            <p className="mt-1 text-sm text-[#4A0000]/75">
              This teacher has not submitted follow-up documents yet.
            </p>
            <Link
              href={`/follow-up/upload?edunityId=${encodeURIComponent(edunityId)}`}
              className="mt-3 inline-flex rounded-lg bg-[#4A0000] px-4 py-2 text-sm font-semibold text-white"
            >
              Open Teacher Upload Page
            </Link>
          </section>
        )}
      </div>
    </div>
  )
}

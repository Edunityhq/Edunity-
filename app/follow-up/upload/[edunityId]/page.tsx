'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { getDb, getFirebaseStorage } from '@/lib/firebase'
import {
  buildLeadAssignmentId,
  LEAD_ASSIGNMENTS_COLLECTION,
} from '@/lib/auth/lead-assignments'
import { TEACHER_LEADS_COLLECTION } from '@/lib/teacher-leads'
import {
  buildTeacherDocumentStoragePath,
  findTeacherLeadByEdunityId,
  getRequiredDocumentKeys,
  getTeacherFollowUpDocumentProgress,
  normalizeEdunityId,
  TEACHER_DOCUMENT_LABELS,
  TEACHER_FOLLOW_UP_DOCUMENTS_COLLECTION,
  TeacherDocumentConsents,
  TeacherDocumentKey,
  TeacherFollowUpDocumentRecord,
  TeacherLeadLookupResult,
  UploadedTeacherDocument,
} from '@/lib/teacher-follow-up-documents'
import {
  clearTeacherPortalSession,
  readTeacherPortalSession,
} from '@/lib/teacher-portal-session'

type AssignmentInfo = {
  assignedUserId: string
  assignedUserName: string
}

type PendingFileMap = Partial<Record<TeacherDocumentKey, File>>

const DOCUMENT_ACCEPTS: Record<TeacherDocumentKey, string> = {
  cvPdf: '.pdf,application/pdf',
  passportPhoto: '.jpg,.jpeg,.png',
  validId: '.pdf,.jpg,.jpeg,.png',
  highestQualificationCertificate: '.pdf,.jpg,.jpeg,.png',
  nyscCertificate: '.pdf,.jpg,.jpeg,.png',
  trcnCertificate: '.pdf,.jpg,.jpeg,.png',
  otherSupportingDocument: '.pdf,.jpg,.jpeg,.png',
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

function getExistingRecordDocument(
  record: Partial<TeacherFollowUpDocumentRecord> | null,
  key: TeacherDocumentKey
) {
  const entry = record?.documents?.[key]
  if (!entry || !entry.downloadUrl) return null
  return entry
}

export default function TeacherDocumentUploadPage() {
  const router = useRouter()
  const params = useParams<{ edunityId: string }>()
  const rawParam = decodeParam(params.edunityId)
  const edunityId = useMemo(() => normalizeEdunityId(rawParam), [rawParam])

  const [authChecked, setAuthChecked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [portalTeacherName, setPortalTeacherName] = useState('')
  const [lead, setLead] = useState<TeacherLeadLookupResult | null>(null)
  const [record, setRecord] = useState<TeacherFollowUpDocumentRecord | null>(null)
  const [assignment, setAssignment] = useState<AssignmentInfo>({
    assignedUserId: '',
    assignedUserName: '',
  })
  const [pendingFiles, setPendingFiles] = useState<PendingFileMap>({})

  const [nyscApplicable, setNyscApplicable] = useState(false)
  const [referenceContact, setReferenceContact] = useState('')
  const [consents, setConsents] = useState<TeacherDocumentConsents>({
    backgroundCheckConsent: false,
    safeguardingPolicyAcknowledgement: false,
    dataProcessingConsent: false,
  })

  useEffect(() => {
    if (!edunityId) {
      setAuthChecked(true)
      return
    }

    const session = readTeacherPortalSession()
    if (!session || session.edunityId !== edunityId) {
      const nextPath = `/follow-up/upload/${encodeURIComponent(edunityId)}`
      router.replace(
        `/follow-up/upload?edunityId=${encodeURIComponent(
          edunityId
        )}&next=${encodeURIComponent(nextPath)}`
      )
      return
    }

    setPortalTeacherName(session.teacherName)
    setAuthChecked(true)
  }, [edunityId, router])

  useEffect(() => {
    if (!authChecked) return
    let active = true

    async function load() {
      setLoading(true)
      setError('')
      setOk('')

      try {
        if (!edunityId) throw new Error('Missing Edunity ID.')

        const db = getDb()
        const foundLead = await findTeacherLeadByEdunityId(edunityId)
        if (!foundLead) {
          throw new Error('No teacher record was found for this Edunity ID.')
        }

        const [recordSnap, assignmentSnap] = await Promise.all([
          getDoc(doc(db, TEACHER_FOLLOW_UP_DOCUMENTS_COLLECTION, edunityId)),
          getDoc(
            doc(
              db,
              LEAD_ASSIGNMENTS_COLLECTION,
              buildLeadAssignmentId(TEACHER_LEADS_COLLECTION, foundLead.id)
            )
          ),
        ])

        if (!active) return

        const existingRecord = recordSnap.exists()
          ? (recordSnap.data() as TeacherFollowUpDocumentRecord)
          : null

        const assignmentData = assignmentSnap.exists()
          ? (assignmentSnap.data() as Partial<AssignmentInfo>)
          : null

        setLead(foundLead)
        setRecord(existingRecord)
        setNyscApplicable(Boolean(existingRecord?.nyscApplicable))
        setReferenceContact(
          typeof existingRecord?.referenceContact === 'string'
            ? existingRecord.referenceContact
            : ''
        )
        setConsents({
          backgroundCheckConsent: Boolean(existingRecord?.consents?.backgroundCheckConsent),
          safeguardingPolicyAcknowledgement: Boolean(
            existingRecord?.consents?.safeguardingPolicyAcknowledgement
          ),
          dataProcessingConsent: Boolean(existingRecord?.consents?.dataProcessingConsent),
        })
        setAssignment({
          assignedUserId:
            typeof assignmentData?.assignedUserId === 'string'
              ? assignmentData.assignedUserId
              : typeof existingRecord?.assignedUserId === 'string'
                ? existingRecord.assignedUserId
                : '',
          assignedUserName:
            typeof assignmentData?.assignedUserName === 'string'
              ? assignmentData.assignedUserName
              : typeof existingRecord?.assignedUserName === 'string'
                ? existingRecord.assignedUserName
                : '',
        })
      } catch (loadError) {
        if (!active) return
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Could not load teacher document information.'
        )
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()
    return () => {
      active = false
    }
  }, [authChecked, edunityId])

  useEffect(() => {
    if (!nyscApplicable) {
      setPendingFiles((prev) => {
        if (!prev.nyscCertificate) return prev
        const next = { ...prev }
        delete next.nyscCertificate
        return next
      })
    }
  }, [nyscApplicable])

  const requiredKeys = useMemo(() => getRequiredDocumentKeys(nyscApplicable), [nyscApplicable])
  const hasAllConsents = useMemo(
    () =>
      consents.backgroundCheckConsent &&
      consents.safeguardingPolicyAcknowledgement &&
      consents.dataProcessingConsent,
    [consents]
  )

  const completionPreview = useMemo(() => {
    const draftDocuments: Partial<Record<TeacherDocumentKey, UploadedTeacherDocument>> = {
      ...(record?.documents ?? {}),
    }

    for (const [key] of Object.entries(pendingFiles) as Array<[TeacherDocumentKey, File]>) {
      draftDocuments[key] = {
        fileName: pendingFiles[key]?.name || `${key}-pending`,
        storagePath: '',
        downloadUrl: 'pending://local-file',
        contentType: pendingFiles[key]?.type || '',
        sizeBytes: pendingFiles[key]?.size || 0,
        uploadedAt: new Date().toISOString(),
      }
    }

    return getTeacherFollowUpDocumentProgress({
      ...record,
      nyscApplicable,
      consents,
      documents: draftDocuments,
    })
  }, [consents, nyscApplicable, pendingFiles, record])

  const isReferenceContactProvided = referenceContact.trim().length > 0
  const hasAllRequiredDocuments = completionPreview.missingRequiredKeys.length === 0
  const canSubmit =
    Boolean(lead) &&
    hasAllConsents &&
    isReferenceContactProvided &&
    hasAllRequiredDocuments &&
    !saving

  const setPendingFile = (key: TeacherDocumentKey, file: File | null) => {
    setPendingFiles((prev) => {
      const next = { ...prev }
      if (file) next[key] = file
      else delete next[key]
      return next
    })
  }

  const handleUpload = async () => {
    setSaving(true)
    setError('')
    setOk('')

    try {
      if (!lead) throw new Error('Teacher record is missing.')
      if (!hasAllConsents) {
        throw new Error(
          'All consent and compliance answers must be Yes before submitting.'
        )
      }
      if (!referenceContact.trim()) {
        throw new Error('Reference contact is required before submission.')
      }

      const cvFile = pendingFiles.cvPdf
      if (
        cvFile &&
        !cvFile.name.toLowerCase().endsWith('.pdf') &&
        cvFile.type !== 'application/pdf'
      ) {
        throw new Error('CV must be uploaded as a PDF file.')
      }

      const missingRequired = requiredKeys.filter((key) => {
        const hasExisting = Boolean(record?.documents?.[key]?.downloadUrl)
        const hasPending = Boolean(pendingFiles[key])
        return !hasExisting && !hasPending
      })
      if (missingRequired.length > 0) {
        throw new Error(
          `Missing required documents: ${missingRequired
            .map((key) => TEACHER_DOCUMENT_LABELS[key])
            .join(', ')}.`
        )
      }

      const uploaded: Partial<Record<TeacherDocumentKey, UploadedTeacherDocument>> = {}
      for (const [key, file] of Object.entries(pendingFiles) as Array<
        [TeacherDocumentKey, File]
      >) {
        if (!file) continue
        const storagePath = buildTeacherDocumentStoragePath(edunityId, key, file.name)
        const storageRef = ref(getFirebaseStorage(), storagePath)
        await uploadBytes(storageRef, file)
        const downloadUrl = await getDownloadURL(storageRef)
        uploaded[key] = {
          fileName: file.name,
          storagePath,
          downloadUrl,
          contentType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
          uploadedAt: new Date().toISOString(),
        }
      }

      const mergedDocuments: Partial<Record<TeacherDocumentKey, UploadedTeacherDocument>> = {
        ...(record?.documents ?? {}),
        ...uploaded,
      }

      const progress = getTeacherFollowUpDocumentProgress({
        ...record,
        nyscApplicable,
        consents,
        documents: mergedDocuments,
      })

      const status =
        record?.status === 'pushed_to_sales' ? 'pushed_to_sales' : progress.status
      const nowIso = new Date().toISOString()

      const nextLocalRecord: TeacherFollowUpDocumentRecord = {
        edunityId,
        leadDocId: lead.id,
        sourceCollection: TEACHER_LEADS_COLLECTION,
        teacherFullName: lead.fullName || record?.teacherFullName || '',
        teacherEmail: lead.email || record?.teacherEmail || '',
        teacherPhone: lead.phone || record?.teacherPhone || '',
        assignedUserId: assignment.assignedUserId || record?.assignedUserId || '',
        assignedUserName: assignment.assignedUserName || record?.assignedUserName || '',
        nyscApplicable,
        referenceContact: referenceContact.trim(),
        documents: mergedDocuments,
        consents,
        status,
        submittedAt: nowIso,
        createdAt: record?.createdAt ?? nowIso,
        updatedAt: nowIso,
        updatedAtIso: nowIso,
        pushedToSalesAt: record?.pushedToSalesAt ?? null,
        pushedToSalesByUserId: record?.pushedToSalesByUserId || '',
        pushedToSalesByName: record?.pushedToSalesByName || '',
        salesNote: record?.salesNote ?? null,
      }

      const payload: Record<string, unknown> = {
        edunityId: nextLocalRecord.edunityId,
        leadDocId: nextLocalRecord.leadDocId,
        sourceCollection: nextLocalRecord.sourceCollection,
        teacherFullName: nextLocalRecord.teacherFullName,
        teacherEmail: nextLocalRecord.teacherEmail,
        teacherPhone: nextLocalRecord.teacherPhone,
        assignedUserId: nextLocalRecord.assignedUserId,
        assignedUserName: nextLocalRecord.assignedUserName,
        nyscApplicable: nextLocalRecord.nyscApplicable,
        referenceContact: nextLocalRecord.referenceContact,
        documents: nextLocalRecord.documents,
        consents: nextLocalRecord.consents,
        status: nextLocalRecord.status,
        submittedAt: nextLocalRecord.submittedAt,
        updatedAt: serverTimestamp(),
        updatedAtIso: nowIso,
      }

      if (!record?.createdAt) payload.createdAt = serverTimestamp()

      await setDoc(doc(getDb(), TEACHER_FOLLOW_UP_DOCUMENTS_COLLECTION, edunityId), payload, {
        merge: true,
      })

      setRecord(nextLocalRecord)
      setPendingFiles({})
      setOk('Documents submitted successfully.')
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : 'Failed to submit documents.'
      )
    } finally {
      setSaving(false)
    }
  }

  const renderUploadRow = (
    key: TeacherDocumentKey,
    options?: { required?: boolean; hidden?: boolean }
  ) => {
    if (options?.hidden) return null

    const existing = getExistingRecordDocument(record, key)
    const staged = pendingFiles[key]

    return (
      <div key={key} className="rounded-lg border border-[#E4E1EC] bg-[#F7F4FA] p-4">
        <label className="block text-sm font-semibold text-[#4A0000]">
          {TEACHER_DOCUMENT_LABELS[key]}
          {options?.required ? (
            <span className="ml-1 text-red-600">*</span>
          ) : null}
        </label>
        <input
          type="file"
          accept={DOCUMENT_ACCEPTS[key]}
          onChange={(event) => setPendingFile(key, event.target.files?.[0] ?? null)}
          className="mt-2 block w-full text-sm text-[#4A0000]"
        />
        {staged && (
          <p className="mt-2 text-xs text-[#4A0000]/75">
            Selected: {staged.name}
          </p>
        )}
        {existing && (
          <p className="mt-2 text-xs text-[#4A0000]/75">
            Current file:{' '}
            <a
              href={existing.downloadUrl}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-[#4A0000] underline"
            >
              {existing.fileName || 'Open'}
            </a>
          </p>
        )}
      </div>
    )
  }

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-[#F6F1F8] p-6">
        <div className="mx-auto max-w-4xl rounded-xl border border-[#C4C3D0] bg-white p-4 text-sm text-[#4A0000]/75">
          Validating login...
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F6F1F8] p-6">
        <div className="mx-auto max-w-4xl rounded-xl border border-[#C4C3D0] bg-white p-4 text-sm text-[#4A0000]/75">
          Loading teacher document profile...
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F6F1F8] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/follow-up/upload"
            className="inline-flex rounded-lg border border-[#C4C3D0] bg-white px-3 py-2 text-sm font-semibold text-[#4A0000]"
          >
            Back
          </Link>
          <button
            onClick={() => {
              clearTeacherPortalSession()
              router.push(`/follow-up/upload?edunityId=${encodeURIComponent(edunityId)}`)
            }}
            className="rounded-lg border border-[#C4C3D0] bg-white px-3 py-2 text-xs font-semibold text-[#4A0000]"
          >
            Sign Out
          </button>
        </div>

        <section className="rounded-2xl border border-[#C4C3D0] bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-[#4A0000] sm:text-3xl">
            Teacher Document Upload
          </h1>
          <p className="mt-2 text-sm text-[#4A0000]/75">
            Edunity ID: <span className="font-semibold">{edunityId}</span>
          </p>
          {lead && (
            <p className="text-sm text-[#4A0000]/75">
              Teacher: <span className="font-semibold">{lead.fullName || 'Unknown'}</span>
            </p>
          )}
          {portalTeacherName && (
            <p className="text-sm text-[#4A0000]/75">
              Logged in as: <span className="font-semibold">{portalTeacherName}</span>
            </p>
          )}
          {assignment.assignedUserName && (
            <p className="text-sm text-[#4A0000]/75">
              Assigned follow-up staff:{' '}
              <span className="font-semibold">{assignment.assignedUserName}</span>
            </p>
          )}
          <p className="mt-2 text-sm text-[#4A0000]/75">
            Current status: <span className="font-semibold">{statusLabel(record?.status || 'pending')}</span>
          </p>
        </section>

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
          <h2 className="text-lg font-semibold text-[#4A0000]">Documentation Request</h2>
          <p className="mt-1 text-xs text-[#4A0000]/70">
            Upload clear and complete documents so your Edunity follow-up can be completed quickly.
          </p>

          <div className="mt-4 rounded-lg border border-[#E4E1EC] bg-[#F7F4FA] p-4">
            <label className="mb-1 block text-sm font-semibold text-[#4A0000]">
              NYSC Applicable <span className="text-red-600">*</span>
            </label>
            <select
              value={nyscApplicable ? 'yes' : 'no'}
              onChange={(event) => setNyscApplicable(event.target.value === 'yes')}
              className="h-10 w-full rounded-lg border border-[#C4C3D0] px-3 text-sm"
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {renderUploadRow('cvPdf', { required: true })}
            {renderUploadRow('passportPhoto', { required: true })}
            {renderUploadRow('validId', { required: true })}
            {renderUploadRow('highestQualificationCertificate', { required: true })}
            {renderUploadRow('nyscCertificate', {
              required: nyscApplicable,
              hidden: !nyscApplicable,
            })}
            {renderUploadRow('trcnCertificate')}
            {renderUploadRow('otherSupportingDocument')}
          </div>

          <div className="mt-4 rounded-lg border border-[#E4E1EC] bg-[#F7F4FA] p-4">
            <label className="mb-1 block text-sm font-semibold text-[#4A0000]">
              Reference Contact <span className="text-red-600">*</span>
            </label>
            <input
              value={referenceContact}
              onChange={(event) => setReferenceContact(event.target.value)}
              placeholder="Provide a reference name and phone/email"
              className="h-10 w-full rounded-lg border border-[#C4C3D0] px-3 text-sm"
            />
          </div>
        </section>

        <section className="rounded-2xl border border-[#C4C3D0] bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-[#4A0000]">Consent and Compliance</h2>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              ['backgroundCheckConsent', 'Background Check Consent'],
              ['safeguardingPolicyAcknowledgement', 'Safeguarding Policy Acknowledgment'],
              ['dataProcessingConsent', 'Data Processing Consent'],
            ].map(([key, label]) => {
              const consentKey = key as keyof TeacherDocumentConsents
              return (
                <div key={key} className="rounded-lg border border-[#E4E1EC] bg-[#F7F4FA] p-4">
                  <label className="mb-1 block text-sm font-semibold text-[#4A0000]">
                    {label} <span className="text-red-600">*</span>
                  </label>
                  <select
                    value={consents[consentKey] ? 'yes' : 'no'}
                    onChange={(event) =>
                      setConsents((prev) => ({
                        ...prev,
                        [consentKey]: event.target.value === 'yes',
                      }))
                    }
                    className="h-10 w-full rounded-lg border border-[#C4C3D0] px-3 text-sm"
                  >
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </div>
              )
            })}
          </div>
        </section>

        <button
          onClick={handleUpload}
          disabled={!canSubmit}
          className="w-full rounded-lg bg-[#4A0000] px-4 py-3 text-sm font-semibold text-white hover:bg-[#630000] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? 'Submitting...' : 'Submit Documents'}
        </button>
      </div>
    </div>
  )
}

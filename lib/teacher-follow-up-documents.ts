import { collection, doc, getDoc, getDocs, limit, query, where } from 'firebase/firestore'
import { getDb } from '@/lib/firebase'
import { TEACHER_LEADS_COLLECTION } from '@/lib/teacher-leads'

export const TEACHER_FOLLOW_UP_DOCUMENTS_COLLECTION = 'teacher_follow_up_documents'

export type TeacherRequiredDocumentKey =
  | 'cvPdf'
  | 'passportPhoto'
  | 'validId'
  | 'highestQualificationCertificate'
  | 'nyscCertificate'

export type TeacherOptionalDocumentKey =
  | 'trcnCertificate'
  | 'otherSupportingDocument'

export type TeacherDocumentKey = TeacherRequiredDocumentKey | TeacherOptionalDocumentKey

export type TeacherDocumentationStatus =
  | 'pending'
  | 'partial'
  | 'complete'
  | 'pushed_to_sales'

export interface UploadedTeacherDocument {
  fileName: string
  storagePath: string
  downloadUrl: string
  contentType: string
  sizeBytes: number
  uploadedAt: string
}

export interface TeacherDocumentConsents {
  backgroundCheckConsent: boolean
  safeguardingPolicyAcknowledgement: boolean
  dataProcessingConsent: boolean
}

export interface TeacherFollowUpDocumentRecord {
  edunityId: string
  leadDocId: string
  sourceCollection: string
  teacherFullName: string
  teacherEmail: string
  teacherPhone: string
  assignedUserId: string
  assignedUserName: string
  nyscApplicable: boolean
  referenceContact: string
  documents: Partial<Record<TeacherDocumentKey, UploadedTeacherDocument>>
  consents: TeacherDocumentConsents
  status: TeacherDocumentationStatus
  submittedAt?: string | null
  createdAt?: unknown
  updatedAt?: unknown
  updatedAtIso?: string
  pushedToSalesAt?: string | null
  pushedToSalesByUserId?: string
  pushedToSalesByName?: string
  salesNote?: string | null
}

export interface TeacherLeadLookupResult {
  id: string
  edunityId: string
  fullName: string
  email: string
  phone: string
  state: string
  lga: string
  area: string
  raw: Record<string, unknown>
}

export interface TeacherDocumentProgress {
  status: TeacherDocumentationStatus
  requiredUploaded: number
  requiredTotal: number
  missingRequiredKeys: TeacherRequiredDocumentKey[]
  consentsAllYes: boolean
  hasAnyUpload: boolean
}

export const TEACHER_DOCUMENT_LABELS: Record<TeacherDocumentKey, string> = {
  cvPdf: 'CV (PDF)',
  passportPhoto: 'Passport Photograph',
  validId: 'Valid ID',
  highestQualificationCertificate: 'Highest Qualification Certificate',
  nyscCertificate: 'NYSC Certificate',
  trcnCertificate: 'Teachers Registration Council of Nigeria (TRCN) Certificate',
  otherSupportingDocument: 'Other Supporting Document',
}

export const REQUIRED_DOCUMENT_KEYS_BASE: Array<Exclude<TeacherRequiredDocumentKey, 'nyscCertificate'>> = [
  'cvPdf',
  'passportPhoto',
  'validId',
  'highestQualificationCertificate',
]

export const OPTIONAL_DOCUMENT_KEYS: TeacherOptionalDocumentKey[] = [
  'trcnCertificate',
  'otherSupportingDocument',
]

function toStringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function normalizeEdunityId(value: string): string {
  return value.trim().toUpperCase()
}

export function getRequiredDocumentKeys(nyscApplicable: boolean): TeacherRequiredDocumentKey[] {
  if (nyscApplicable) return [...REQUIRED_DOCUMENT_KEYS_BASE, 'nyscCertificate']
  return [...REQUIRED_DOCUMENT_KEYS_BASE]
}

function hasDocumentUpload(
  documents: Partial<Record<TeacherDocumentKey, UploadedTeacherDocument>>,
  key: TeacherDocumentKey
): boolean {
  const entry = documents[key]
  return Boolean(entry?.downloadUrl && entry.downloadUrl.trim())
}

function hasAnyConsentYes(consents: TeacherDocumentConsents): boolean {
  return consents.backgroundCheckConsent || consents.safeguardingPolicyAcknowledgement || consents.dataProcessingConsent
}

export function getTeacherFollowUpDocumentProgress(
  record: Partial<TeacherFollowUpDocumentRecord> | null | undefined
): TeacherDocumentProgress {
  const nyscApplicable = Boolean(record?.nyscApplicable)
  const requiredKeys = getRequiredDocumentKeys(nyscApplicable)
  const documents = record?.documents ?? {}
  const consents: TeacherDocumentConsents = {
    backgroundCheckConsent: Boolean(record?.consents?.backgroundCheckConsent),
    safeguardingPolicyAcknowledgement: Boolean(record?.consents?.safeguardingPolicyAcknowledgement),
    dataProcessingConsent: Boolean(record?.consents?.dataProcessingConsent),
  }

  const missingRequiredKeys = requiredKeys.filter((key) => !hasDocumentUpload(documents, key))
  const requiredUploaded = requiredKeys.length - missingRequiredKeys.length
  const hasAnyUpload = [...requiredKeys, ...OPTIONAL_DOCUMENT_KEYS].some((key) => hasDocumentUpload(documents, key))
  const consentsAllYes =
    consents.backgroundCheckConsent &&
    consents.safeguardingPolicyAcknowledgement &&
    consents.dataProcessingConsent

  let status: TeacherDocumentationStatus = 'pending'
  if (record?.status === 'pushed_to_sales' || Boolean(toStringValue(record?.pushedToSalesAt))) {
    status = 'pushed_to_sales'
  } else if (requiredUploaded === requiredKeys.length && consentsAllYes) {
    status = 'complete'
  } else if (requiredUploaded > 0 || hasAnyUpload || hasAnyConsentYes(consents)) {
    status = 'partial'
  }

  return {
    status,
    requiredUploaded,
    requiredTotal: requiredKeys.length,
    missingRequiredKeys,
    consentsAllYes,
    hasAnyUpload,
  }
}

function getFirstString(data: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = data[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function mapLeadFromSnapshot(
  id: string,
  data: Record<string, unknown>,
  fallbackEdunityId: string
): TeacherLeadLookupResult {
  return {
    id,
    edunityId: getFirstString(data, ['edunityId', 'edunity_id']) || fallbackEdunityId,
    fullName: getFirstString(data, ['fullName', 'name']),
    email: getFirstString(data, ['email', 'emailNormalized']),
    phone: getFirstString(data, ['phone', 'phoneNormalized']),
    state: getFirstString(data, ['state']),
    lga: getFirstString(data, ['lga']),
    area: getFirstString(data, ['area']),
    raw: data,
  }
}

export async function findTeacherLeadByEdunityId(
  edunityIdRaw: string
): Promise<TeacherLeadLookupResult | null> {
  const edunityId = normalizeEdunityId(edunityIdRaw)
  if (!edunityId) return null

  const db = getDb()
  const directSnap = await getDoc(doc(db, TEACHER_LEADS_COLLECTION, edunityId))
  if (directSnap.exists()) {
    return mapLeadFromSnapshot(directSnap.id, directSnap.data() as Record<string, unknown>, edunityId)
  }

  const [byField, byLegacyField] = await Promise.all([
    getDocs(
      query(
        collection(db, TEACHER_LEADS_COLLECTION),
        where('edunityId', '==', edunityId),
        limit(1)
      )
    ),
    getDocs(
      query(
        collection(db, TEACHER_LEADS_COLLECTION),
        where('edunity_id', '==', edunityId),
        limit(1)
      )
    ),
  ])

  const row = byField.docs[0] ?? byLegacyField.docs[0]
  if (!row) return null
  return mapLeadFromSnapshot(row.id, row.data() as Record<string, unknown>, edunityId)
}

function sanitizeStorageSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function buildTeacherDocumentStoragePath(
  edunityIdRaw: string,
  key: TeacherDocumentKey,
  originalFileName: string
): string {
  const edunityId = sanitizeStorageSegment(normalizeEdunityId(edunityIdRaw))
  const safeName = sanitizeStorageSegment(originalFileName) || `${key}-file`
  return `teacher-follow-up/${edunityId}/${key}/${Date.now()}-${safeName}`
}

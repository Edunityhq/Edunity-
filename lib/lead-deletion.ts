import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
  type DocumentReference,
} from 'firebase/firestore'
import { getDb } from '@/lib/firebase'
import {
  LEAD_ACTIVITY_COLLECTION,
  SCHOOL_LEADS_COLLECTION,
  normalizeEmail,
  normalizePhoneNumber,
  normalizeSchoolName,
} from '@/lib/company-leads'
import {
  LEAD_ASSIGNMENTS_COLLECTION,
  buildLeadAssignmentId,
  removeLeadAssignment,
} from '@/lib/auth/lead-assignments'
import { PARENT_REQUESTS_COLLECTION } from '@/lib/parent-requests'
import {
  SCHOOL_LEAD_UNIQUE_KEYS_COLLECTION,
} from '@/lib/school-leads'
import {
  TEACHER_LEADS_COLLECTION,
  TEACHER_LEAD_ID_REGISTRY_COLLECTION,
  TEACHER_LEAD_UNIQUE_KEYS_COLLECTION,
} from '@/lib/teacher-leads'
import { TEACHER_FOLLOW_UP_DOCUMENTS_COLLECTION } from '@/lib/teacher-follow-up-documents'

const TEACHER_FOLLOW_UPS_COLLECTION = 'teacher_follow_ups'
const PARENT_FOLLOW_UPS_COLLECTION = 'parent_request_follow_ups'

async function collectRefsByField(
  collectionName: string,
  fieldName: string,
  fieldValue: string,
  extraMatch?: { fieldName: string; fieldValue: string }
): Promise<DocumentReference[]> {
  if (!fieldValue) return []
  const snap = await getDocs(query(collection(getDb(), collectionName), where(fieldName, '==', fieldValue)))
  return snap.docs
    .filter((row) => {
      if (!extraMatch) return true
      const data = row.data() as Record<string, unknown>
      return data[extraMatch.fieldName] === extraMatch.fieldValue
    })
    .map((row) => row.ref)
}

async function deleteRefs(refs: DocumentReference[]): Promise<number> {
  if (refs.length === 0) return 0
  let deleted = 0

  for (let index = 0; index < refs.length; index += 400) {
    const batch = writeBatch(getDb())
    const chunk = refs.slice(index, index + 400)
    for (const ref of chunk) {
      batch.delete(ref)
    }
    await batch.commit()
    deleted += chunk.length
  }

  return deleted
}

async function upsertRefs(entries: Array<{ ref: DocumentReference; data: Record<string, unknown> }>): Promise<void> {
  if (entries.length === 0) return

  for (let index = 0; index < entries.length; index += 400) {
    const batch = writeBatch(getDb())
    const chunk = entries.slice(index, index + 400)
    for (const entry of chunk) {
      batch.set(entry.ref, entry.data, { merge: true })
    }
    await batch.commit()
  }
}

export async function deleteLeadRecord(input: {
  collectionName: string
  leadId: string
  preserveUniqueKeysForLeadId?: string
}): Promise<{ deletedRefs: number }> {
  const db = getDb()
  const leadRef = doc(db, input.collectionName, input.leadId)
  const leadSnap = await getDoc(leadRef)
  if (!leadSnap.exists()) {
    throw new Error('Lead record not found.')
  }

  const data = leadSnap.data() as Record<string, unknown>
  const refsToDelete: DocumentReference[] = [leadRef]
  const refsToUpsert: Array<{ ref: DocumentReference; data: Record<string, unknown> }> = []
  refsToDelete.push(doc(db, LEAD_ASSIGNMENTS_COLLECTION, buildLeadAssignmentId(input.collectionName, input.leadId)))

  const activityRefs = await collectRefsByField(
    LEAD_ACTIVITY_COLLECTION,
    'leadId',
    input.leadId,
    { fieldName: 'collectionName', fieldValue: input.collectionName }
  )
  refsToDelete.push(...activityRefs)

  if (input.collectionName === TEACHER_LEADS_COLLECTION) {
    const teacherFollowUpRefs = await collectRefsByField(
      TEACHER_FOLLOW_UPS_COLLECTION,
      'sourceDocId',
      input.leadId,
      { fieldName: 'sourceCollection', fieldValue: input.collectionName }
    )
    refsToDelete.push(...teacherFollowUpRefs)

    const teacherDocumentRefs = await collectRefsByField(TEACHER_FOLLOW_UP_DOCUMENTS_COLLECTION, 'leadDocId', input.leadId)
    refsToDelete.push(...teacherDocumentRefs)

    const edunityId =
      typeof data.edunityId === 'string'
        ? data.edunityId.trim()
        : typeof data.edunity_id === 'string'
          ? data.edunity_id.trim()
          : input.leadId
    if (edunityId) {
      refsToDelete.push(doc(db, TEACHER_LEAD_ID_REGISTRY_COLLECTION, edunityId))
    }

    const emailNormalized = normalizeEmail(data.emailNormalized ?? data.email)
    const phoneNormalized = normalizePhoneNumber(data.phoneNormalized ?? data.phone)
    if (emailNormalized) {
      const emailRef = doc(db, TEACHER_LEAD_UNIQUE_KEYS_COLLECTION, `email:${emailNormalized}`)
      if (input.preserveUniqueKeysForLeadId) {
        refsToUpsert.push({
          ref: emailRef,
          data: {
            collection: TEACHER_LEADS_COLLECTION,
            keyType: 'email',
            value: emailNormalized,
            docId: input.preserveUniqueKeysForLeadId,
            updatedAt: serverTimestamp(),
          },
        })
      } else {
        refsToDelete.push(emailRef)
      }
    }
    if (phoneNormalized) {
      const phoneRef = doc(db, TEACHER_LEAD_UNIQUE_KEYS_COLLECTION, `phone:${phoneNormalized}`)
      if (input.preserveUniqueKeysForLeadId) {
        refsToUpsert.push({
          ref: phoneRef,
          data: {
            collection: TEACHER_LEADS_COLLECTION,
            keyType: 'phone',
            value: phoneNormalized,
            docId: input.preserveUniqueKeysForLeadId,
            updatedAt: serverTimestamp(),
          },
        })
      } else {
        refsToDelete.push(phoneRef)
      }
    }
  }

  if (input.collectionName === PARENT_REQUESTS_COLLECTION) {
    const parentFollowUpRefs = await collectRefsByField(
      PARENT_FOLLOW_UPS_COLLECTION,
      'sourceDocId',
      input.leadId,
      { fieldName: 'sourceCollection', fieldValue: input.collectionName }
    )
    refsToDelete.push(...parentFollowUpRefs)
  }

  if (input.collectionName === SCHOOL_LEADS_COLLECTION) {
    const phoneNormalized = normalizePhoneNumber(data.phoneNumberNormalized ?? data.phoneNumber)
    const schoolNameNormalized = normalizeSchoolName(data.schoolName)
    if (phoneNormalized) {
      const phoneRef = doc(db, SCHOOL_LEAD_UNIQUE_KEYS_COLLECTION, `phone:${phoneNormalized}`)
      if (input.preserveUniqueKeysForLeadId) {
        refsToUpsert.push({
          ref: phoneRef,
          data: {
            collection: SCHOOL_LEADS_COLLECTION,
            keyType: 'phone',
            value: phoneNormalized,
            docId: input.preserveUniqueKeysForLeadId,
            updatedAt: serverTimestamp(),
          },
        })
      } else {
        refsToDelete.push(phoneRef)
      }
    }
    if (schoolNameNormalized && phoneNormalized) {
      const schoolPhoneRef = doc(db, SCHOOL_LEAD_UNIQUE_KEYS_COLLECTION, `school:${schoolNameNormalized}|${phoneNormalized}`)
      if (input.preserveUniqueKeysForLeadId) {
        refsToUpsert.push({
          ref: schoolPhoneRef,
          data: {
            collection: SCHOOL_LEADS_COLLECTION,
            keyType: 'school_phone',
            value: `${schoolNameNormalized}|${phoneNormalized}`,
            docId: input.preserveUniqueKeysForLeadId,
            updatedAt: serverTimestamp(),
          },
        })
      } else {
        refsToDelete.push(schoolPhoneRef)
      }
    }
  }

  const uniqueRefs = Array.from(new Map(refsToDelete.map((ref) => [ref.path, ref])).values())
  const deletedRefs = await deleteRefs(uniqueRefs)
  await upsertRefs(refsToUpsert)

  await removeLeadAssignment(input.collectionName, input.leadId)

  return { deletedRefs }
}

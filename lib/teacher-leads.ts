import { collection, doc, getDocs, limit, orderBy, query, runTransaction, serverTimestamp } from 'firebase/firestore'
import { getDb } from '@/lib/firebase'

export const TEACHER_LEADS_COLLECTION = 'teacher_interests'
export const TEACHER_LEAD_COUNTER_DOC = 'teacher_onboard_serial'
export const TEACHER_LEAD_ID_REGISTRY_COLLECTION = 'teacher_lead_id_registry'
export const TEACHER_LEAD_UNIQUE_KEYS_COLLECTION = 'teacher_lead_unique_keys'
export const TEACHER_LEAD_ID_PREFIX = 'EDU-ON-T-'
export const TEACHER_LEAD_MIN_SERIAL = 101
export const TEACHER_LEAD_DUPLICATE_EMAIL_ERROR = 'DUPLICATE_EMAIL'
export const TEACHER_LEAD_DUPLICATE_PHONE_ERROR = 'DUPLICATE_PHONE'

const LEGACY_TEACHER_ID_PREFIX = 'ED-ON-T-'
const ID_PATTERN = /^(?:EDU-ON-T-|ED-ON-T-)(\d{5})$/i

function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function normalizePhone(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\D/g, '') : ''
}

export function parseTeacherLeadSerial(edunityId: string | null | undefined): number | null {
  if (!edunityId) return null
  const trimmed = edunityId.trim()
  const match = trimmed.match(ID_PATTERN)
  if (!match) return null
  const serial = Number(match[1])
  return Number.isFinite(serial) ? serial : null
}

export function formatTeacherLeadId(serial: number): string {
  return `${TEACHER_LEAD_ID_PREFIX}${String(serial).padStart(5, '0')}`
}

export async function createTeacherLeadAtomic(payload: Record<string, unknown>) {
  const db = getDb()
  const leadsCol = collection(db, TEACHER_LEADS_COLLECTION)
  const counterRef = doc(db, 'counters', TEACHER_LEAD_COUNTER_DOC)
  const emailNormalized = normalizeEmail(payload.emailNormalized ?? payload.email)
  const phoneNormalized = normalizePhone(payload.phoneNormalized ?? payload.phone)

  if (!emailNormalized || !phoneNormalized) {
    throw new Error('MISSING_CONTACT_KEY')
  }

  // Reads highest existing ID so a stale counter can never generate an already-used serial.
  let observedMaxSerial = TEACHER_LEAD_MIN_SERIAL - 1
  try {
    const newestById = await getDocs(query(leadsCol, orderBy('edunityId', 'desc'), limit(1)))
    if (!newestById.empty) {
      const candidate = newestById.docs[0].data()?.edunityId
      const parsed = parseTeacherLeadSerial(typeof candidate === 'string' ? candidate : '')
      if (parsed) observedMaxSerial = Math.max(observedMaxSerial, parsed)
    }
  } catch {
    // Some projects may not have this index yet; transaction still guarantees monotonic counter.
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const result = await runTransaction(db, async (tx) => {
        const counterSnap = await tx.get(counterRef)
        const currentCounter = counterSnap.exists()
          ? Number((counterSnap.data().current as number | undefined) ?? TEACHER_LEAD_MIN_SERIAL - 1)
          : TEACHER_LEAD_MIN_SERIAL - 1

        const nextSerial = Math.max(TEACHER_LEAD_MIN_SERIAL, currentCounter + 1, observedMaxSerial + 1)
        const edunityId = formatTeacherLeadId(nextSerial)
        const leadRef = doc(leadsCol, edunityId)
        const idRegistryRef = doc(db, TEACHER_LEAD_ID_REGISTRY_COLLECTION, edunityId)
        const emailKeyRef = doc(db, TEACHER_LEAD_UNIQUE_KEYS_COLLECTION, `email:${emailNormalized}`)
        const phoneKeyRef = doc(db, TEACHER_LEAD_UNIQUE_KEYS_COLLECTION, `phone:${phoneNormalized}`)

        const [leadSnap, idRegistrySnap, emailKeySnap, phoneKeySnap] = await Promise.all([
          tx.get(leadRef),
          tx.get(idRegistryRef),
          tx.get(emailKeyRef),
          tx.get(phoneKeyRef),
        ])

        if (leadSnap.exists()) throw new Error('ID_COLLISION_RETRY')

        if (idRegistrySnap.exists()) {
          const existingDocId = idRegistrySnap.data().docId
          if (typeof existingDocId === 'string' && existingDocId !== leadRef.id) {
            const existingLeadSnap = await tx.get(doc(leadsCol, existingDocId))
            if (existingLeadSnap.exists()) throw new Error('ID_COLLISION_RETRY')
          }
        }

        if (emailKeySnap.exists()) {
          const existingDocId = emailKeySnap.data().docId
          if (typeof existingDocId === 'string' && existingDocId !== leadRef.id) {
            const existingLeadSnap = await tx.get(doc(leadsCol, existingDocId))
            if (existingLeadSnap.exists()) throw new Error(TEACHER_LEAD_DUPLICATE_EMAIL_ERROR)
          }
        }

        if (phoneKeySnap.exists()) {
          const existingDocId = phoneKeySnap.data().docId
          if (typeof existingDocId === 'string' && existingDocId !== leadRef.id) {
            const existingLeadSnap = await tx.get(doc(leadsCol, existingDocId))
            if (existingLeadSnap.exists()) throw new Error(TEACHER_LEAD_DUPLICATE_PHONE_ERROR)
          }
        }

        tx.set(counterRef, { current: nextSerial, updatedAt: serverTimestamp() }, { merge: true })
        tx.set(leadRef, {
          ...payload,
          email: emailNormalized,
          emailNormalized,
          phone: phoneNormalized,
          phoneNormalized,
          edunityId,
          edunityIdSerial: nextSerial,
          createdAt: serverTimestamp(),
        })
        tx.set(
          idRegistryRef,
          {
            collection: TEACHER_LEADS_COLLECTION,
            docId: leadRef.id,
            edunityId,
            edunityIdSerial: nextSerial,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        )
        tx.set(
          emailKeyRef,
          {
            collection: TEACHER_LEADS_COLLECTION,
            keyType: 'email',
            value: emailNormalized,
            docId: leadRef.id,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        )
        tx.set(
          phoneKeyRef,
          {
            collection: TEACHER_LEADS_COLLECTION,
            keyType: 'phone',
            value: phoneNormalized,
            docId: leadRef.id,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        )

        return { id: leadRef.id, edunityId, edunityIdSerial: nextSerial }
      })

      return result
    } catch (error) {
      if (error instanceof Error && error.message === 'ID_COLLISION_RETRY') continue
      throw error
    }
  }

  throw new Error('Could not allocate a unique Edunity ID after multiple retries.')
}

export function normalizeTeacherLeadId(edunityId: string): string {
  if (edunityId.startsWith(LEGACY_TEACHER_ID_PREFIX)) {
    return TEACHER_LEAD_ID_PREFIX + edunityId.slice(LEGACY_TEACHER_ID_PREFIX.length)
  }
  return edunityId
}

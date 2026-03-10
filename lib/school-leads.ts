import { collection, doc, getDocs, limit, orderBy, query, runTransaction, serverTimestamp } from 'firebase/firestore'
import { getDb } from '@/lib/firebase'
import { SCHOOL_LEADS_COLLECTION, normalizePhoneNumber, normalizeSchoolName } from '@/lib/company-leads'

export const SCHOOL_LEAD_COUNTER_DOC = 'school_lead_serial'
export const SCHOOL_LEAD_ID_PREFIX = 'ED-SCH-'
export const SCHOOL_LEAD_MIN_SERIAL = 101
export const SCHOOL_LEAD_UNIQUE_KEYS_COLLECTION = 'school_lead_unique_keys'
export const SCHOOL_LEAD_DUPLICATE_PHONE_ERROR = 'DUPLICATE_PHONE'
export const SCHOOL_LEAD_DUPLICATE_SCHOOL_PHONE_ERROR = 'DUPLICATE_SCHOOL_PHONE'

const ID_PATTERN = /^ED-SCH-(\d{5})$/i

export function parseSchoolLeadSerial(edunityId: string | null | undefined): number | null {
  if (!edunityId) return null
  const match = edunityId.trim().match(ID_PATTERN)
  if (!match) return null
  const serial = Number(match[1])
  return Number.isFinite(serial) ? serial : null
}

export function formatSchoolLeadId(serial: number): string {
  return `${SCHOOL_LEAD_ID_PREFIX}${String(serial).padStart(5, '0')}`
}

export async function createSchoolLeadAtomic(
  payload: Record<string, unknown>,
  options?: { allowDuplicateOverride?: boolean }
) {
  const db = getDb()
  const leadsCol = collection(db, SCHOOL_LEADS_COLLECTION)
  const counterRef = doc(db, 'counters', SCHOOL_LEAD_COUNTER_DOC)
  const phoneNumberNormalized = normalizePhoneNumber(payload.phoneNumberNormalized ?? payload.phoneNumber)
  const schoolNameNormalized = normalizeSchoolName(payload.schoolName)
  const allowDuplicateOverride = Boolean(options?.allowDuplicateOverride)

  if (!schoolNameNormalized || !phoneNumberNormalized) {
    throw new Error('MISSING_REQUIRED_SCHOOL_LEAD_KEYS')
  }

  let observedMaxSerial = SCHOOL_LEAD_MIN_SERIAL - 1
  try {
    const newestById = await getDocs(query(leadsCol, orderBy('edunityId', 'desc'), limit(1)))
    if (!newestById.empty) {
      const candidate = newestById.docs[0].data()?.edunityId
      const parsed = parseSchoolLeadSerial(typeof candidate === 'string' ? candidate : '')
      if (parsed) observedMaxSerial = Math.max(observedMaxSerial, parsed)
    }
  } catch {
    // Transaction still guarantees a monotonic counter.
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const result = await runTransaction(db, async (tx) => {
        const counterSnap = await tx.get(counterRef)
        const currentCounter = counterSnap.exists()
          ? Number((counterSnap.data().current as number | undefined) ?? SCHOOL_LEAD_MIN_SERIAL - 1)
          : SCHOOL_LEAD_MIN_SERIAL - 1

        const nextSerial = Math.max(SCHOOL_LEAD_MIN_SERIAL, currentCounter + 1, observedMaxSerial + 1)
        const edunityId = formatSchoolLeadId(nextSerial)
        const leadRef = doc(leadsCol, edunityId)
        const phoneKeyRef = doc(
          db,
          SCHOOL_LEAD_UNIQUE_KEYS_COLLECTION,
          `phone:${phoneNumberNormalized}`
        )
        const schoolPhoneKeyRef = doc(
          db,
          SCHOOL_LEAD_UNIQUE_KEYS_COLLECTION,
          `school:${schoolNameNormalized}|${phoneNumberNormalized}`
        )

        const [leadSnap, phoneKeySnap, schoolPhoneKeySnap] = await Promise.all([
          tx.get(leadRef),
          tx.get(phoneKeyRef),
          tx.get(schoolPhoneKeyRef),
        ])

        if (leadSnap.exists()) throw new Error('ID_COLLISION_RETRY')

        if (!allowDuplicateOverride && phoneKeySnap.exists()) {
          throw new Error(SCHOOL_LEAD_DUPLICATE_PHONE_ERROR)
        }

        if (!allowDuplicateOverride && schoolPhoneKeySnap.exists()) {
          throw new Error(SCHOOL_LEAD_DUPLICATE_SCHOOL_PHONE_ERROR)
        }

        tx.set(counterRef, { current: nextSerial, updatedAt: serverTimestamp() }, { merge: true })
        tx.set(leadRef, {
          ...payload,
          schoolNameNormalized,
          phoneNumberNormalized,
          edunityId,
          edunityIdSerial: nextSerial,
          probableDuplicate: Boolean(phoneKeySnap.exists() || schoolPhoneKeySnap.exists()),
          duplicateOverrideUsed: allowDuplicateOverride,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
        tx.set(
          phoneKeyRef,
          {
            collection: SCHOOL_LEADS_COLLECTION,
            keyType: 'phone',
            value: phoneNumberNormalized,
            docId: leadRef.id,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        )
        tx.set(
          schoolPhoneKeyRef,
          {
            collection: SCHOOL_LEADS_COLLECTION,
            keyType: 'school_phone',
            value: `${schoolNameNormalized}|${phoneNumberNormalized}`,
            docId: leadRef.id,
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

  throw new Error('Could not allocate a unique School Lead ID after multiple retries.')
}

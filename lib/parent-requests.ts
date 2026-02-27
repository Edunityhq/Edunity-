import { collection, doc, getDocs, limit, orderBy, query, runTransaction, serverTimestamp } from 'firebase/firestore'
import { getDb } from '@/lib/firebase'

export const PARENT_REQUESTS_COLLECTION = 'parent_requests'
export const PARENT_REQUEST_COUNTER_DOC = 'parent_request_serial'
export const PARENT_REQUEST_ID_PREFIX = 'ED-PR-'
export const PARENT_REQUEST_MIN_SERIAL = 101

const ID_PATTERN = /^ED-PR-(\d{5})$/i

export function parseParentRequestSerial(edunityId: string | null | undefined): number | null {
  if (!edunityId) return null
  const match = edunityId.trim().match(ID_PATTERN)
  if (!match) return null
  const serial = Number(match[1])
  return Number.isFinite(serial) ? serial : null
}

export function formatParentRequestId(serial: number): string {
  return `${PARENT_REQUEST_ID_PREFIX}${String(serial).padStart(5, '0')}`
}

export async function createParentRequestAtomic(payload: Record<string, unknown>) {
  const db = getDb()
  const requestsCol = collection(db, PARENT_REQUESTS_COLLECTION)
  const counterRef = doc(db, 'counters', PARENT_REQUEST_COUNTER_DOC)

  let observedMaxSerial = PARENT_REQUEST_MIN_SERIAL - 1
  try {
    const newestById = await getDocs(query(requestsCol, orderBy('edunityId', 'desc'), limit(1)))
    if (!newestById.empty) {
      const candidate = newestById.docs[0].data()?.edunityId
      const parsed = parseParentRequestSerial(typeof candidate === 'string' ? candidate : '')
      if (parsed) observedMaxSerial = Math.max(observedMaxSerial, parsed)
    }
  } catch {
    // Transaction still guarantees monotonic IDs if this query index is unavailable.
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const result = await runTransaction(db, async (tx) => {
        const counterSnap = await tx.get(counterRef)
        const currentCounter = counterSnap.exists()
          ? Number((counterSnap.data().current as number | undefined) ?? PARENT_REQUEST_MIN_SERIAL - 1)
          : PARENT_REQUEST_MIN_SERIAL - 1

        const nextSerial = Math.max(PARENT_REQUEST_MIN_SERIAL, currentCounter + 1, observedMaxSerial + 1)
        const edunityId = formatParentRequestId(nextSerial)
        const requestRef = doc(requestsCol, edunityId)
        const requestSnap = await tx.get(requestRef)
        if (requestSnap.exists()) throw new Error('ID_COLLISION_RETRY')

        tx.set(counterRef, { current: nextSerial, updatedAt: serverTimestamp() }, { merge: true })
        tx.set(requestRef, {
          ...payload,
          edunityId,
          edunityIdSerial: nextSerial,
          createdAt: serverTimestamp(),
        })

        return { id: requestRef.id, edunityId, edunityIdSerial: nextSerial }
      })

      return result
    } catch (error) {
      if (error instanceof Error && error.message === 'ID_COLLISION_RETRY') continue
      throw error
    }
  }

  throw new Error('Could not allocate a unique Parent Request ID after multiple retries.')
}

import fs from 'node:fs'
import path from 'node:path'
import { initializeApp, getApps, getApp } from 'firebase/app'
import {
  collection,
  doc,
  getDocs,
  getFirestore,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'

const COLLECTION = process.env.TEACHER_LEADS_COLLECTION || 'teacher_interests'
const ARCHIVE_COLLECTION = `${COLLECTION}_dedup_archive`
const UNIQUE_KEYS_COLLECTION = 'teacher_lead_unique_keys'
const ID_REGISTRY_COLLECTION = 'teacher_lead_id_registry'
const COUNTER_DOC = 'teacher_onboard_serial'
const MIN_SERIAL = 101
const ID_PREFIX = 'EDU-ON-T-'
const ID_PATTERN = /^(?:EDU-ON-T-|ED-ON-T-)(\d{5})$/i

function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return
  const content = fs.readFileSync(envPath, 'utf8')
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx < 0) continue
    const key = trimmed.slice(0, idx).trim()
    const value = trimmed.slice(idx + 1).trim().replace(/^"|"$/g, '')
    if (!process.env[key]) process.env[key] = value
  }
}

function parseSerial(edunityId) {
  if (typeof edunityId !== 'string') return null
  const match = edunityId.trim().match(ID_PATTERN)
  if (!match) return null
  const value = Number(match[1])
  return Number.isFinite(value) ? value : null
}

function formatEdunityId(serial) {
  return `${ID_PREFIX}${String(serial).padStart(5, '0')}`
}

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function normalizePhone(value) {
  return typeof value === 'string' ? value.replace(/\D/g, '') : ''
}

function normalizeEdunityId(value) {
  const serial = parseSerial(value)
  if (serial == null) return ''
  return formatEdunityId(serial)
}

function toMillis(value) {
  if (!value) return Number.MAX_SAFE_INTEGER
  if (typeof value?.toDate === 'function') return value.toDate().getTime()
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const t = new Date(value).getTime()
    return Number.isFinite(t) ? t : Number.MAX_SAFE_INTEGER
  }
  return Number.MAX_SAFE_INTEGER
}

function getCreatedAtMillis(row) {
  return toMillis(row.data.createdAt ?? row.data.created_at ?? row.data.submittedAt ?? row.data.timestamp)
}

function compareRowsByCreatedAtThenId(a, b) {
  const at = getCreatedAtMillis(a)
  const bt = getCreatedAtMillis(b)
  if (at !== bt) return at - bt
  return a.id.localeCompare(b.id)
}

function chunk(array, size) {
  const out = []
  for (let i = 0; i < array.length; i += size) out.push(array.slice(i, i + size))
  return out
}

function buildUnionFind(size) {
  const parent = Array.from({ length: size }, (_, i) => i)
  const rank = Array.from({ length: size }, () => 0)

  function find(x) {
    if (parent[x] !== x) parent[x] = find(parent[x])
    return parent[x]
  }

  function union(a, b) {
    const ra = find(a)
    const rb = find(b)
    if (ra === rb) return
    if (rank[ra] < rank[rb]) {
      parent[ra] = rb
      return
    }
    if (rank[ra] > rank[rb]) {
      parent[rb] = ra
      return
    }
    parent[rb] = ra
    rank[ra] += 1
  }

  return { find, union }
}

async function commitWrites(db, writes, maxPerBatch = 450) {
  let committed = 0
  for (const group of chunk(writes, maxPerBatch)) {
    const batch = writeBatch(db)
    for (const op of group) {
      if (op.type === 'set') {
        if (op.options) batch.set(op.ref, op.data, op.options)
        else batch.set(op.ref, op.data)
      } else if (op.type === 'update') {
        batch.update(op.ref, op.data)
      } else if (op.type === 'delete') {
        batch.delete(op.ref)
      }
    }
    await batch.commit()
    committed += group.length
  }
  return committed
}

loadEnvLocal()

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

if (!config.apiKey || !config.projectId) {
  console.error('Missing Firebase env in .env.local (NEXT_PUBLIC_FIREBASE_*).')
  process.exit(1)
}

const applyMode = process.argv.includes('--apply')
const app = getApps().length ? getApp() : initializeApp(config)
const db = getFirestore(app)

async function main() {
  console.log(`[scan] collection=${COLLECTION} mode=${applyMode ? 'APPLY' : 'DRY_RUN'}`)
  const snap = await getDocs(collection(db, COLLECTION))
  const docs = snap.docs.map((d) => ({ id: d.id, ref: d.ref, data: d.data() }))
  console.log(`[scan] total_docs=${docs.length}`)

  if (docs.length === 0) {
    console.log('[result] Collection is empty, nothing to dedupe.')
    return
  }

  const byEmail = new Map()
  const byPhone = new Map()
  for (let i = 0; i < docs.length; i += 1) {
    const row = docs[i]
    const email = normalizeEmail(row.data.emailNormalized ?? row.data.email)
    const phone = normalizePhone(row.data.phoneNormalized ?? row.data.phone)
    if (email) {
      if (!byEmail.has(email)) byEmail.set(email, [])
      byEmail.get(email).push(i)
    }
    if (phone) {
      if (!byPhone.has(phone)) byPhone.set(phone, [])
      byPhone.get(phone).push(i)
    }
  }

  const uf = buildUnionFind(docs.length)
  const duplicateEmailGroups = [...byEmail.entries()].filter(([, idx]) => idx.length > 1)
  const duplicatePhoneGroups = [...byPhone.entries()].filter(([, idx]) => idx.length > 1)

  for (const [, idx] of duplicateEmailGroups) {
    for (let i = 1; i < idx.length; i += 1) uf.union(idx[0], idx[i])
  }
  for (const [, idx] of duplicatePhoneGroups) {
    for (let i = 1; i < idx.length; i += 1) uf.union(idx[0], idx[i])
  }

  const components = new Map()
  for (let i = 0; i < docs.length; i += 1) {
    const root = uf.find(i)
    if (!components.has(root)) components.set(root, [])
    components.get(root).push(i)
  }

  const duplicateComponents = [...components.values()].filter((rows) => rows.length > 1)
  const removeDocIdSet = new Set()
  const removeRows = []

  for (const componentIndexes of duplicateComponents) {
    const rows = componentIndexes.map((i) => docs[i]).sort(compareRowsByCreatedAtThenId)
    const canonical = rows[0]
    for (const row of rows.slice(1)) {
      removeDocIdSet.add(row.id)
      removeRows.push({ row, canonicalDocId: canonical.id })
    }
  }

  const canonicalRows = docs.filter((row) => !removeDocIdSet.has(row.id)).sort(compareRowsByCreatedAtThenId)

  let maxObservedSerial = MIN_SERIAL - 1
  for (const row of canonicalRows) {
    const serial = parseSerial(row.data.edunityId)
    if (serial != null) maxObservedSerial = Math.max(maxObservedSerial, serial)
  }

  const assignedSerials = new Set()
  let nextSerial = Math.max(MIN_SERIAL, maxObservedSerial + 1)
  const normalizedRows = []
  const idReassignments = []
  const canonicalUpdates = []

  for (const row of canonicalRows) {
    const normalizedEmail = normalizeEmail(row.data.emailNormalized ?? row.data.email)
    const normalizedPhone = normalizePhone(row.data.phoneNormalized ?? row.data.phone)
    const currentEdunityId = typeof row.data.edunityId === 'string' ? row.data.edunityId.trim() : ''
    const parsedSerial = parseSerial(currentEdunityId)

    let finalSerial
    if (parsedSerial != null && !assignedSerials.has(parsedSerial)) {
      finalSerial = parsedSerial
    } else {
      while (assignedSerials.has(nextSerial)) nextSerial += 1
      finalSerial = nextSerial
      nextSerial += 1
    }
    assignedSerials.add(finalSerial)

    const finalEdunityId = formatEdunityId(finalSerial)
    const updatePayload = {}

    if (currentEdunityId !== finalEdunityId || row.data.edunityIdSerial !== finalSerial) {
      updatePayload.edunityId = finalEdunityId
      updatePayload.edunityIdSerial = finalSerial
      if (currentEdunityId && currentEdunityId !== finalEdunityId) {
        updatePayload.idReassignedFrom = currentEdunityId
      }
      updatePayload.idReassignedAt = serverTimestamp()
      idReassignments.push({
        docId: row.id,
        fromId: currentEdunityId || '(empty)',
        toId: finalEdunityId,
      })
    }

    if (normalizedEmail && (row.data.email !== normalizedEmail || row.data.emailNormalized !== normalizedEmail)) {
      updatePayload.email = normalizedEmail
      updatePayload.emailNormalized = normalizedEmail
    }

    if (normalizedPhone && (row.data.phone !== normalizedPhone || row.data.phoneNormalized !== normalizedPhone)) {
      updatePayload.phone = normalizedPhone
      updatePayload.phoneNormalized = normalizedPhone
    }

    if (Object.keys(updatePayload).length > 0) {
      canonicalUpdates.push({ row, data: updatePayload })
    }

    normalizedRows.push({
      row,
      normalizedEmail,
      normalizedPhone,
      finalEdunityId,
      finalSerial,
    })
  }

  const desiredUniqueKeys = new Map()
  const desiredRegistry = new Map()

  for (const row of normalizedRows) {
    desiredRegistry.set(row.finalEdunityId, {
      docId: row.row.id,
      edunityId: row.finalEdunityId,
      edunityIdSerial: row.finalSerial,
      collection: COLLECTION,
      updatedAt: serverTimestamp(),
    })

    if (row.normalizedEmail) {
      const emailKey = `email:${row.normalizedEmail}`
      if (!desiredUniqueKeys.has(emailKey)) {
        desiredUniqueKeys.set(emailKey, {
          keyType: 'email',
          value: row.normalizedEmail,
          docId: row.row.id,
          collection: COLLECTION,
          updatedAt: serverTimestamp(),
        })
      }
    }

    if (row.normalizedPhone) {
      const phoneKey = `phone:${row.normalizedPhone}`
      if (!desiredUniqueKeys.has(phoneKey)) {
        desiredUniqueKeys.set(phoneKey, {
          keyType: 'phone',
          value: row.normalizedPhone,
          docId: row.row.id,
          collection: COLLECTION,
          updatedAt: serverTimestamp(),
        })
      }
    }
  }

  const [existingUniqueSnap, existingRegistrySnap] = await Promise.all([
    getDocs(collection(db, UNIQUE_KEYS_COLLECTION)),
    getDocs(collection(db, ID_REGISTRY_COLLECTION)),
  ])

  const staleUniqueRefs = []
  for (const d of existingUniqueSnap.docs) {
    const id = d.id
    const data = d.data()
    if (!id.startsWith('email:') && !id.startsWith('phone:')) continue
    if (typeof data.collection === 'string' && data.collection !== COLLECTION) continue
    if (!desiredUniqueKeys.has(id)) staleUniqueRefs.push(d.ref)
  }

  const staleRegistryRefs = []
  for (const d of existingRegistrySnap.docs) {
    const data = d.data()
    if (typeof data.collection === 'string' && data.collection !== COLLECTION) continue
    if (!desiredRegistry.has(d.id)) staleRegistryRefs.push(d.ref)
  }

  console.log(`[summary] duplicate_email_groups=${duplicateEmailGroups.length}`)
  console.log(`[summary] duplicate_phone_groups=${duplicatePhoneGroups.length}`)
  console.log(`[summary] duplicate_contact_components=${duplicateComponents.length}`)
  console.log(`[summary] docs_to_archive_and_delete=${removeRows.length}`)
  console.log(`[summary] canonical_docs=${normalizedRows.length}`)
  console.log(`[summary] docs_to_update=${canonicalUpdates.length}`)
  console.log(`[summary] docs_with_id_reassignments=${idReassignments.length}`)
  console.log(`[summary] unique_key_docs_to_upsert=${desiredUniqueKeys.size}`)
  console.log(`[summary] unique_key_docs_to_delete=${staleUniqueRefs.length}`)
  console.log(`[summary] id_registry_docs_to_upsert=${desiredRegistry.size}`)
  console.log(`[summary] id_registry_docs_to_delete=${staleRegistryRefs.length}`)

  for (const row of idReassignments) {
    console.log(`[id] ${row.docId}: ${row.fromId} -> ${row.toId}`)
  }

  for (const row of removeRows) {
    const email = normalizeEmail(row.row.data.emailNormalized ?? row.row.data.email) || '-'
    const phone = normalizePhone(row.row.data.phoneNormalized ?? row.row.data.phone) || '-'
    console.log(`[delete] ${row.row.id} duplicate_of=${row.canonicalDocId} email=${email} phone=${phone}`)
  }

  if (!applyMode) {
    console.log('[dry-run] No writes made. Run with --apply to execute.')
    return
  }

  const writes = []

  for (const removed of removeRows) {
    writes.push({
      type: 'set',
      ref: doc(db, ARCHIVE_COLLECTION, removed.row.id),
      data: {
        ...removed.row.data,
        _sourceCollection: COLLECTION,
        _sourceDocId: removed.row.id,
        _canonicalDocId: removed.canonicalDocId,
        _archiveReason: 'duplicate_contact',
        _archivedAt: serverTimestamp(),
      },
      options: { merge: true },
    })
    writes.push({
      type: 'delete',
      ref: doc(db, COLLECTION, removed.row.id),
    })
  }

  for (const update of canonicalUpdates) {
    writes.push({
      type: 'update',
      ref: doc(db, COLLECTION, update.row.id),
      data: update.data,
    })
  }

  for (const [key, data] of desiredUniqueKeys.entries()) {
    writes.push({
      type: 'set',
      ref: doc(db, UNIQUE_KEYS_COLLECTION, key),
      data: {
        ...data,
        createdAt: serverTimestamp(),
      },
      options: { merge: true },
    })
  }

  for (const ref of staleUniqueRefs) {
    writes.push({
      type: 'delete',
      ref,
    })
  }

  for (const [id, data] of desiredRegistry.entries()) {
    writes.push({
      type: 'set',
      ref: doc(db, ID_REGISTRY_COLLECTION, id),
      data: {
        ...data,
        createdAt: serverTimestamp(),
      },
      options: { merge: true },
    })
  }

  for (const ref of staleRegistryRefs) {
    writes.push({
      type: 'delete',
      ref,
    })
  }

  const finalCounter = normalizedRows.reduce(
    (max, row) => (row.finalSerial > max ? row.finalSerial : max),
    MIN_SERIAL - 1
  )

  writes.push({
    type: 'set',
    ref: doc(db, 'counters', COUNTER_DOC),
    data: {
      current: finalCounter,
      updatedAt: serverTimestamp(),
    },
    options: { merge: true },
  })

  const committedOps = await commitWrites(db, writes)
  console.log(`[apply] completed. write_ops=${committedOps} archive_collection=${ARCHIVE_COLLECTION}`)
}

main().catch((err) => {
  console.error('[error]', err)
  process.exit(1)
})

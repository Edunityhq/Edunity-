import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  query,
  setDoc,
} from 'firebase/firestore'
import { getDb } from '@/lib/firebase'

export const LEAD_ASSIGNMENTS_COLLECTION = 'lead_assignments'
const ASSIGNMENTS_STORAGE_KEY = 'edunity_lead_assignments_v1'

export interface LeadAssignment {
  id: string
  leadId: string
  collectionName: string
  assignedUserId: string
  assignedUserName: string
  assignedByUserId: string
  assignedByName: string
  assignedAt: string
}

function canUseStorage() {
  return typeof window !== 'undefined'
}

function readLocalAssignments(): Record<string, LeadAssignment> {
  if (!canUseStorage()) return {}
  const raw = window.localStorage.getItem(ASSIGNMENTS_STORAGE_KEY)
  if (!raw) return {}

  try {
    const parsed = JSON.parse(raw) as Record<string, LeadAssignment>
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed
  } catch {
    return {}
  }
}

function writeLocalAssignments(assignments: Record<string, LeadAssignment>) {
  if (!canUseStorage()) return
  window.localStorage.setItem(ASSIGNMENTS_STORAGE_KEY, JSON.stringify(assignments))
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '_')
}

export function buildLeadAssignmentId(collectionName: string, leadId: string): string {
  return `${normalizeText(collectionName)}__${normalizeText(leadId)}`
}

export async function getLeadAssignments(): Promise<Record<string, LeadAssignment>> {
  try {
    const snap = await getDocs(query(collection(getDb(), LEAD_ASSIGNMENTS_COLLECTION), limit(2000)))
    const next: Record<string, LeadAssignment> = {}

    for (const row of snap.docs) {
      const data = row.data() as Partial<LeadAssignment>
      const leadId = typeof data.leadId === 'string' ? data.leadId : ''
      const collectionName = typeof data.collectionName === 'string' ? data.collectionName : ''
      const assignedUserId = typeof data.assignedUserId === 'string' ? data.assignedUserId : ''
      const assignedUserName = typeof data.assignedUserName === 'string' ? data.assignedUserName : ''
      const assignedByUserId = typeof data.assignedByUserId === 'string' ? data.assignedByUserId : ''
      const assignedByName = typeof data.assignedByName === 'string' ? data.assignedByName : ''
      const assignedAt = typeof data.assignedAt === 'string' ? data.assignedAt : new Date().toISOString()
      if (!leadId || !collectionName || !assignedUserId) continue

      next[row.id] = {
        id: row.id,
        leadId,
        collectionName,
        assignedUserId,
        assignedUserName,
        assignedByUserId,
        assignedByName,
        assignedAt,
      }
    }

    writeLocalAssignments(next)
    return next
  } catch {
    return readLocalAssignments()
  }
}

export async function saveLeadAssignment(input: {
  leadId: string
  collectionName: string
  assignedUserId: string
  assignedUserName: string
  assignedByUserId: string
  assignedByName: string
}): Promise<LeadAssignment> {
  const id = buildLeadAssignmentId(input.collectionName, input.leadId)
  const assignment: LeadAssignment = {
    id,
    leadId: input.leadId,
    collectionName: input.collectionName,
    assignedUserId: input.assignedUserId,
    assignedUserName: input.assignedUserName,
    assignedByUserId: input.assignedByUserId,
    assignedByName: input.assignedByName,
    assignedAt: new Date().toISOString(),
  }

  const local = readLocalAssignments()
  local[id] = assignment
  writeLocalAssignments(local)

  try {
    await setDoc(doc(getDb(), LEAD_ASSIGNMENTS_COLLECTION, id), assignment)
  } catch {
    // Local fallback already persisted.
  }

  return assignment
}

export async function removeLeadAssignment(collectionName: string, leadId: string): Promise<void> {
  const id = buildLeadAssignmentId(collectionName, leadId)

  const local = readLocalAssignments()
  delete local[id]
  writeLocalAssignments(local)

  try {
    await deleteDoc(doc(getDb(), LEAD_ASSIGNMENTS_COLLECTION, id))
  } catch {
    // Local fallback already persisted.
  }
}
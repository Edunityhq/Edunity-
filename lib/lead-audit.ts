import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { getDb } from '@/lib/firebase'
import { LEAD_ACTIVITY_COLLECTION } from '@/lib/company-leads'
import type { LeadStatus, LeadType } from '@/lib/types'

export type LeadActivityType =
  | 'LEAD_CREATED'
  | 'ASSIGNMENT_CHANGED'
  | 'STATUS_CHANGED'
  | 'CALL'
  | 'WHATSAPP'
  | 'EMAIL'
  | 'NOTE'
  | 'MEETING'
  | 'PROPOSAL_SENT'
  | 'ROUTED'
  | 'DUPLICATE_OVERRIDE'
  | 'VALIDATION_CHANGED'

export interface LeadActivityEvent {
  collectionName: string
  leadId: string
  leadType: LeadType
  activityType: LeadActivityType
  message: string
  userId: string
  userName: string
  nextStatus?: LeadStatus
  notes?: string
  nextActionDate?: string | null
  teamOwner?: string
  metadata?: Record<string, unknown>
}

export async function logLeadActivity(event: LeadActivityEvent): Promise<void> {
  await addDoc(collection(getDb(), LEAD_ACTIVITY_COLLECTION), {
    ...event,
    createdAt: serverTimestamp(),
  })
}

import { doc, getDoc, runTransaction, serverTimestamp, setDoc } from 'firebase/firestore'
import { getDb } from '@/lib/firebase'
import { getUsers, type MockUser } from '@/lib/auth/mock-users'
import { buildLeadAssignmentId, saveLeadAssignment, type LeadAssignment } from '@/lib/auth/lead-assignments'
import { ROUND_ROBIN_STATE_COLLECTION } from '@/lib/company-leads'
import { logLeadActivity } from '@/lib/lead-audit'
import { TEAM_LABELS, getEligibleRolesForTeam, getInitialOwnerTeam } from '@/lib/lead-workflows'
import type { LeadStatus, LeadType, Role, TeamOwner } from '@/lib/types'

const ROUND_ROBIN_DOC_ID = 'company_follow_up'

type RoundRobinState = {
  nextIndexByPool?: Partial<Record<string, number>>
}

function getEligibleUsers(users: MockUser[], eligibleRoles: Role[], createdByUserId?: string): MockUser[] {
  return users
    .filter(
      (user) =>
        user.status === 'active' &&
        eligibleRoles.includes(user.role) &&
        (!createdByUserId || user.id !== createdByUserId)
    )
    .sort((a, b) => a.name.localeCompare(b.name))
}

async function assignByPool(input: {
  leadId: string
  collectionName: string
  leadType: LeadType
  teamOwner: TeamOwner
  eligibleRoles: Role[]
  createdByUserId?: string
  createdByUserName?: string
  assignedByUserId?: string
  assignedByName?: string
  assignmentMode?: 'manual' | 'round_robin' | 'override'
  notes?: string
}): Promise<LeadAssignment | null> {
  const users = getEligibleUsers(await getUsers(), input.eligibleRoles, input.createdByUserId)
  if (users.length === 0) return null

  const db = getDb()
  const stateRef = doc(db, ROUND_ROBIN_STATE_COLLECTION, ROUND_ROBIN_DOC_ID)
  const poolKey = `${input.teamOwner}:${input.leadType}`
  const nextIndex = await runTransaction(db, async (tx) => {
    const snap = await tx.get(stateRef)
    const current = (snap.data() as RoundRobinState | undefined)?.nextIndexByPool ?? {}
    const index = current[poolKey] ?? 0
    tx.set(
      stateRef,
      {
        nextIndexByPool: {
          ...current,
          [poolKey]: (index + 1) % users.length,
        },
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    )
    return index
  })

  const assignee = users[nextIndex % users.length]
  const assignmentId = buildLeadAssignmentId(input.collectionName, input.leadId)
  const previous = await getDoc(doc(db, 'lead_assignments', assignmentId))
  const previousData = previous.exists() ? previous.data() as Partial<LeadAssignment> : null

  const assignment = await saveLeadAssignment({
    leadId: input.leadId,
    collectionName: input.collectionName,
    assignedUserId: assignee.id,
    assignedUserName: assignee.name,
    assignedByUserId: input.assignedByUserId ?? 'system_round_robin',
    assignedByName: input.assignedByName ?? 'Round Robin',
    assignmentMode: input.assignmentMode ?? 'round_robin',
    leadType: input.leadType,
    notes: input.notes,
  })

  await setDoc(
    doc(db, input.collectionName, input.leadId),
    {
      assignedToUserId: assignee.id,
      assignedToUserName: assignee.name,
      currentTeamOwner: input.teamOwner,
      assignedDepartment: input.teamOwner,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  )

  await logLeadActivity({
    collectionName: input.collectionName,
    leadId: input.leadId,
    leadType: input.leadType,
    activityType: 'ASSIGNMENT_CHANGED',
    message: previousData?.assignedUserId
      ? `Reassigned to ${assignee.name} for ${TEAM_LABELS[input.teamOwner]}.`
      : `Assigned to ${assignee.name} for ${TEAM_LABELS[input.teamOwner]}.`,
    userId: input.assignedByUserId ?? 'system_round_robin',
    userName: input.assignedByName ?? 'Round Robin',
    teamOwner: input.teamOwner,
    metadata: {
      previousAssignedUserId: previousData?.assignedUserId ?? '',
      previousAssignedUserName: previousData?.assignedUserName ?? '',
      assignedUserId: assignee.id,
      assignedUserName: assignee.name,
      teamOwner: input.teamOwner,
      createdByUserId: input.createdByUserId ?? '',
      createdByUserName: input.createdByUserName ?? '',
    },
  })

  return assignment
}

export async function assignLeadRoundRobin(input: {
  leadId: string
  collectionName: string
  leadType: LeadType
  createdByUserId?: string
  createdByUserName?: string
  teamOwner?: TeamOwner
  targetRoles?: Role[]
  assignedByUserId?: string
  assignedByName?: string
  notes?: string
}): Promise<LeadAssignment | null> {
  const teamOwner = input.teamOwner ?? getInitialOwnerTeam(input.leadType)
  const eligibleRoles = input.targetRoles ?? getEligibleRolesForTeam(teamOwner)
  return assignByPool({
    ...input,
    teamOwner,
    eligibleRoles,
    assignmentMode: 'round_robin',
  })
}

export async function routeLeadToTeam(input: {
  leadId: string
  collectionName: string
  leadType: LeadType
  nextStatus: LeadStatus
  toTeam: TeamOwner
  routedByUserId: string
  routedByUserName: string
  handoffNote: string
  createdByUserId?: string
  createdByUserName?: string
  nextActionDate?: string
  nextActionNote?: string
}): Promise<LeadAssignment | null> {
  const assignment = await assignLeadRoundRobin({
    leadId: input.leadId,
    collectionName: input.collectionName,
    leadType: input.leadType,
    createdByUserId: input.createdByUserId,
    createdByUserName: input.createdByUserName,
    teamOwner: input.toTeam,
    targetRoles: getEligibleRolesForTeam(input.toTeam),
    assignedByUserId: input.routedByUserId,
    assignedByName: input.routedByUserName,
    notes: input.handoffNote,
  })

  await setDoc(
    doc(getDb(), input.collectionName, input.leadId),
    {
      status: input.nextStatus,
      currentTeamOwner: input.toTeam,
      assignedDepartment: input.toTeam,
      assignedToUserId: assignment?.assignedUserId ?? '',
      assignedToUserName: assignment?.assignedUserName ?? '',
      routedByUserId: input.routedByUserId,
      routedByUserName: input.routedByUserName,
      handoffNote: input.handoffNote,
      nextActionDate: input.nextActionDate ?? '',
      nextActionNote: input.nextActionNote ?? '',
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  )

  await logLeadActivity({
    collectionName: input.collectionName,
    leadId: input.leadId,
    leadType: input.leadType,
    activityType: 'ROUTED',
    message: `Lead routed to ${TEAM_LABELS[input.toTeam]}.`,
    userId: input.routedByUserId,
    userName: input.routedByUserName,
    nextStatus: input.nextStatus,
    notes: input.handoffNote,
    nextActionDate: input.nextActionDate ?? null,
    teamOwner: input.toTeam,
    metadata: {
      assignedToUserId: assignment?.assignedUserId ?? '',
      assignedToUserName: assignment?.assignedUserName ?? '',
      nextActionNote: input.nextActionNote ?? '',
    },
  })

  return assignment
}

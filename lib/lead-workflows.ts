import type { LeadStatus, LeadType, Role, TeamOwner } from '@/lib/types'

export const TEAM_LABELS: Record<TeamOwner, string> = {
  lead: 'Lead',
  marketing: 'Marketing',
  sales: 'Sales',
  hr: 'HR',
  finance: 'Finance',
  ops: 'Ops',
}

export const TEAM_ROLE_MAP: Record<TeamOwner, Role[]> = {
  lead: ['lead'],
  marketing: ['marketing', 'marketing_staff'],
  sales: ['sales'],
  hr: ['hr'],
  finance: ['finance'],
  ops: ['ops'],
}

export const SHARED_LEAD_STATUSES: LeadStatus[] = [
  'NEW',
  'CONTACTED',
  'INTERESTED',
  'ROUTED',
  'REJECTED',
  'LOST',
  'CONVERTED',
]

export const SCHOOL_PIPELINE_STATUSES: LeadStatus[] = [
  'MEETING_SCHEDULED',
  'MEETING_CONFIRMED',
  'MEETING_ACCEPTED',
  'MEETING_DONE',
  'MEETING_COMPLETED',
  'PROPOSAL_SENT',
  'NEGOTIATION',
  'VERBAL_YES',
  'CONTRACT_SENT',
  'CLOSED_WON',
  'CLOSED_LOST',
]

export const PARENT_PIPELINE_STATUSES: LeadStatus[] = [
  'INTRO_COMPLETE',
  'SCHOOL_OPTIONS_SENT',
  'PARENT_DECISION_PENDING',
  'ENROLLMENT_CONFIRMED',
  'CLOSED_WON',
  'CLOSED_LOST',
]

export const TEACHER_PIPELINE_STATUSES: LeadStatus[] = [
  'ONBOARDING_COMPLETED',
  'SENT_TO_HR',
  'UNDER_VERIFICATION',
  'APPROVED',
]

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: 'New',
  CONTACTED: 'Contacted',
  INTERESTED: 'Interested',
  ROUTED: 'Routed',
  MEETING_SCHEDULED: 'Meeting Scheduled',
  MEETING_CONFIRMED: 'Meeting Confirmed',
  MEETING_ACCEPTED: 'Meeting Accepted',
  MEETING_DONE: 'Meeting Done',
  MEETING_COMPLETED: 'Meeting Completed',
  PROPOSAL_SENT: 'Proposal Sent',
  NEGOTIATION: 'Negotiation',
  VERBAL_YES: 'Verbal Yes',
  CONTRACT_SENT: 'Contract Sent',
  INTRO_COMPLETE: 'Intro Complete',
  SCHOOL_OPTIONS_SENT: 'School Options Sent',
  PARENT_DECISION_PENDING: 'Parent Decision Pending',
  ENROLLMENT_CONFIRMED: 'Enrollment Confirmed',
  ONBOARDING_COMPLETED: 'Documents Submitted',
  SENT_TO_HR: 'Sent To HR',
  UNDER_VERIFICATION: 'Under Verification',
  APPROVED: 'Approved',
  CLOSED_WON: 'Closed Won',
  CLOSED_LOST: 'Closed Lost',
  CONVERTED: 'Converted',
  LOST: 'Lost',
  REJECTED: 'Rejected',
}

export function getDefaultStatusForLeadType(leadType: LeadType): LeadStatus {
  if (leadType === 'SCHOOL') return 'MEETING_ACCEPTED'
  if (leadType === 'TEACHER') return 'INTERESTED'
  return 'NEW'
}

export function getInitialOwnerTeam(leadType: LeadType): TeamOwner {
  if (leadType === 'TEACHER' || leadType === 'PARENT' || leadType === 'SCHOOL') return 'marketing'
  return 'lead'
}

export function getDefaultRouteTeam(leadType: LeadType): TeamOwner {
  return leadType === 'TEACHER' ? 'hr' : 'sales'
}

export function getEligibleRolesForTeam(team: TeamOwner): Role[] {
  const roles = TEAM_ROLE_MAP[team] ?? []
  return Array.from(new Set<Role>([...roles, 'admin']))
}

export function getStatusOptionsForLeadType(leadType: LeadType): LeadStatus[] {
  if (leadType === 'SCHOOL') return [...SHARED_LEAD_STATUSES, ...SCHOOL_PIPELINE_STATUSES]
  if (leadType === 'PARENT') return [...SHARED_LEAD_STATUSES, ...PARENT_PIPELINE_STATUSES]
  return [...SHARED_LEAD_STATUSES, ...TEACHER_PIPELINE_STATUSES]
}

export function getStatusOptionsForTeam(leadType: LeadType, team: TeamOwner, role?: Role): LeadStatus[] {
  const isAdmin = role === 'admin'
  if (isAdmin) return getStatusOptionsForLeadType(leadType)

  if (leadType === 'TEACHER') {
    if (team === 'hr') return ['UNDER_VERIFICATION', 'APPROVED', 'REJECTED', 'LOST']
    if (team === 'marketing') return ['ONBOARDING_COMPLETED', 'CONTACTED', 'INTERESTED', 'SENT_TO_HR', 'LOST']
    return ['CONTACTED', 'INTERESTED', 'SENT_TO_HR']
  }

  if (leadType === 'PARENT') {
    if (team === 'sales') {
      return ['INTRO_COMPLETE', 'SCHOOL_OPTIONS_SENT', 'PARENT_DECISION_PENDING', 'ENROLLMENT_CONFIRMED', 'CLOSED_WON', 'CLOSED_LOST']
    }
    if (team === 'marketing') return ['NEW', 'CONTACTED', 'INTERESTED', 'ROUTED', 'LOST', 'REJECTED']
    return ['CONTACTED', 'INTERESTED', 'ROUTED']
  }

  if (team === 'sales') {
    return ['MEETING_SCHEDULED', 'MEETING_CONFIRMED', 'MEETING_DONE', 'PROPOSAL_SENT', 'NEGOTIATION', 'VERBAL_YES', 'CONTRACT_SENT', 'CLOSED_WON', 'CLOSED_LOST']
  }
  if (team === 'marketing') return ['MEETING_ACCEPTED', 'CONTACTED', 'INTERESTED', 'ROUTED', 'LOST', 'REJECTED']
  return ['MEETING_ACCEPTED', 'CONTACTED', 'INTERESTED']
}

export function isConvertedStatus(status: LeadStatus): boolean {
  return status === 'CONVERTED' || status === 'CLOSED_WON' || status === 'APPROVED'
}

export function isLostStatus(status: LeadStatus): boolean {
  return status === 'LOST' || status === 'CLOSED_LOST'
}

export function isRejectedStatus(status: LeadStatus): boolean {
  return status === 'REJECTED'
}

export function getStatusTeamHint(leadType: LeadType, status: LeadStatus): TeamOwner {
  if (leadType === 'TEACHER') {
    if (status === 'SENT_TO_HR' || status === 'UNDER_VERIFICATION' || status === 'APPROVED' || status === 'REJECTED') return 'hr'
    return 'marketing'
  }

  if (leadType === 'PARENT') {
    if (status === 'INTRO_COMPLETE' || status === 'SCHOOL_OPTIONS_SENT' || status === 'PARENT_DECISION_PENDING' || status === 'ENROLLMENT_CONFIRMED' || status === 'CLOSED_WON' || status === 'CLOSED_LOST') {
      return 'sales'
    }
    return 'marketing'
  }

  if (status === 'MEETING_SCHEDULED' || status === 'MEETING_CONFIRMED' || status === 'MEETING_DONE' || status === 'PROPOSAL_SENT' || status === 'NEGOTIATION' || status === 'VERBAL_YES' || status === 'CONTRACT_SENT' || status === 'CLOSED_WON' || status === 'CLOSED_LOST') {
    return 'sales'
  }
  return 'marketing'
}

export function formatTeamOwner(team: string | TeamOwner | null | undefined): string {
  if (!team) return 'Unassigned Team'
  return TEAM_LABELS[team as TeamOwner] ?? team
}

export function getRoutingLabel(leadType: LeadType): string {
  return leadType === 'TEACHER' ? 'Send to HR' : 'Send to Sales'
}

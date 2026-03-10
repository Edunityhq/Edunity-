import type { LeadStatus, LeadType, Role, TeamOwner } from '@/lib/types'
import {
  LEAD_STATUS_LABELS,
  getDefaultStatusForLeadType,
  getInitialOwnerTeam,
  getStatusOptionsForLeadType,
  isConvertedStatus,
  isRejectedStatus,
} from '@/lib/lead-workflows'

export const SCHOOL_LEADS_COLLECTION = 'school_leads'
export const LEAD_ACTIVITY_COLLECTION = 'lead_activity_log'
export const ROUND_ROBIN_STATE_COLLECTION = 'lead_round_robin_state'
export const WEEKLY_LEAD_TARGET = 25

export const COMPANY_LEAD_COLLECTIONS: Record<LeadType, string> = {
  SCHOOL: SCHOOL_LEADS_COLLECTION,
  PARENT: 'parent_requests',
  TEACHER: 'teacher_interests',
}

export const LEAD_STATUS_OPTIONS: LeadStatus[] = Array.from(
  new Set<LeadStatus>([
    ...getStatusOptionsForLeadType('SCHOOL'),
    ...getStatusOptionsForLeadType('PARENT'),
    ...getStatusOptionsForLeadType('TEACHER'),
  ])
)

export const LEAD_TYPE_LABELS: Record<LeadType, string> = {
  SCHOOL: 'Schools',
  PARENT: 'Parents',
  TEACHER: 'Teachers',
}

export const AUTO_ASSIGNMENT_ROLES: Role[] = ['marketing', 'marketing_staff', 'admin']
export const CONTRIBUTION_ROLES: Role[] = ['lead', 'sales', 'marketing', 'marketing_staff', 'ops', 'admin']

export interface CompanyLead {
  id: string
  collectionName: string
  leadType: LeadType
  edunityId: string
  fullName: string
  schoolName: string
  contactPerson: string
  phoneNumber: string
  phoneNumberNormalized: string
  email: string
  location: string
  state: string
  leadSource: string
  createdByUserId: string
  createdByUserName: string
  assignedToUserId: string
  assignedToUserName: string
  currentTeamOwner: TeamOwner | ''
  assignedDepartment: string
  status: LeadStatus
  isValid: boolean
  rejectionReason: string
  referralCode: string
  qualifiedByUserId: string
  routedByUserId: string
  routedByUserName: string
  lastStatusChangedByUserId: string
  duplicateOverrideByUserId: string
  duplicateFlagReason: string
  handoffNote: string
  lastContactSummary: string
  nextActionDate: Date | null
  nextActionNote: string
  pipelineValue: number
  createdAt: Date | null
  updatedAt: Date | null
  probableDuplicate: boolean
  raw: Record<string, unknown>
}

export interface LeadFilters {
  search: string
  leadType: LeadType | 'ALL'
  status: LeadStatus | 'ALL'
  source: string
  assignedToUserId: string
  createdByUserId: string
  assignedTeam: TeamOwner | ''
  dateFrom: string
  dateTo: string
}

export interface ContributionRow {
  userId: string
  userName: string
  leadCount: number
  contributionPct: number
}

export interface ExactDuplicateGroup {
  key: string
  leads: CompanyLead[]
}

function getString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function normalizeText(value: unknown): string {
  return getString(value).toLowerCase()
}

export function normalizePhoneNumber(value: unknown): string {
  return getString(value).replace(/\D/g, '')
}

export function normalizeEmail(value: unknown): string {
  return getString(value).toLowerCase()
}

export function normalizeSchoolName(value: unknown): string {
  return normalizeText(value).replace(/\s+/g, ' ')
}

export function toDate(value: unknown): Date | null {
  if (!value) return null
  if (typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate()
  }
  if (value instanceof Date) return value
  if (typeof value === 'string' || typeof value === 'number') {
    const next = new Date(value)
    return Number.isNaN(next.getTime()) ? null : next
  }
  return null
}

export function getLeadTypeFromCollection(collectionName: string): LeadType {
  const normalized = normalizeText(collectionName)
  if (normalized === COMPANY_LEAD_COLLECTIONS.SCHOOL) return 'SCHOOL'
  if (normalized === COMPANY_LEAD_COLLECTIONS.PARENT) return 'PARENT'
  return 'TEACHER'
}

export function normalizeLeadStatus(value: unknown, leadType?: LeadType): LeadStatus {
  const normalized = normalizeText(value)

  if (!normalized) {
    return getDefaultStatusForLeadType(leadType ?? 'PARENT')
  }

  if (normalized === 'new' || normalized === 'awaiting_documents') return 'NEW'
  if (normalized === 'contacted') return 'CONTACTED'
  if (normalized === 'routed') return 'ROUTED'
  if (
    normalized === 'interested' ||
    normalized === 'matching_in_progress' ||
    normalized === 'documents_submitted' ||
    normalized === 'needs_confirmed'
  ) {
    return 'INTERESTED'
  }
  if (
    normalized === 'meeting_scheduled' ||
    normalized === 'trial_scheduled' ||
    normalized === 'ready_for_screening' ||
    normalized === 'matched'
  ) {
    return 'MEETING_SCHEDULED'
  }
  if (normalized === 'meeting_confirmed') return 'MEETING_CONFIRMED'
  if (normalized === 'meeting_accepted') return 'MEETING_ACCEPTED'
  if (normalized === 'meeting_done') return 'MEETING_DONE'
  if (normalized === 'meeting_completed' || normalized === 'trial_done') return 'MEETING_COMPLETED'
  if (normalized === 'proposal_sent') return 'PROPOSAL_SENT'
  if (normalized === 'negotiation') return 'NEGOTIATION'
  if (normalized === 'verbal_yes') return 'VERBAL_YES'
  if (normalized === 'contract_sent') return 'CONTRACT_SENT'
  if (normalized === 'intro_complete') return 'INTRO_COMPLETE'
  if (normalized === 'school_options_sent') return 'SCHOOL_OPTIONS_SENT'
  if (normalized === 'parent_decision_pending') return 'PARENT_DECISION_PENDING'
  if (normalized === 'enrollment_confirmed') return 'ENROLLMENT_CONFIRMED'
  if (normalized === 'onboarding_completed') return 'ONBOARDING_COMPLETED'
  if (normalized === 'sent_to_hr') return 'SENT_TO_HR'
  if (normalized === 'under_verification') return 'UNDER_VERIFICATION'
  if (normalized === 'approved') return 'APPROVED'
  if (normalized === 'closed_won') return 'CLOSED_WON'
  if (normalized === 'closed_lost') return 'CLOSED_LOST'
  if (normalized === 'converted' || normalized === 'paid' || normalized === 'onboarded') {
    return 'CONVERTED'
  }
  if (normalized === 'rejected') return 'REJECTED'
  if (normalized === 'lost' || normalized === 'closed' || normalized === 'incomplete' || normalized === 'unresponsive') {
    return 'LOST'
  }

  return getDefaultStatusForLeadType(leadType ?? 'PARENT')
}

export function resolveLeadStatus(raw: Record<string, unknown>, leadType: LeadType): LeadStatus {
  const status = normalizeLeadStatus(raw.status ?? raw.leadStatus ?? raw.leadTag, leadType)

  if (
    leadType === 'TEACHER' &&
    status === 'ONBOARDING_COMPLETED' &&
    !getString(raw.leadTag) &&
    !getString(raw.qualifiedByUserId) &&
    !getString(raw.routedByUserId) &&
    !getString(raw.lastContactSummary) &&
    !getString(raw.summary) &&
    !getString(raw.nextActionNote) &&
    !toDate(raw.nextActionDate)
  ) {
    return 'INTERESTED'
  }

  return status
}

function getStatusValidity(status: LeadStatus, raw: Record<string, unknown>): boolean {
  const explicit = raw.isValid
  if (typeof explicit === 'boolean') return explicit
  return !isRejectedStatus(status)
}

function getLeadSource(raw: Record<string, unknown>): string {
  return (
    getString(raw.leadSource) ||
    getString(raw.source) ||
    (getString(raw.referralCode) ? 'referral_link' : '') ||
    'direct'
  )
}

function getTeamOwner(raw: Record<string, unknown>, leadType: LeadType): TeamOwner | '' {
  const current =
    getString(raw.currentTeamOwner) ||
    getString(raw.assignedDepartment) ||
    getString(raw.destinationTeam)
  const normalized = normalizeText(current)
  if (
    normalized === 'lead' ||
    normalized === 'marketing' ||
    normalized === 'sales' ||
    normalized === 'hr' ||
    normalized === 'finance' ||
    normalized === 'ops'
  ) {
    return normalized as TeamOwner
  }
  return getInitialOwnerTeam(leadType)
}

function getNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const next = Number(value.replace(/[^0-9.-]+/g, ''))
    return Number.isFinite(next) ? next : 0
  }
  return 0
}

export function buildCompanyLead(args: {
  id: string
  collectionName: string
  raw: Record<string, unknown>
  assignedToUserId?: string
  assignedToUserName?: string
}): CompanyLead {
  const { id, collectionName, raw } = args
  const leadType = getLeadTypeFromCollection(collectionName)
  const fullName =
    getString(raw.fullName) ||
    getString(raw.parentFullName) ||
    getString(raw.contactPerson) ||
    getString(raw.name) ||
    'Unknown'
  const schoolName = getString(raw.schoolName)
  const contactPerson =
    getString(raw.contactPerson) ||
    getString(raw.parentFullName) ||
    getString(raw.fullName) ||
    fullName
  const phoneNumber =
    getString(raw.phoneNumber) ||
    getString(raw.parentPhone) ||
    getString(raw.phone) ||
    getString(raw.contactPhone)
  const phoneNumberNormalized =
    normalizePhoneNumber(raw.phoneNumberNormalized) ||
    normalizePhoneNumber(raw.parentPhoneNormalized) ||
    normalizePhoneNumber(raw.phoneNormalized) ||
    normalizePhoneNumber(phoneNumber)
  const email =
    normalizeEmail(raw.email) ||
    normalizeEmail(raw.parentEmail) ||
    normalizeEmail(raw.contactEmail)
  const location = [getString(raw.area), getString(raw.lga), getString(raw.state)].filter(Boolean).join(', ')
  const status = resolveLeadStatus(raw, leadType)
  const createdAt =
    toDate(raw.createdAt) ?? toDate(raw.created_at) ?? toDate(raw.submittedAt) ?? toDate(raw.timestamp)
  const updatedAt = toDate(raw.updatedAt) ?? toDate(raw.updated_at) ?? createdAt
  const currentTeamOwner = getTeamOwner(raw, leadType)

  return {
    id,
    collectionName,
    leadType,
    edunityId: getString(raw.edunityId) || getString(raw.edunity_id) || id,
    fullName,
    schoolName,
    contactPerson,
    phoneNumber,
    phoneNumberNormalized,
    email,
    location: location || getString(raw.location) || '-',
    state: getString(raw.state),
    leadSource: getLeadSource(raw),
    createdByUserId: getString(raw.createdByUserId),
    createdByUserName: getString(raw.createdByUserName),
    assignedToUserId: args.assignedToUserId || getString(raw.assignedToUserId),
    assignedToUserName: args.assignedToUserName || getString(raw.assignedToUserName),
    currentTeamOwner,
    assignedDepartment: getString(raw.assignedDepartment) || currentTeamOwner,
    status,
    isValid: getStatusValidity(status, raw),
    rejectionReason: getString(raw.rejectionReason),
    referralCode: getString(raw.referralCode),
    qualifiedByUserId: getString(raw.qualifiedByUserId),
    routedByUserId: getString(raw.routedByUserId),
    routedByUserName: getString(raw.routedByUserName),
    lastStatusChangedByUserId: getString(raw.lastStatusChangedByUserId),
    duplicateOverrideByUserId: getString(raw.duplicateOverrideByUserId),
    duplicateFlagReason: getString(raw.duplicateFlagReason),
    handoffNote: getString(raw.handoffNote) || getString(raw.latestHandoffNote),
    lastContactSummary: getString(raw.lastContactSummary) || getString(raw.summary),
    nextActionDate: toDate(raw.nextActionDate),
    nextActionNote: getString(raw.nextActionNote),
    pipelineValue:
      getNumber(raw.contractValue) ||
      getNumber(raw.proposalAmount) ||
      getNumber(raw.expectedRevenue) ||
      getNumber(raw.enrollmentFee) ||
      getNumber(raw.revenueValue),
    createdAt,
    updatedAt,
    probableDuplicate: Boolean(raw.probableDuplicate),
    raw,
  }
}

export function getLeadDuplicateKeys(lead: CompanyLead): string[] {
  const keys: string[] = []
  if (lead.phoneNumberNormalized) {
    keys.push(`phone:${lead.phoneNumberNormalized}`)
  }
  if (lead.leadType === 'SCHOOL' && lead.schoolName && lead.phoneNumberNormalized) {
    keys.push(`school:${normalizeSchoolName(lead.schoolName)}|${lead.phoneNumberNormalized}`)
  }
  return keys
}

function getLeadQualityScore(lead: CompanyLead): number {
  let score = 0
  if (lead.email) score += 1
  if (lead.location && lead.location !== '-') score += 1
  if (lead.createdByUserId) score += 1
  if (lead.assignedToUserId) score += 2
  if (lead.qualifiedByUserId) score += 2
  if (lead.routedByUserId) score += 2
  if (lead.handoffNote) score += 1
  if (lead.nextActionDate || lead.nextActionNote) score += 1
  if (lead.pipelineValue > 0) score += 1
  if (lead.lastContactSummary) score += 1
  return score
}

export function chooseCanonicalLead(leads: CompanyLead[]): CompanyLead {
  return [...leads].sort((a, b) => {
    const scoreDelta = getLeadQualityScore(b) - getLeadQualityScore(a)
    if (scoreDelta !== 0) return scoreDelta
    return (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0)
  })[0]
}

export function findExactDuplicateGroups(leads: CompanyLead[]): ExactDuplicateGroup[] {
  const byId = new Map<string, CompanyLead>()
  const adjacency = new Map<string, Set<string>>()
  const keyGroups = new Map<string, string[]>()

  for (const lead of leads) {
    const id = `${lead.collectionName}:${lead.id}`
    byId.set(id, lead)
    adjacency.set(id, adjacency.get(id) ?? new Set<string>())

    for (const key of getLeadDuplicateKeys(lead)) {
      const scopedKey = `${lead.collectionName}:${key}`
      const current = keyGroups.get(scopedKey) ?? []
      current.push(id)
      keyGroups.set(scopedKey, current)
    }
  }

  for (const ids of keyGroups.values()) {
    if (ids.length < 2) continue
    const [first, ...rest] = ids
    for (const other of rest) {
      adjacency.get(first)?.add(other)
      adjacency.get(other)?.add(first)
    }
  }

  const groups: ExactDuplicateGroup[] = []
  const seen = new Set<string>()

  for (const id of byId.keys()) {
    if (seen.has(id)) continue
    const stack = [id]
    const component: string[] = []
    while (stack.length > 0) {
      const current = stack.pop() as string
      if (seen.has(current)) continue
      seen.add(current)
      component.push(current)
      for (const next of adjacency.get(current) ?? []) {
        if (!seen.has(next)) stack.push(next)
      }
    }

    if (component.length < 2) continue
    const componentLeads = component
      .map((item) => byId.get(item))
      .filter((lead): lead is CompanyLead => Boolean(lead))

    groups.push({
      key: component.join('|'),
      leads: sortCompanyLeadsByCreatedAt(componentLeads),
    })
  }

  return groups
}

export function markProbableDuplicates(leads: CompanyLead[]): CompanyLead[] {
  const counts = new Map<string, number>()

  for (const lead of leads) {
    for (const key of getLeadDuplicateKeys(lead)) {
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }

  return leads.map((lead) => ({
    ...lead,
    probableDuplicate: getLeadDuplicateKeys(lead).some((key) => (counts.get(key) ?? 0) > 1),
  }))
}

function getLeadSearchValue(lead: CompanyLead): string {
  return [
    lead.fullName,
    lead.schoolName,
    lead.contactPerson,
    lead.phoneNumber,
    lead.email,
    lead.location,
    lead.leadSource,
    lead.edunityId,
  ]
    .join(' ')
    .toLowerCase()
}

export function filterCompanyLeads(leads: CompanyLead[], filters: LeadFilters): CompanyLead[] {
  const search = filters.search.trim().toLowerCase()
  const dateFrom = filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00`) : null
  const dateTo = filters.dateTo ? new Date(`${filters.dateTo}T23:59:59`) : null

  return leads.filter((lead) => {
    if (filters.leadType !== 'ALL' && lead.leadType !== filters.leadType) return false
    if (filters.status !== 'ALL' && lead.status !== filters.status) return false
    if (filters.source && lead.leadSource !== filters.source) return false
    if (filters.assignedToUserId && lead.assignedToUserId !== filters.assignedToUserId) return false
    if (filters.createdByUserId && lead.createdByUserId !== filters.createdByUserId) return false
    if (filters.assignedTeam && lead.currentTeamOwner !== filters.assignedTeam) return false
    if (search && !getLeadSearchValue(lead).includes(search)) return false

    const createdAt = lead.createdAt
    if (dateFrom && (!createdAt || createdAt < dateFrom)) return false
    if (dateTo && (!createdAt || createdAt > dateTo)) return false

    return true
  })
}

export function sortCompanyLeadsByCreatedAt(leads: CompanyLead[]): CompanyLead[] {
  return [...leads].sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
}

export function buildContributionRows(leads: CompanyLead[]): ContributionRow[] {
  const counts = new Map<string, ContributionRow>()
  const total = leads.length

  for (const lead of leads) {
    const userId = lead.createdByUserId || 'unattributed'
    const userName = lead.createdByUserName || 'Unattributed'
    const current = counts.get(userId) ?? {
      userId,
      userName,
      leadCount: 0,
      contributionPct: 0,
    }
    current.leadCount += 1
    counts.set(userId, current)
  }

  return Array.from(counts.values())
    .map((row) => ({
      ...row,
      contributionPct: total > 0 ? Number(((row.leadCount / total) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.leadCount - a.leadCount)
}

export function buildWeeklyTrend(leads: CompanyLead[], days = 7) {
  const today = new Date()
  const buckets = Array.from({ length: days }, (_, index) => {
    const date = new Date(today)
    date.setHours(0, 0, 0, 0)
    date.setDate(date.getDate() - (days - index - 1))
    return {
      key: date.toISOString().slice(0, 10),
      label: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      total: 0,
      valid: 0,
      rejected: 0,
    }
  })

  const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]))

  for (const lead of leads) {
    if (!lead.createdAt) continue
    const key = lead.createdAt.toISOString().slice(0, 10)
    const bucket = byKey.get(key)
    if (!bucket) continue
    bucket.total += 1
    if (lead.status === 'REJECTED') {
      bucket.rejected += 1
    } else if (lead.isValid) {
      bucket.valid += 1
    }
  }

  return buckets
}

export function calculateLeadSummary(leads: CompanyLead[], currentUserId: string) {
  const now = Date.now()
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const yesterdayStart = new Date(todayStart)
  yesterdayStart.setDate(yesterdayStart.getDate() - 1)
  const weekStart = new Date(todayStart)
  weekStart.setDate(weekStart.getDate() - 6)
  const monthStart = new Date(todayStart)
  monthStart.setDate(1)

  let addedToday = 0
  let addedYesterday = 0
  let validLeads = 0
  let rejectedLeads = 0
  let weeklyProgress = 0
  let monthlyOverview = 0
  let myLeads = 0
  let myAssignedLeads = 0
  let converted = 0
  let revenueClosed = 0
  let revenuePipeline = 0
  let followUpsDueToday = 0
  let routed = 0
  const byType: Record<LeadType, number> = { SCHOOL: 0, PARENT: 0, TEACHER: 0 }

  for (const lead of leads) {
    const createdAt = lead.createdAt?.getTime() ?? 0
    byType[lead.leadType] += 1

    if (createdAt >= todayStart.getTime()) addedToday += 1
    if (createdAt >= yesterdayStart.getTime() && createdAt < todayStart.getTime()) addedYesterday += 1
    if (createdAt >= weekStart.getTime()) weeklyProgress += 1
    if (createdAt >= monthStart.getTime()) monthlyOverview += 1
    if (lead.isValid) validLeads += 1
    if (isRejectedStatus(lead.status)) rejectedLeads += 1
    if (lead.status === 'ROUTED' || lead.routedByUserId) routed += 1
    if (isConvertedStatus(lead.status)) {
      converted += 1
      revenueClosed += lead.pipelineValue
    } else {
      revenuePipeline += lead.pipelineValue
    }
    if (lead.createdByUserId && lead.createdByUserId === currentUserId) myLeads += 1
    if (lead.assignedToUserId && lead.assignedToUserId === currentUserId) myAssignedLeads += 1
    if (lead.nextActionDate) {
      const nextActionTime = lead.nextActionDate.getTime()
      if (nextActionTime >= todayStart.getTime() && nextActionTime < todayStart.getTime() + 24 * 60 * 60 * 1000) {
        followUpsDueToday += 1
      }
    }
  }

  const totalLeads = leads.length
  const myContributionPct = totalLeads > 0 ? Number(((myLeads / totalLeads) * 100).toFixed(1)) : 0
  const dayDelta = addedToday - addedYesterday
  const dayDeltaPct =
    addedYesterday > 0 ? Number((((addedToday - addedYesterday) / addedYesterday) * 100).toFixed(1)) : addedToday * 100

  return {
    totalLeads,
    addedToday,
    validLeads,
    rejectedLeads,
    weeklyProgress,
    weeklyTarget: WEEKLY_LEAD_TARGET,
    dayDelta,
    dayDeltaPct,
    monthlyOverview,
    byType,
    myLeads,
    myContributionPct,
    myAssignedLeads,
    converted,
    routed,
    revenueClosed,
    revenuePipeline,
    followUpsDueToday,
    conversionRate: totalLeads > 0 ? Number(((converted / totalLeads) * 100).toFixed(1)) : 0,
    checkedAt: now,
  }
}

export function formatLeadStatus(status: LeadStatus): string {
  return LEAD_STATUS_LABELS[status]
}

export function roleCanViewAllLeads(role: Role): boolean {
  return role === 'admin' || role === 'finance' || role === 'hr' || role === 'ops'
}

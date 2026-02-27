'use client'

export type ParentStage =
  | 'NEW'
  | 'CONTACTED'
  | 'NEEDS_CONFIRMED'
  | 'TRIAL_SCHEDULED'
  | 'TRIAL_DONE'
  | 'OFFER_SENT'
  | 'PAID'
  | 'ONBOARDED'
  | 'LOST'
  | 'UNRESPONSIVE'

export type LeadTemperature = 'COLD' | 'WARM' | 'HOT'
export type Priority = 'LOW' | 'NORMAL' | 'HIGH'
export type Urgency = 'LOW' | 'MED' | 'HIGH'
export type LearningMode = 'Home' | 'Online' | 'Center'
export type FollowUpType = 'Call' | 'WhatsApp' | 'Email'
export type FollowUpOutcome =
  | 'No answer'
  | 'Replied'
  | 'Needs gathered'
  | 'Trial booked'
  | 'Trial done'
  | 'Offer sent'
  | 'Paid'
  | 'Not interested'

export interface Agent {
  id: string
  name: string
  initials: string
}

export interface FollowUpLog {
  id: string
  type: FollowUpType
  outcome: FollowUpOutcome
  objection?: 'Price' | 'Timing' | 'Trust' | 'Already has tutor' | 'Other'
  notes: string
  nextFollowUpAt?: string
  createdAt: string
  createdBy: string
}

export interface LeadAudit {
  id: string
  type: 'ASSIGNMENT_CHANGED' | 'STAGE_CHANGED' | 'FOLLOW_UP_CREATED'
  message: string
  createdAt: string
  createdBy: string
}

export interface ParentLead {
  id: string
  parentFullName: string
  phoneNumber: string
  email: string
  preferredContact: 'WhatsApp' | 'Call'
  state: string
  lga: string
  area: string
  studentClass: string
  subjectsNeeded: string[]
  examFocus: string[]
  learningMode: LearningMode
  availability: string
  budgetRange: string
  startTimeframe: 'ASAP' | 'This week' | 'Flexible'
  urgency: Urgency
  leadTemperature: LeadTemperature
  notes: string
  stage: ParentStage
  assignedTo: string
  assignedBy: string
  assignedAt: string
  priority: Priority
  lastActivityAt: string
  nextFollowUpAt?: string
  followUps: FollowUpLog[]
  activity: LeadAudit[]
}

export const STAGES: ParentStage[] = [
  'NEW',
  'CONTACTED',
  'NEEDS_CONFIRMED',
  'TRIAL_SCHEDULED',
  'TRIAL_DONE',
  'OFFER_SENT',
  'PAID',
  'ONBOARDED',
  'LOST',
  'UNRESPONSIVE',
]

export const AGENTS: Agent[] = [
  { id: 'agent_1', name: 'Aisha Bello', initials: 'AB' },
  { id: 'agent_2', name: 'Kunle Adeyemi', initials: 'KA' },
  { id: 'agent_3', name: 'Ngozi Nwosu', initials: 'NN' },
  { id: 'agent_4', name: 'Tunde Balogun', initials: 'TB' },
  { id: 'agent_5', name: 'Mariam Yusuf', initials: 'MY' },
  { id: 'agent_6', name: 'Femi Okon', initials: 'FO' },
]

const names = [
  'Chidinma Okeke',
  'Bassey Udoh',
  'Fatima Lawal',
  'Ifeanyi Eze',
  'Kehinde Salami',
  'Yewande Adebayo',
  'Maryam Aliyu',
  'Ejiro Oghene',
  'Amina Abdullahi',
  'Tayo Ogunleye',
  'Mfon Akpan',
  'Deborah Nnaji',
  'Sadiq Ibrahim',
  'Olamide Aluko',
  'Nnenna Kalu',
  'Uchenna Madu',
  'Rasheedat Bello',
  'Godwin Etim',
  'Blessing Udo',
  'Ridwan Ojo',
  'Funke Akinola',
  'Halima Musa',
  'Prince Ekanem',
  'Adaobi Nnanna',
  'Samuel Bamidele',
  'Rukayat Jimoh',
  'Yusuf Dantata',
  'Temitope Aina',
  'Ese Brume',
  'Jennifer Umeh',
  'Bolanle Sola',
  'Chukwuemeka Obi',
  'Azeezat Kareem',
  'Favour Ojukwu',
  'Ibrahim Sule',
  'Osas Ighodaro',
]

const locations = [
  ['Lagos', 'Eti-Osa', 'Lekki'],
  ['Lagos', 'Ikeja', 'Alausa'],
  ['Lagos', 'Surulere', 'Bode Thomas'],
  ['Oyo', 'Ibadan North', 'Bodija'],
  ['Oyo', 'Akinyele', 'Moniya'],
  ['FCT', 'Municipal', 'Wuse 2'],
  ['FCT', 'Bwari', 'Kubwa'],
  ['Rivers', 'Port Harcourt', 'GRA'],
  ['Rivers', 'Obio-Akpor', 'Rumuola'],
  ['Enugu', 'Enugu North', 'New Haven'],
  ['Anambra', 'Awka South', 'Aroma'],
  ['Delta', 'Udu', 'Ovwian'],
  ['Kaduna', 'Chikun', 'Narayi'],
  ['Kano', 'Nassarawa', 'Bompai'],
  ['Ogun', 'Abeokuta South', 'Ibara'],
]

const subjects = [
  'Mathematics',
  'English',
  'Physics',
  'Chemistry',
  'Biology',
  'Further Mathematics',
  'Economics',
  'Government',
  'Literature',
  'ICT',
]

const classes = ['Primary 5', 'JSS 2', 'JSS 3', 'SSS 1', 'SSS 2', 'SSS 3']
const budgets = ['80k-120k', '120k-180k', '180k-250k', '250k+']

function isoHoursAgo(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
}

export function getSeedParentLeads(): ParentLead[] {
  return Array.from({ length: 36 }).map((_, i) => {
    const location = locations[i % locations.length]
    const assigned = AGENTS[i % AGENTS.length]
    const stage = STAGES[i % STAGES.length]
    const lastActivityAt = isoHoursAgo((i % 11) * 7 + 2)
    const hasNextFollow = i % 4 !== 0
    const nextFollowUpAt = hasNextFollow ? isoHoursAgo(-((i % 5) * 12 + 8)) : undefined

    return {
      id: `parent_lead_${i + 1}`,
      parentFullName: names[i % names.length],
      phoneNumber: `+23480${String(11000000 + i * 17).slice(0, 8)}`,
      email: `${names[i % names.length].toLowerCase().replace(/\s+/g, '.')}@gmail.com`,
      preferredContact: i % 2 === 0 ? 'WhatsApp' : 'Call',
      state: location[0],
      lga: location[1],
      area: location[2],
      studentClass: classes[i % classes.length],
      subjectsNeeded: [subjects[i % subjects.length], subjects[(i + 3) % subjects.length], subjects[(i + 5) % subjects.length]].slice(0, (i % 3) + 1),
      examFocus: i % 3 === 0 ? ['WAEC', 'JAMB'] : i % 3 === 1 ? ['NECO'] : [],
      learningMode: i % 3 === 0 ? 'Home' : i % 3 === 1 ? 'Online' : 'Center',
      availability: i % 2 === 0 ? 'Weekday evenings' : 'Weekends',
      budgetRange: budgets[i % budgets.length],
      startTimeframe: i % 3 === 0 ? 'ASAP' : i % 3 === 1 ? 'This week' : 'Flexible',
      urgency: i % 3 === 0 ? 'HIGH' : i % 3 === 1 ? 'MED' : 'LOW',
      leadTemperature: i % 3 === 0 ? 'HOT' : i % 3 === 1 ? 'WARM' : 'COLD',
      notes: i % 2 === 0 ? 'Parent asked for trial class this week.' : 'Parent is comparing options and requested more tutor profiles.',
      stage,
      assignedTo: assigned.id,
      assignedBy: 'Amara Adeyemi',
      assignedAt: isoHoursAgo((i % 10) * 9 + 4),
      priority: i % 4 === 0 ? 'HIGH' : i % 4 === 1 ? 'NORMAL' : 'LOW',
      lastActivityAt,
      nextFollowUpAt,
      followUps: [
        {
          id: `fu_${i + 1}_1`,
          type: i % 2 === 0 ? 'WhatsApp' : 'Call',
          outcome: i % 3 === 0 ? 'Replied' : 'No answer',
          notes: i % 2 === 0 ? 'Shared tutor options and requested availability.' : 'No response, will retry later.',
          nextFollowUpAt,
          createdAt: lastActivityAt,
          createdBy: assigned.name,
        },
      ],
      activity: [
        {
          id: `act_${i + 1}_1`,
          type: 'ASSIGNMENT_CHANGED',
          message: `Assigned to ${assigned.name}`,
          createdAt: isoHoursAgo((i % 10) * 12 + 6),
          createdBy: 'Amara Adeyemi',
        },
      ],
    }
  })
}

export interface TeacherLead {
  id: string
  fullName: string
  email: string
  phone: string
  state: string
  lga: string
  area: string
  subjects: string[]
  examFocus: string[]
  availability: string
  lessonType: string
  privateTutoring: string
  teachingExperience: string
  createdAt: string
  source: 'mock' | 'teacher_form'
}

const teacherNames = [
  'David Akin',
  'Zoe Nnamdi',
  'Tope Lawanson',
  'Ibrahim Kabiru',
  'Rita Ekpeyong',
  'Grace Eze',
  'Jide Olatunji',
  'Joy Ekanem',
]

export function getSeedTeacherLeads(): TeacherLead[] {
  return teacherNames.map((name, i) => {
    const location = locations[(i + 3) % locations.length]
    return {
      id: `teacher_seed_${i + 1}`,
      fullName: name,
      email: `${name.toLowerCase().replace(/\s+/g, '.')}@mail.com`,
      phone: `+23481${String(22000000 + i * 91).slice(0, 8)}`,
      state: location[0],
      lga: location[1],
      area: location[2],
      subjects: [subjects[(i + 1) % subjects.length], subjects[(i + 2) % subjects.length]],
      examFocus: i % 2 === 0 ? ['WAEC'] : ['NECO', 'JAMB'],
      availability: i % 2 === 0 ? 'Part-time' : 'Flexible',
      lessonType: i % 2 === 0 ? 'online' : 'both',
      privateTutoring: i % 3 === 0 ? 'yes' : 'maybe',
      teachingExperience: 'Experienced in secondary and exam prep tutoring.',
      createdAt: isoHoursAgo((i + 1) * 20),
      source: 'mock',
    }
  })
}

import type { Teacher, Request, Verification, Payout, School, Ticket, TeamMember, Activity } from '../types';

export const mockTeachers: Teacher[] = [
  {
    id: '1',
    name: 'Chioma Adeyemi',
    subject: 'Mathematics',
    location: 'Lagos',
    examFocus: 'WAEC',
    rating: 4.8,
    hourlyRate: 5000,
    availability: 'Available',
    verified: true,
    joinedDate: '2023-01-15',
    totalHours: 245,
  },
  {
    id: '2',
    name: 'Tunde Okafor',
    subject: 'English',
    location: 'Abuja',
    examFocus: 'JAMB',
    rating: 4.6,
    hourlyRate: 4500,
    availability: 'Limited',
    verified: true,
    joinedDate: '2023-02-20',
    totalHours: 156,
  },
  {
    id: '3',
    name: 'Fatima Hassan',
    subject: 'Chemistry',
    location: 'Kano',
    examFocus: 'NECO',
    rating: 4.7,
    hourlyRate: 5500,
    availability: 'Available',
    verified: false,
    joinedDate: '2024-01-10',
    totalHours: 89,
  },
];

export const mockRequests: Request[] = [
  {
    id: 'REQ001',
    requester: 'Oluwaseun Adekunle',
    location: 'Lagos',
    subject: 'Physics',
    examFocus: 'JAMB',
    status: 'assigned',
    priority: 'high',
    createdDate: '2025-02-01',
    dueDate: '2025-02-15',
    assignedTo: 'Chioma Adeyemi',
  },
  {
    id: 'REQ002',
    requester: 'Zainab Ibrahim',
    location: 'Ibadan',
    subject: 'Biology',
    examFocus: 'WAEC',
    status: 'pending',
    priority: 'medium',
    createdDate: '2025-02-10',
    dueDate: '2025-02-20',
  },
  {
    id: 'REQ003',
    requester: 'Ikechukwu Nwankwo',
    location: 'Port Harcourt',
    subject: 'Mathematics',
    examFocus: 'NECO',
    status: 'in-progress',
    priority: 'urgent',
    createdDate: '2025-02-08',
    dueDate: '2025-02-13',
    assignedTo: 'Tunde Okafor',
  },
];

export const mockVerifications: Verification[] = [
  {
    id: 'VER001',
    name: 'Chioma Adeyemi',
    docType: 'Certificate',
    status: 'pending',
    uploadDate: '2025-02-10',
    expiryDate: '2026-02-10',
    notes: 'Awaiting review',
  },
  {
    id: 'VER002',
    name: 'Tunde Okafor',
    docType: 'ID',
    status: 'approved',
    uploadDate: '2024-12-15',
    expiryDate: '2027-12-15',
    notes: 'Verified',
  },
  {
    id: 'VER003',
    name: 'Fatima Hassan',
    docType: 'Insurance',
    status: 'rejected',
    uploadDate: '2025-02-05',
    expiryDate: '2025-08-05',
    notes: 'Coverage amount insufficient',
  },
];

export const mockPayouts: Payout[] = [
  {
    id: 'PAY001',
    tutor: 'Chioma Adeyemi',
    amount: 125000,
    status: 'paid',
    period: 'Jan 2025',
    payoutDate: '2025-02-08',
  },
  {
    id: 'PAY002',
    tutor: 'Tunde Okafor',
    amount: 87500,
    status: 'pending',
    period: 'Feb 2025',
    payoutDate: '2025-02-15',
  },
  {
    id: 'PAY003',
    tutor: 'Fatima Hassan',
    amount: 45000,
    status: 'pending',
    period: 'Feb 2025',
    payoutDate: '2025-02-20',
  },
];

export const mockSchools: School[] = [
  {
    id: 'SCH001',
    name: 'Rainbow Secondary School',
    location: 'Lagos',
    contactPerson: 'Mrs. Adebayo',
    pipeline: 'proposal',
    requestCount: 5,
    lastTouched: '2025-02-10',
  },
  {
    id: 'SCH002',
    name: 'Excellence Academy',
    location: 'Abuja',
    contactPerson: 'Mr. Okoro',
    pipeline: 'active',
    requestCount: 12,
    lastTouched: '2025-02-08',
  },
  {
    id: 'SCH003',
    name: 'Future Leaders School',
    location: 'Kano',
    contactPerson: 'Hajiya Musa',
    pipeline: 'lead',
    requestCount: 3,
    lastTouched: '2025-02-11',
  },
];

export const mockTickets: Ticket[] = [
  {
    id: 1,
    subject: 'Payment issue with teacher registration',
    status: 'in-progress',
    priority: 'urgent',
    category: 'Payment',
    createdAt: '2025-02-10',
  },
  {
    id: 2,
    subject: 'Request not matching properly',
    status: 'open',
    priority: 'high',
    category: 'Matching',
    createdAt: '2025-02-11',
  },
  {
    id: 3,
    subject: 'Teacher profile verification delayed',
    status: 'resolved',
    priority: 'medium',
    category: 'Verification',
    createdAt: '2025-02-08',
  },
];

export const mockStaff: TeamMember[] = [];

export const mockMatches: any[] = [
  {
    id: 1,
    tutor: 'Chioma Adeyemi',
    request: 'Physics - JAMB',
    score: 94,
    status: 'contacted',
    distance: '2.3km',
  },
  {
    id: 2,
    tutor: 'Tunde Okafor',
    request: 'English - WAEC',
    score: 87,
    status: 'proposed',
    distance: '5.1km',
  },
  {
    id: 3,
    tutor: 'Fatima Hassan',
    request: 'Chemistry - NECO',
    score: 91,
    status: 'accepted',
    distance: '3.8km',
  },
];

export const mockActivity: Activity[] = [
  {
    id: 'ACT001',
    user: 'Chioma Adeyemi',
    action: 'completed',
    target: 'JAMB Physics session',
    timestamp: '2025-02-11T14:30:00',
  },
  {
    id: 'ACT002',
    user: 'Tunde Okafor',
    action: 'verified',
    target: 'teaching certificate',
    timestamp: '2025-02-11T12:15:00',
  },
  {
    id: 'ACT003',
    user: 'Zainab Ibrahim',
    action: 'requested',
    target: 'Biology tutor',
    timestamp: '2025-02-11T10:45:00',
  },
  {
    id: 'ACT004',
    user: 'Rainbow Secondary School',
    action: 'signed contract',
    target: 'partnership agreement',
    timestamp: '2025-02-10T16:20:00',
  },
  {
    id: 'ACT005',
    user: 'Finance Team',
    action: 'processed',
    target: 'payout to 5 tutors',
    timestamp: '2025-02-10T09:00:00',
  },
];

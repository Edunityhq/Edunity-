// Role types
export type Role = 'admin' | 'marketing_staff';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: Role;
  department?: string;
  phone?: string;
  status?: 'active' | 'suspended';
}

// Task and Audit types
export interface Task {
  id: string;
  title: string;
  description: string;
  assignedTo: string;
  assignedBy: string;
  dueDate: string;
  status: 'pending' | 'in-progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
  completedAt?: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: 'create' | 'update' | 'delete' | 'login' | 'logout' | 'suspend' | 'activate';
  resource: 'staff' | 'task' | 'settings' | 'auth' | 'audit';
  resourceId: string;
  resourceName: string;
  details?: string;
  timestamp: string;
  ipAddress?: string;
}

// Domain types
export interface Teacher {
  id: string;
  name: string;
  subject: string;
  location: string;
  examFocus: 'WAEC' | 'JAMB' | 'NECO' | 'All';
  rating: number;
  hourlyRate: number;
  availability: 'Available' | 'Limited' | 'Full';
  verified: boolean;
  joinedDate: string;
  totalHours: number;
}

export interface Request {
  id: string;
  requester: string;
  location: string;
  subject: string;
  examFocus: 'WAEC' | 'JAMB' | 'NECO';
  status: 'pending' | 'assigned' | 'in-progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  createdDate: string;
  dueDate: string;
  assignedTo?: string;
}

export interface Verification {
  id: string;
  name: string;
  docType: 'ID' | 'Certificate' | 'Insurance' | 'Reference';
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  uploadDate: string;
  expiryDate?: string;
  notes?: string;
}

export interface Payout {
  id: string;
  tutorName: string;
  amount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  requestDate: string;
  completedDate?: string;
  bankName: string;
  accountNumber: string;
}

export interface School {
  id: string;
  name: string;
  location: string;
  contactPerson: string;
  contactEmail: string;
  stage: 'prospect' | 'qualification' | 'proposal' | 'negotiation' | 'closed';
  studentsCount: number;
  lastTouched: string;
  nextAction: string;
}

export interface Ticket {
  id: string;
  subject: string;
  status: 'open' | 'in-progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignedTo: string;
  createdDate: string;
  lastUpdated: string;
  tags: string[];
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: 'active' | 'inactive';
  joinedDate: string;
  lastActive: string;
}

export interface Activity {
  id: string;
  user: string;
  action: string;
  target: string;
  timestamp: string;
  details?: string;
}

export interface KPI {
  label: string;
  value: string | number;
  unit?: string;
  change?: number;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon?: string;
}

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  roles: Role[];
  badge?: number;
}

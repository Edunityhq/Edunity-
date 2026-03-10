import type { NavItem, Role } from '../types'

export const rolePermissions: Record<Role, { label: string; priority: number }> = {
  admin: { label: 'Admin', priority: 8 },
  lead: { label: 'Lead', priority: 7 },
  sales: { label: 'Sales', priority: 6 },
  marketing: { label: 'Marketing', priority: 5 },
  finance: { label: 'Finance', priority: 4 },
  hr: { label: 'HR', priority: 3 },
  ops: { label: 'Ops', priority: 2 },
  marketing_staff: { label: 'Marketing', priority: 1 },
}

export interface NavSection {
  section: string
  items: NavItem[]
}

const ADMIN_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: 'LayoutDashboard', roles: ['admin'] },
  { label: 'Onboarding', href: '/onboard', icon: 'GraduationCap', roles: ['admin'] },
  { label: 'Requests', href: '/onboard/requests', icon: 'ClipboardList', roles: ['admin'] },
  { label: 'Schools', href: '/onboard/schools', icon: 'School', roles: ['admin'] },
  { label: 'Staff', href: '/staff/people', icon: 'UsersRound', roles: ['admin'] },
  { label: 'Admin', href: '/admin', icon: 'ShieldCheck', roles: ['admin'] },
  { label: 'Audit', href: '/admin/audit', icon: 'ScrollText', roles: ['admin'] },
]

const TEAM_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: 'LayoutDashboard',
    roles: ['lead', 'sales', 'marketing', 'finance', 'hr', 'ops', 'marketing_staff'],
  },
  {
    label: 'Schools',
    href: '/onboard/schools',
    icon: 'School',
    roles: ['lead', 'sales', 'ops'],
  },
]

export function getNavigationForRole(role: Role): NavSection[] {
  if (role === 'admin') {
    return [
      {
        section: 'Admin Workspace',
        items: ADMIN_ITEMS,
      },
    ]
  }

  return [
    {
      section: 'Team Workspace',
      items: TEAM_ITEMS.filter((item) => item.roles.includes(role)),
    },
  ]
}

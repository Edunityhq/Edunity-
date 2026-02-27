import type { NavItem, Role } from '../types'

export const rolePermissions: Record<Role, { label: string; priority: number }> = {
  admin: { label: 'Admin', priority: 2 },
  marketing_staff: { label: 'User', priority: 1 },
}

export interface NavSection {
  section: string
  items: NavItem[]
}

const ADMIN_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: 'LayoutDashboard', roles: ['admin'] },
  { label: 'Onboarding', href: '/onboard', icon: 'GraduationCap', roles: ['admin'] },
  { label: 'Requests', href: '/onboard/requests', icon: 'ClipboardList', roles: ['admin'] },
  { label: 'Staff', href: '/staff/people', icon: 'UsersRound', roles: ['admin'] },
  { label: 'Admin', href: '/admin', icon: 'ShieldCheck', roles: ['admin'] },
]

const MARKETING_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: 'LayoutDashboard', roles: ['marketing_staff'] },
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
      section: 'User Workspace',
      items: MARKETING_ITEMS,
    },
  ]
}

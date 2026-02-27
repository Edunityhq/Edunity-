import type { Role } from '@/lib/types'

export interface MockUser {
  id: string
  name: string
  username: string
  email: string
  password: string
  role: Role
  department: string
  phone: string
  status: 'active' | 'suspended'
  joinDate: string
  avatar: string
}

const STORAGE_KEY = 'edunity_users_v2'
const LEGACY_DEFAULT_PASSWORDS = new Set(['password123', 'Eduntiy', 'eduntiy'])
const DEFAULT_ADMIN_PASSWORD = 'Edunity'
const DEFAULT_STAFF_PASSWORD = 'Edunity'
const LEGACY_SEED_USER_IDS = new Set(['user_staff_helen', 'user_staff_joel', 'user_staff_odunayo'])

const SEED_USERS: MockUser[] = [
  {
    id: 'user_admin',
    name: 'Edunity Admin',
    username: 'Edunity',
    email: 'admin@edunity.com',
    password: DEFAULT_ADMIN_PASSWORD,
    role: 'admin',
    department: 'Administration',
    phone: '-',
    status: 'active',
    joinDate: '2026-01-01',
    avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Edunity%20Admin',
  },
]

export const MOCK_USERS: MockUser[] = SEED_USERS
export const DEFAULT_PASSWORDS = {
  admin: DEFAULT_ADMIN_PASSWORD,
  staff: DEFAULT_STAFF_PASSWORD,
}

function canUseStorage() {
  return typeof window !== 'undefined'
}

function normalizeIdentifier(value: string): string {
  return value.trim().toLowerCase()
}

function normalizeUsername(value: string): string {
  return value.trim().replace(/\s+/g, '')
}

function roleDepartment(role: Role): string {
  return role === 'admin' ? 'Administration' : 'Operations'
}

function toUsername(name: string): string {
  return name.trim().replace(/\s+/g, '')
}

function createAvatar(name: string): string {
  return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function persistUsers(users: MockUser[]) {
  if (!canUseStorage()) return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(users))
}

function sanitizeUser(input: Partial<MockUser>): MockUser | null {
  const name = typeof input.name === 'string' && input.name.trim() ? input.name.trim() : ''
  const usernameSource =
    typeof input.username === 'string' && input.username.trim()
      ? input.username
      : typeof input.email === 'string' && input.email.includes('@')
        ? input.email.split('@')[0]
        : name
  const username = normalizeUsername(usernameSource || '')
  if (!name || !username) return null

  const role: Role = input.role === 'admin' ? 'admin' : 'marketing_staff'
  const email =
    typeof input.email === 'string' && input.email.trim()
      ? normalizeIdentifier(input.email)
      : `${normalizeIdentifier(username)}@edunity.com`
  const password =
    typeof input.password === 'string' && input.password.trim()
      ? input.password
      : role === 'admin'
        ? DEFAULT_ADMIN_PASSWORD
        : DEFAULT_STAFF_PASSWORD

  return {
    id: typeof input.id === 'string' && input.id.trim() ? input.id : `user_${Date.now()}`,
    name,
    username,
    email,
    password,
    role,
    department:
      typeof input.department === 'string' && input.department.trim()
        ? input.department
        : roleDepartment(role),
    phone: typeof input.phone === 'string' && input.phone.trim() ? input.phone : '-',
    status: input.status === 'suspended' ? 'suspended' : 'active',
    joinDate:
      typeof input.joinDate === 'string' && input.joinDate.trim() ? input.joinDate : todayIsoDate(),
    avatar:
      typeof input.avatar === 'string' && input.avatar.trim() ? input.avatar : createAvatar(name),
  }
}

function withDefaultUsers(users: MockUser[]): MockUser[] {
  const byId = new Map<string, MockUser>()

  for (const user of users) {
    if (LEGACY_SEED_USER_IDS.has(user.id)) continue
    byId.set(user.id, user)
  }

  for (const seed of SEED_USERS) {
    const existingById = byId.get(seed.id)
    const existingByUsername = users.find(
      (user) => normalizeIdentifier(user.username) === normalizeIdentifier(seed.username)
    )
    const existingByEmail = users.find(
      (user) => normalizeIdentifier(user.email) === normalizeIdentifier(seed.email)
    )
    const existing = existingById ?? existingByUsername ?? existingByEmail

    if (!existing) {
      byId.set(seed.id, seed)
      continue
    }

    const shouldRebasePassword =
      !existing.password || LEGACY_DEFAULT_PASSWORDS.has(existing.password.trim())
    byId.set(seed.id, {
      ...existing,
      id: seed.id,
      name: existing.name || seed.name,
      username: seed.username,
      email: seed.email,
      role: seed.role,
      department: roleDepartment(seed.role),
      password: shouldRebasePassword ? seed.password : existing.password,
      avatar: existing.avatar || seed.avatar,
      phone: existing.phone || '-',
      joinDate: existing.joinDate || seed.joinDate,
      status: existing.status === 'suspended' ? 'suspended' : 'active',
    })
  }

  const unique: MockUser[] = []
  const seenUsername = new Set<string>()
  const seenEmail = new Set<string>()

  for (const user of byId.values()) {
    if (
      user.id === 'user_marketing_1' ||
      normalizeIdentifier(user.email) === 'marketing@edunity.com'
    ) {
      continue
    }

    const usernameKey = normalizeIdentifier(user.username)
    const emailKey = normalizeIdentifier(user.email)
    if (seenUsername.has(usernameKey) || seenEmail.has(emailKey)) continue
    seenUsername.add(usernameKey)
    seenEmail.add(emailKey)
    unique.push(user)
  }

  unique.sort((a, b) => {
    if (a.role === b.role) return a.name.localeCompare(b.name)
    return a.role === 'admin' ? -1 : 1
  })

  return unique
}

export function getUsers(): MockUser[] {
  if (!canUseStorage()) return SEED_USERS
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    persistUsers(SEED_USERS)
    return SEED_USERS
  }
  try {
    const parsed = JSON.parse(raw) as Array<Partial<MockUser>>
    if (!Array.isArray(parsed) || parsed.length === 0) {
      persistUsers(SEED_USERS)
      return SEED_USERS
    }

    const sanitized = parsed
      .map((user) => sanitizeUser(user))
      .filter((user): user is MockUser => Boolean(user))
    const normalized = withDefaultUsers(sanitized)
    persistUsers(normalized)
    return normalized
  } catch {
    persistUsers(SEED_USERS)
    return SEED_USERS
  }
}

export function createUser(input: {
  name: string
  username?: string
  email?: string
  password?: string
  role: Role
}): MockUser {
  const users = getUsers()
  const name = input.name.trim()
  const username = normalizeUsername(input.username?.trim() || toUsername(name))
  if (!name || !username) {
    throw new Error('Name and username are required.')
  }

  const normalizedUsername = normalizeIdentifier(username)
  const normalizedEmail = normalizeIdentifier(input.email?.trim() || `${normalizedUsername}@edunity.com`)
  if (users.some((u) => normalizeIdentifier(u.email) === normalizedEmail)) {
    throw new Error('A user with this email already exists.')
  }
  if (users.some((u) => normalizeIdentifier(u.username) === normalizedUsername)) {
    throw new Error('A user with this username already exists.')
  }

  const next: MockUser = {
    id: `user_${Date.now()}`,
    name,
    username,
    email: normalizedEmail,
    password:
      typeof input.password === 'string' && input.password.trim()
        ? input.password
        : input.role === 'admin'
          ? DEFAULT_ADMIN_PASSWORD
          : DEFAULT_STAFF_PASSWORD,
    role: input.role,
    department: roleDepartment(input.role),
    phone: '-',
    status: 'active',
    joinDate: todayIsoDate(),
    avatar: createAvatar(name),
  }

  const updated = [next, ...users]
  persistUsers(updated)
  return next
}

export function deleteUser(userId: string): void {
  const users = getUsers()
  const target = users.find((user) => user.id === userId)
  if (!target) throw new Error('User not found.')
  if (target.id === 'user_admin') throw new Error('Primary admin account cannot be deleted.')

  const updated = users.filter((user) => user.id !== userId)
  persistUsers(updated)
}

export function resetUserPassword(userId: string): MockUser {
  const users = getUsers()
  const idx = users.findIndex((user) => user.id === userId)
  if (idx === -1) throw new Error('User not found.')
  const target = users[idx]
  const resetPassword = target.role === 'admin' ? DEFAULT_ADMIN_PASSWORD : DEFAULT_STAFF_PASSWORD
  const updatedUser: MockUser = { ...target, password: resetPassword }

  const next = [...users]
  next[idx] = updatedUser
  persistUsers(next)
  return updatedUser
}

export function changeUserPassword(
  userId: string,
  currentPassword: string,
  nextPassword: string
): MockUser {
  const users = getUsers()
  const idx = users.findIndex((user) => user.id === userId)
  if (idx === -1) throw new Error('User not found.')
  const target = users[idx]
  if (target.password !== currentPassword) throw new Error('Current password is incorrect.')
  if (!nextPassword.trim()) throw new Error('New password cannot be empty.')

  const updatedUser: MockUser = { ...target, password: nextPassword }
  const next = [...users]
  next[idx] = updatedUser
  persistUsers(next)
  return updatedUser
}

export function findUserByIdentifier(identifier: string): MockUser | null {
  const normalized = normalizeIdentifier(identifier)
  if (!normalized) return null
  const users = getUsers()
  return (
    users.find((user) => normalizeIdentifier(user.email) === normalized) ??
    users.find((user) => normalizeIdentifier(user.username) === normalized) ??
    null
  )
}

export function authenticateUser(identifier: string, password: string): MockUser | null {
  const user = findUserByIdentifier(identifier)
  if (!user) return null
  if (user.password !== password) return null
  return user
}

export const DEMO_CREDENTIALS = {
  admin: { identifier: 'Edunity', password: DEFAULT_ADMIN_PASSWORD, role: 'admin' as Role },
}

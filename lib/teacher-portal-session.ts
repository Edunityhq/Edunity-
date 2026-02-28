import { normalizeEdunityId } from '@/lib/teacher-follow-up-documents'

export interface TeacherPortalSession {
  edunityId: string
  firstName: string
  teacherName: string
  createdAt: string
}

const STORAGE_KEY = 'edunity_teacher_portal_session_v1'

function canUseStorage() {
  return typeof window !== 'undefined'
}

export function normalizeTeacherFirstName(value: string): string {
  return value.trim().toLowerCase()
}

export function extractFirstName(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean)[0]
    ?.trim() || ''
}

export function readTeacherPortalSession(): TeacherPortalSession | null {
  if (!canUseStorage()) return null
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Partial<TeacherPortalSession>
    const edunityId = typeof parsed.edunityId === 'string' ? normalizeEdunityId(parsed.edunityId) : ''
    const firstName =
      typeof parsed.firstName === 'string' ? normalizeTeacherFirstName(parsed.firstName) : ''
    const teacherName = typeof parsed.teacherName === 'string' ? parsed.teacherName.trim() : ''
    const createdAt = typeof parsed.createdAt === 'string' ? parsed.createdAt : ''
    if (!edunityId || !firstName || !teacherName || !createdAt) return null
    return { edunityId, firstName, teacherName, createdAt }
  } catch {
    return null
  }
}

export function createTeacherPortalSession(input: {
  edunityId: string
  firstName: string
  teacherName: string
}) {
  if (!canUseStorage()) return
  const session: TeacherPortalSession = {
    edunityId: normalizeEdunityId(input.edunityId),
    firstName: normalizeTeacherFirstName(input.firstName),
    teacherName: input.teacherName.trim(),
    createdAt: new Date().toISOString(),
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

export function clearTeacherPortalSession() {
  if (!canUseStorage()) return
  window.localStorage.removeItem(STORAGE_KEY)
}

export function hasTeacherPortalAccess(edunityId: string): boolean {
  const session = readTeacherPortalSession()
  if (!session) return false
  return session.edunityId === normalizeEdunityId(edunityId)
}

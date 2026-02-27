import type { Role } from '@/lib/types'

const SESSION_KEY = 'edunity_session';
const SESSION_EXPIRY_HOURS = 24;

export interface Session {
  userId: string;
  token: string;
  loginTime: number;
  expiresAt: number;
}

export interface SessionData {
  id: string;
  name: string;
  email: string;
  role: Role;
  department: string;
  avatar: string;
}

/**
 * Generate a simple token (in production, use JWT)
 */
function generateToken(): string {
  return 'token_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
}

/**
 * Create a new session and store in localStorage
 */
export function createSession(userData: SessionData): Session {
  const now = Date.now();
  const expiresAt = now + SESSION_EXPIRY_HOURS * 60 * 60 * 1000;
  const token = generateToken();

  const session: Session = {
    userId: userData.id,
    token,
    loginTime: now,
    expiresAt,
  };

  // Store session and user data
  if (typeof window !== 'undefined') {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    localStorage.setItem('edunity_user', JSON.stringify(userData));
  }

  return session;
}

/**
 * Get active session from localStorage
 */
export function getSession(): Session | null {
  if (typeof window === 'undefined') return null;

  const stored = localStorage.getItem(SESSION_KEY);
  if (!stored) return null;

  try {
    const session: Session = JSON.parse(stored);

    // Check if session has expired
    if (session.expiresAt < Date.now()) {
      clearSession();
      return null;
    }

    return session;
  } catch {
    clearSession();
    return null;
  }
}

/**
 * Get logged-in user data
 */
export function getSessionUser(): SessionData | null {
  if (typeof window === 'undefined') return null;

  const stored = localStorage.getItem('edunity_user');
  if (!stored) return null;

  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

/**
 * Clear session and user data
 */
export function clearSession(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem('edunity_user');
  }
}

/**
 * Check if user has an active session
 */
export function isAuthenticated(): boolean {
  return getSession() !== null;
}

/**
 * Extend session expiry (called on activity)
 */
export function extendSession(): void {
  const session = getSession();
  if (session) {
    session.expiresAt = Date.now() + SESSION_EXPIRY_HOURS * 60 * 60 * 1000;
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }
}

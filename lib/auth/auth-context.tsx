'use client'

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  ensureFirebaseEmailPasswordSession,
  logout as logoutFirebaseSession,
  syncFirebasePassword,
  waitForFirebaseAuthReady,
} from '@/lib/auth'
import {
  SessionData,
  SESSION_IDLE_TIMEOUT_MS,
  clearSession,
  createSession,
  extendSession,
  getSessionUser,
  getStoredSession,
  isSessionExpired,
  updateSessionUser,
} from './session'
import {
  endUserSession,
  formatActivitySection,
  logCurrentUserActivity,
  recordUserActivity,
  startUserSession,
  touchUserSession,
} from '@/lib/user-session-activity'

interface AuthContextType {
  user: SessionData | null
  isLoading: boolean
  login: (identifier: string, password: string) => Promise<void>
  changePassword: (currentPassword: string, nextPassword: string) => Promise<void>
  refreshUser: () => Promise<void>
  logout: (options?: { reason?: 'manual' | 'timeout' | 'expired' | 'user_missing' | 'reload' }) => void
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

function toSessionData(user: {
  id: string
  name: string
  email: string
  role: SessionData['role']
  department: string
  avatar: string
}): SessionData {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    department: user.department,
    avatar: user.avatar,
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<SessionData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const idleTimerRef = useRef<number | null>(null)
  const activeUserRef = useRef<SessionData | null>(null)
  const lastTrackedPathRef = useRef('')

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current !== null && typeof window !== 'undefined') {
      window.clearTimeout(idleTimerRef.current)
      idleTimerRef.current = null
    }
  }, [])

  const logout = useCallback((options?: { reason?: 'manual' | 'timeout' | 'expired' | 'user_missing' | 'reload' }) => {
    const reason = options?.reason ?? 'manual'
    const currentUser = activeUserRef.current ?? getSessionUser()
    const storedSession = getStoredSession()
    const currentPath =
      typeof window !== 'undefined' ? window.location.pathname : pathname || '/login'

    clearIdleTimer()

    clearSession()
    setUser(null)
    activeUserRef.current = null
    lastTrackedPathRef.current = ''

    if (storedSession && currentUser) {
      void endUserSession({
        sessionId: storedSession.token,
        user: currentUser,
        reason,
        path: currentPath,
      })
    }

    void logoutFirebaseSession().catch(() => {})
  }, [clearIdleTimer, pathname])

  const resetIdleTimer = useCallback(() => {
    if (typeof window === 'undefined' || !activeUserRef.current) return

    clearIdleTimer()
    idleTimerRef.current = window.setTimeout(() => {
      logout({ reason: 'timeout' })
      router.push('/login')
    }, SESSION_IDLE_TIMEOUT_MS)
  }, [clearIdleTimer, logout, router])

  useEffect(() => {
    let cancelled = false

    async function restoreSession() {
      const storedSession = getStoredSession()
      const sessionUser = getSessionUser()

      if (!storedSession || !sessionUser) {
        clearSession()
        if (!cancelled) {
          setUser(null)
          activeUserRef.current = null
          setIsLoading(false)
        }
        return
      }

      const firebaseUser = await waitForFirebaseAuthReady()
      if (cancelled) return

      const firebaseEmail = typeof firebaseUser?.email === 'string' ? firebaseUser.email.trim().toLowerCase() : ''
      const sessionEmail = sessionUser.email.trim().toLowerCase()

      if (!firebaseUser || !firebaseEmail || firebaseEmail !== sessionEmail) {
        clearSession()
        setUser(null)
        activeUserRef.current = null
        setIsLoading(false)
        return
      }

      if (isSessionExpired(storedSession)) {
        void endUserSession({
          sessionId: storedSession.token,
          user: sessionUser,
          reason: storedSession.lastActivityAt + SESSION_IDLE_TIMEOUT_MS < Date.now() ? 'timeout' : 'expired',
          path: typeof window !== 'undefined' ? window.location.pathname : '/login',
        })
        clearSession()
        setUser(null)
        activeUserRef.current = null
        setIsLoading(false)
        return
      }

      setUser(sessionUser)
      activeUserRef.current = sessionUser
      setIsLoading(false)
    }

    void restoreSession()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    activeUserRef.current = user
  }, [user])

  useEffect(() => {
    if (!user) {
      clearIdleTimer()
      return
    }

    resetIdleTimer()

      const handleActivity = () => {
        if (!activeUserRef.current) return
        extendSession()
        resetIdleTimer()
        void touchUserSession({ user: activeUserRef.current, path: pathname || '/dashboard' }).catch(() => {})
      }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        handleActivity()
      }
    }

    window.addEventListener('mousemove', handleActivity)
    window.addEventListener('mousedown', handleActivity)
    window.addEventListener('keydown', handleActivity)
    window.addEventListener('scroll', handleActivity, { passive: true })
    window.addEventListener('touchstart', handleActivity, { passive: true })
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      window.removeEventListener('mousemove', handleActivity)
      window.removeEventListener('mousedown', handleActivity)
      window.removeEventListener('keydown', handleActivity)
      window.removeEventListener('scroll', handleActivity)
      window.removeEventListener('touchstart', handleActivity)
      document.removeEventListener('visibilitychange', handleVisibility)
      clearIdleTimer()
    }
  }, [clearIdleTimer, pathname, resetIdleTimer, user])

  useEffect(() => {
    if (!user || !pathname) return
    if (lastTrackedPathRef.current === pathname) return

    lastTrackedPathRef.current = pathname
    extendSession()
    resetIdleTimer()
    void touchUserSession({ user, path: pathname, force: true }).catch(() => {})
    void recordUserActivity({
      sessionId: getStoredSession()?.token ?? '',
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      activityType: 'SECTION_VIEW',
      message: `Opened ${formatActivitySection(pathname)}.`,
      path: pathname,
      section: formatActivitySection(pathname),
    }).catch(() => {})
  }, [pathname, resetIdleTimer, user])

  const login = async (identifier: string, password: string): Promise<void> => {
    setIsLoading(true)
    try {
      const { authenticateUser } = await import('./mock-users')
      const mockUser = await authenticateUser(identifier, password)

      if (!mockUser) {
        throw new Error('Invalid username/email or password.')
      }

      if (mockUser.status !== 'active') {
        throw new Error('Account is suspended.')
      }

      await ensureFirebaseEmailPasswordSession(mockUser.email, password)

      const sessionData = toSessionData(mockUser)
      const session = createSession(sessionData)
      try {
        await startUserSession({
          session,
          user: sessionData,
          path: pathname || '/dashboard',
        })
      } catch {
        // Session tracking should not block login.
      }
      setUser(sessionData)
      activeUserRef.current = sessionData
      resetIdleTimer()
    } finally {
      setIsLoading(false)
    }
  }

  const refreshUser = async (): Promise<void> => {
    const current = getSessionUser()
    if (!current) {
      clearSession()
      setUser(null)
      return
    }

    const { getUsers } = await import('./mock-users')
    const updated = (await getUsers()).find((entry) => entry.id === current.id)
    if (!updated) {
      clearSession()
      setUser(null)
      return
    }

    const sessionData = toSessionData(updated)
    updateSessionUser(sessionData)
    setUser(sessionData)
    activeUserRef.current = sessionData
    try {
      await touchUserSession({ user: sessionData, path: pathname || '/dashboard', force: true })
    } catch {
      // Session tracking should not block refresh.
    }
  }

  const changePassword = async (currentPassword: string, nextPassword: string): Promise<void> => {
    if (!user) {
      throw new Error('You must be signed in to change your password.')
    }

    await syncFirebasePassword(currentPassword, nextPassword)

    const { changeUserPassword } = await import('./mock-users')
    await changeUserPassword(user.id, currentPassword, nextPassword)
    try {
      await logCurrentUserActivity({
        activityType: 'PASSWORD_CHANGED',
        message: 'Changed account password.',
        path: pathname || '/dashboard',
      })
    } catch {
      // Password change already succeeded.
    }
    await refreshUser()
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        changePassword,
        refreshUser,
        logout,
        isAuthenticated: user !== null,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

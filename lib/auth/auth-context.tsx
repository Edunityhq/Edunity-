'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { SessionData, getSessionUser, createSession, clearSession } from './session'

interface AuthContextType {
  user: SessionData | null
  isLoading: boolean
  login: (identifier: string, password: string) => Promise<void>
  changePassword: (currentPassword: string, nextPassword: string) => Promise<void>
  refreshUser: () => Promise<void>
  logout: () => void
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
  const [user, setUser] = useState<SessionData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const sessionUser = getSessionUser()
    setUser(sessionUser)
    setIsLoading(false)
  }, [])

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

      const sessionData = toSessionData(mockUser)
      createSession(sessionData)
      setUser(sessionData)
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
    createSession(sessionData)
    setUser(sessionData)
  }

  const changePassword = async (currentPassword: string, nextPassword: string): Promise<void> => {
    if (!user) {
      throw new Error('You must be signed in to change your password.')
    }

    const { changeUserPassword } = await import('./mock-users')
    await changeUserPassword(user.id, currentPassword, nextPassword)
    await refreshUser()
  }

  const logout = () => {
    clearSession()
    setUser(null)
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

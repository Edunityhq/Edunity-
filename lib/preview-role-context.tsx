'use client'

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'

export type PreviewRole = 'TEAM_LEAD' | 'AGENT'

interface PreviewRoleContextValue {
  role: PreviewRole
  setRole: (role: PreviewRole) => void
}

const STORAGE_KEY = 'edunity_preview_role'
const PreviewRoleContext = createContext<PreviewRoleContextValue | undefined>(undefined)

export function PreviewRoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<PreviewRole>('TEAM_LEAD')

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === 'TEAM_LEAD' || stored === 'AGENT') {
      setRoleState(stored)
    }
  }, [])

  const setRole = (nextRole: PreviewRole) => {
    setRoleState(nextRole)
    window.localStorage.setItem(STORAGE_KEY, nextRole)
  }

  const value = useMemo(() => ({ role, setRole }), [role])
  return <PreviewRoleContext.Provider value={value}>{children}</PreviewRoleContext.Provider>
}

export function usePreviewRole() {
  const ctx = useContext(PreviewRoleContext)
  if (!ctx) {
    throw new Error('usePreviewRole must be used within PreviewRoleProvider')
  }
  return ctx
}
